/* ==========================================================================
 * ARCHIVO: route.js
 * RUTA: apps/web/app/api/webhooks/wompi/route.js
 * DESCRIPCIÓN: Webhook de confirmación de pagos Wompi (invisible para el usuario).
 * FUNCIONALIDAD: Verifica la firma HMAC SHA-256 del evento, localiza el pago
 *                pre-registrado por referencia_externa (UNIQUE), valida el
 *                monto y actualiza pago → cuota → crédito de forma idempotente.
 * ========================================================================== */
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { notificarPagoConfirmado } from '@/lib/notificaciones'

// El webhook usa service role: Wompi no tiene cookies de sesión y la política
// RLS "staff_insertar_pago" no aplica a clientes.
// Se crea bajo demanda (no al evaluar el módulo) para que el build no falle
// cuando las variables de entorno no están disponibles.
let supabase = null
function getSupabase() {
  if (!supabase) supabase = createServiceClient()
  return supabase
}

// ── Verificación de firma ───────────────────────────────────────────────────
// checksum = SHA256(transaction.id + status + amount_in_cents + events_secret)
function firmaValida(evento, tx) {
  const secret  = process.env.WOMPI_EVENTS_SECRET || ''
  const checksum = evento?.signature?.checksum
  const cadena   = `${tx.id}${tx.status}${tx.amount_in_cents}${secret}`
  const esperado = createHash('sha256').update(cadena).digest('hex')
  return checksum === esperado
}

// ── Fallback: localizar cuota desde la referencia (solo si no hubo pre-registro)
// referencia = PLR-{cuotaId[:8].upper}-{timestamp}
async function localizarCuotaPorReferencia(referencia) {
  const prefijo = referencia.split('-')[1]?.toLowerCase()
  if (!prefijo) return null

  const { data } = await getSupabase()
    .from('cuota')
    .select('id_cuota, id_plan_pago, monto_total_cuota, monto_capital, monto_interes, monto_mora_cobrada, estado_cuota, numero_cuota')
    .ilike('id_cuota', `${prefijo}%`)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data
}

export async function POST(request) {
  let evento

  try {
    evento = await request.json()
  } catch {
    return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })
  }

  const db = getSupabase()

  const tx = evento?.data?.transaction

  if (!tx) {
    return NextResponse.json({ error: 'Evento sin transacción' }, { status: 400 })
  }

  // ── Verificar firma HMAC de Wompi (prevención de spoofing) ──
  if (!firmaValida(evento, tx)) {
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

  // ── Buscar el pago pre-registrado (idempotencia real gracias al UNIQUE) ──
  const { data: pago } = await db
    .from('pago')
    .select('*')
    .eq('referencia_externa', referencia)
    .maybeSingle()

  // ── PAGO APROBADO ─────────────────────────────────────────────
  if (estado === 'APPROVED') {
    // Idempotencia: si ya fue confirmado, no reprocesar
    if (pago?.estado === 'CONFIRMADO') {
      return NextResponse.json({ ok: true, msg: 'Pago ya procesado' })
    }

    // Resolver cuota: desde el pre-registro o fallback por prefijo
    let cuota = null
    let idPlanPago = pago?.id_cuota ? null : null
    let idCredito  = pago?.id_credito

    if (pago?.id_cuota) {
      const { data: c } = await db
        .from('cuota')
        .select('id_cuota, id_plan_pago, monto_total_cuota, monto_capital, monto_interes, monto_mora_cobrada, estado_cuota, numero_cuota')
        .eq('id_cuota', pago.id_cuota)
        .maybeSingle()
      cuota = c
      idPlanPago = c?.id_plan_pago
    } else {
      cuota = await localizarCuotaPorReferencia(referencia)
      idPlanPago = cuota?.id_plan_pago
    }

    if (!cuota) {
      console.error('[Wompi Webhook] No se encontró cuota para referencia:', referencia)
      return NextResponse.json({ ok: true, msg: 'Cuota no encontrada — revisar manualmente' })
    }

    if (!idCredito && idPlanPago) {
      const { data: plan } = await db
        .from('plan_pago')
        .select('id_credito')
        .eq('id_plan_pago', idPlanPago)
        .maybeSingle()
      idCredito = plan?.id_credito
    }

    if (!idCredito) {
      console.error('[Wompi Webhook] Sin id_credito para referencia:', referencia)
      return NextResponse.json({ ok: true, msg: 'Crédito no encontrado — revisar manualmente' })
    }

    // ── Validación de monto ────────────────────────────────────
    const montoEsperadoCentavos = Math.round(Number(pago?.monto_pagado ?? cuota.monto_total_cuota) * 100)
    if (Math.abs(tx.amount_in_cents - montoEsperadoCentavos) > 0) {
      console.warn(
        `[Wompi Webhook] Monto inesperado: esperado ${montoEsperadoCentavos}, recibido ${tx.amount_in_cents}. Referencia: ${referencia}`
      )
    }

    const montoPagado = monto / 100
    const tieneMora   = Number(pago?.monto_mora ?? cuota.monto_mora_cobrada ?? 0) > 0

    // 1. Confirmar el pago (upsert: existe por pre-registro o se inserta)
    if (pago) {
      await db
        .from('pago')
        .update({
          estado:        'CONFIRMADO',
          monto_pagado:  montoPagado,
          monto_capital: cuota.monto_capital,
          monto_interes: cuota.monto_interes,
          monto_mora:    Number(pago.monto_mora ?? 0),
          fecha_pago:    new Date().toISOString(),
          updated_at:    new Date().toISOString(),
        })
        .eq('id_recibo', pago.id_recibo)
    } else {
      await db.from('pago').insert({
        id_cuota:           cuota.id_cuota,
        id_credito:         idCredito,
        monto_pagado:       montoPagado,
        monto_capital:      cuota.monto_capital,
        monto_interes:      cuota.monto_interes,
        monto_mora:         Number(cuota.monto_mora_cobrada ?? 0),
        metodo_pago:        'WOMPI',
        referencia_externa: referencia,
        estado:             'CONFIRMADO',
      })
    }

    // 2. Actualizar estado de la cuota (PAGADA o PAGADA_MORA)
    //    El trigger trg_historial_cuota registra el cambio en historial_estado.
    await db
      .from('cuota')
      .update({
        estado_cuota:       tieneMora ? 'PAGADA_MORA' : 'PAGADA',
        monto_pagado_real:  montoPagado,
        monto_mora_cobrada: Number(pago?.monto_mora ?? cuota.monto_mora_cobrada ?? 0),
        fecha_pago_real:    new Date().toISOString().split('T')[0],
        updated_at:         new Date().toISOString(),
      })
      .eq('id_cuota', cuota.id_cuota)

    // 3. Actualizar saldo y cuotas_pagadas del crédito
    const { data: creditoActual } = await db
      .from('credito')
      .select('saldo_pendiente, cuotas_pagadas, cuotas_en_mora, estado_credito')
      .eq('id_credito', idCredito)
      .maybeSingle()

    if (creditoActual) {
      const nuevoSaldo = Math.max(0, Number(creditoActual.saldo_pendiente) - Number(cuota.monto_capital))
      await db
        .from('credito')
        .update({
          saldo_pendiente: nuevoSaldo,
          cuotas_pagadas:  Number(creditoActual.cuotas_pagadas ?? 0) + 1,
          cuotas_en_mora:  Math.max(0, Number(creditoActual.cuotas_en_mora ?? 0) - (tieneMora ? 1 : 0)),
          estado_credito:  nuevoSaldo <= 0 ? 'CANCELADO' : creditoActual.estado_credito,
          updated_at:      new Date().toISOString(),
        })
        .eq('id_credito', idCredito)
    }

    // 4. Notificar al cliente por email (fire-and-forget)
    try {
      const { data: creditoCliente } = await db
        .from('credito')
        .select('saldo_pendiente, cliente ( email, nombre_completo )')
        .eq('id_credito', idCredito)
        .maybeSingle()

      if (creditoCliente?.cliente?.email) {
        const nuevoSaldo = Math.max(0, Number(creditoActual?.saldo_pendiente ?? 0) - Number(cuota.monto_capital))
        notificarPagoConfirmado({
          email:          creditoCliente.cliente.email,
          nombre:         creditoCliente.cliente.nombre_completo,
          numeroCuota:    cuota.numero_cuota,
          montoPagado,
          saldoPendiente: nuevoSaldo,
          referencia,
        }).catch(() => null)
      }
    } catch { /* No bloquear el webhook si el email falla */ }

    console.log(`[Wompi Webhook] Pago CONFIRMADO — cuota ${cuota.id_cuota}, ref ${referencia}`)

  // ── PAGO FALLIDO / RECHAZADO ──────────────────────────────────
  } else if (['DECLINED', 'ERROR', 'VOIDED'].includes(estado)) {
    console.log(`[Wompi Webhook] Pago ${estado} — referencia: ${referencia}`)

    if (pago) {
      // Actualizar el pre-registro (auditoría sin violar NOT NULL)
      await db
        .from('pago')
        .update({
          estado:     'FALLIDO',
          monto_pagado: monto / 100,
          updated_at: new Date().toISOString(),
        })
        .eq('id_recibo', pago.id_recibo)
    } else {
      // Fallback: sin pre-registro, intentar localizar la cuota para no perder la auditoría
      const cuota = await localizarCuotaPorReferencia(referencia)
      await db
        .from('pago')
        .insert({
          id_cuota:           cuota?.id_cuota ?? null,
          id_credito:         null,
          monto_pagado:       monto / 100,
          monto_capital:      0,
          monto_interes:      0,
          monto_mora:         0,
          metodo_pago:        'WOMPI',
          referencia_externa: referencia,
          estado:             'FALLIDO',
        })
        .catch(() => null)
    }
  }

  return NextResponse.json({ ok: true })
}