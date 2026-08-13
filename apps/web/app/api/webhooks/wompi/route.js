/* ==========================================================================
 * ARCHIVO: route.js
 * RUTA: apps/web/app/api/webhooks/wompi/route.js
 * DESCRIPCIÓN: Endpoint de API (Backend) para manejar la lógica de wompi
 * FUNCIONALIDAD: Este archivo define la lógica y estructura para su respectivo módulo.
 * ========================================================================== */
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { notificarPagoConfirmado } from '@/lib/notificaciones'
import { formatNombre } from '@/lib/nombre'

// Usamos el cliente SERVICE_ROLE para escribir desde el webhook (sin cookies de sesión)
function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(request) {
  let evento

  try {
    evento = await request.json()
  } catch {
    return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })
  }

  // ── Verificar firma HMAC de Wompi ────────────────────────────
  // checksum = SHA256(transaction.id + status + amount_in_cents + events_secret)
  const tx      = evento?.data?.transaction
  const secret  = process.env.WOMPI_EVENTS_SECRET || ''

  if (!tx) {
    return NextResponse.json({ error: 'Evento sin transacción' }, { status: 400 })
  }

  const checksum = evento?.signature?.checksum
  const cadena   = `${tx.id}${tx.status}${tx.amount_in_cents}${secret}`
  const esperado = createHash('sha256').update(cadena).digest('hex')

  if (checksum !== esperado) {
    console.warn('[Wompi Webhook] Firma inválida. Posible intento de spoofing.')
    return NextResponse.json({ error: 'Firma inválida' }, { status: 401 })
  }

  // Solo procesamos eventos de transacciones actualizadas
  if (evento.event !== 'transaction.updated') {
    return NextResponse.json({ ok: true, msg: 'Evento ignorado' })
  }

  const referencia = tx.reference         // Formato: PLR-XXXX-timestamp
  const estado     = tx.status            // 'APPROVED', 'DECLINED', 'ERROR', 'VOIDED'
  const monto      = tx.amount_in_cents   // En centavos

  const supabase = getServiceClient()

  // ── Localizar el pago pre-registrado por /api/pagos/iniciar ──────────────
  // El pre-registro (estado PENDIENTE) contiene el mapeo fiable
  // referencia → cuota/crédito y el desglose (capital, interés, mora).
  const { data: pago } = await supabase
    .from('pago')
    .select('id_recibo, id_cuota, id_credito, monto_pagado, monto_capital, monto_interes, monto_mora, estado')
    .eq('referencia_externa', referencia)
    .single()

  if (!pago) {
    // Sin pre-registro no podemos mapear la transacción de forma segura.
    console.error('[Wompi Webhook] No hay pre-registro para referencia:', referencia)
    return NextResponse.json({ ok: true, msg: 'Pago no encontrado — revisar manualmente' })
  }

  // Idempotencia: si ya quedó en estado final, no reprocesar.
  if (['CONFIRMADO', 'FALLIDO', 'RECHAZADO', 'REVERSADO'].includes(pago.estado)) {
    return NextResponse.json({ ok: true, msg: 'Pago ya procesado' })
  }

  if (estado === 'APPROVED') {
    // Sanity check: el monto cobrado por Wompi debe coincidir con el pre-registro.
    const esperadoCentavos = Math.round(Number(pago.monto_pagado) * 100)
    if (monto !== esperadoCentavos) {
      console.warn(`[Wompi Webhook] Monto no coincide (esperado ${esperadoCentavos}, recibido ${monto}) — ref ${referencia}`)
    }

    const hoy      = new Date().toISOString().split('T')[0]
    const tieneMora = Number(pago.monto_mora) > 0

    // 1. Confirmar el pago pre-registrado
    await supabase
      .from('pago')
      .update({ estado: 'CONFIRMADO', fecha_pago: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id_recibo', pago.id_recibo)

    // 2. Actualizar estado de la cuota (PAGADA_MORA si hubo mora)
    await supabase
      .from('cuota')
      .update({
        estado_cuota:      tieneMora ? 'PAGADA_MORA' : 'PAGADA',
        monto_pagado_real: Number(pago.monto_pagado),
        monto_mora_cobrada: Number(pago.monto_mora),
        fecha_pago_real:   hoy,
        updated_at:        new Date().toISOString(),
      })
      .eq('id_cuota', pago.id_cuota)

    // 3. Actualizar saldo y cuotas_pagadas del crédito (solo abona capital)
    const { data: creditoActual } = await supabase
      .from('credito')
      .select('saldo_pendiente, cuotas_pagadas')
      .eq('id_credito', pago.id_credito)
      .single()

    let nuevoSaldo = creditoActual?.saldo_pendiente ?? 0
    if (creditoActual) {
      nuevoSaldo = Math.max(0, Number(creditoActual.saldo_pendiente) - Number(pago.monto_capital))
      await supabase
        .from('credito')
        .update({
          saldo_pendiente:  nuevoSaldo,
          cuotas_pagadas:   creditoActual.cuotas_pagadas + 1,
          updated_at:       new Date().toISOString(),
        })
        .eq('id_credito', pago.id_credito)
    }

    // 4. Notificar al cliente por email (fire-and-forget)
    try {
      const { data: cuotaInfo } = await supabase
        .from('cuota')
        .select('numero_cuota')
        .eq('id_cuota', pago.id_cuota)
        .single()

      const { data: creditoCliente } = await supabase
        .from('credito')
        .select('cliente ( primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, email )')
        .eq('id_credito', pago.id_credito)
        .single()

      if (creditoCliente?.cliente?.email) {
        notificarPagoConfirmado({
          email:          creditoCliente.cliente.email,
          nombre:         formatNombre(creditoCliente.cliente),
          numeroCuota:    cuotaInfo?.numero_cuota,
          montoPagado:    Number(pago.monto_pagado),
          saldoPendiente: nuevoSaldo,
          referencia,
        }).catch(() => null)
      }
    } catch { /* No bloquear el webhook si el email falla */ }

    console.log(`[Wompi Webhook] Pago CONFIRMADO — cuota ${pago.id_cuota}`)

  } else if (['DECLINED', 'ERROR', 'VOIDED'].includes(estado)) {
    console.log(`[Wompi Webhook] Pago ${estado} — referencia: ${referencia}`)
    // Marcar el pre-registro como fallido (auditoría, sin filas con NULL).
    await supabase
      .from('pago')
      .update({ estado: 'FALLIDO', updated_at: new Date().toISOString() })
      .eq('id_recibo', pago.id_recibo)
  }

  return NextResponse.json({ ok: true })
}
