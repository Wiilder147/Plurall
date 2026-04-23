import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { createHash } from 'crypto'

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

  if (estado === 'APPROVED') {
    // 1. Obtener la cuota desde la referencia
    //    referencia = PLR-{cuotaId[:8].upper}-{timestamp}
    //    Para mapear de vuelta, buscaremos en tabla 'pago' por referencia_externa
    //    Si no existe un pago previo, buscamos la cuota directamente

    // Buscar cuota pendiente con referencia_externa = referencia (idempotencia)
    const { data: pagoExistente } = await supabase
      .from('pago')
      .select('id_recibo')
      .eq('referencia_externa', referencia)
      .single()

    if (pagoExistente) {
      // Pago duplicado — idempotencia
      return NextResponse.json({ ok: true, msg: 'Pago ya procesado' })
    }

    // Buscar cuota por referencia (la guardamos al iniciar el pago)
    // Para ello buscamos en pago con estado PROCESANDO (si implementamos pre-registro)
    // Fallback: buscar cuota en estado PENDIENTE/VENCIDA que coincida con el monto
    // NOTA: en producción se debe pre-registrar el pago al iniciar para hacer el mapping

    // Por ahora, extraemos el prefix del cuotaId desde la referencia
    // referencia = PLR-{cuotaId[:8].upper}-{timestamp}
    const partes  = referencia.split('-')
    const prefijo = partes[1]?.toLowerCase() // primeros 8 chars del cuotaId en lowercase

    const { data: cuota } = await supabase
      .from('cuota')
      .select('id_cuota, id_plan_pago, monto_total_cuota, monto_capital, monto_interes, numero_cuota')
      .ilike('id_cuota', `${prefijo}%`)
      .single()

    if (!cuota) {
      console.error('[Wompi Webhook] No se encontró cuota para referencia:', referencia)
      return NextResponse.json({ ok: true, msg: 'Cuota no encontrada — revisar manualmente' })
    }

    const { data: planPago } = await supabase
      .from('plan_pago')
      .select('id_credito')
      .eq('id_plan_pago', cuota.id_plan_pago)
      .single()

    // 2. Registrar el pago
    await supabase.from('pago').insert({
      id_cuota:           cuota.id_cuota,
      id_credito:         planPago.id_credito,
      monto_pagado:       monto / 100,
      monto_capital:      cuota.monto_capital,
      monto_interes:      cuota.monto_interes,
      monto_mora:         0,
      metodo_pago:        'WOMPI',
      referencia_externa: referencia,
      estado:             'CONFIRMADO',
    })

    // 3. Actualizar estado de la cuota
    await supabase
      .from('cuota')
      .update({
        estado_cuota:     'PAGADA',
        monto_pagado_real: monto / 100,
        fecha_pago_real:  new Date().toISOString().split('T')[0],
        updated_at:       new Date().toISOString(),
      })
      .eq('id_cuota', cuota.id_cuota)

    // 4. Actualizar saldo y cuotas_pagadas del crédito
    const { data: creditoActual } = await supabase
      .from('credito')
      .select('saldo_pendiente, cuotas_pagadas')
      .eq('id_credito', planPago.id_credito)
      .single()

    if (creditoActual) {
      const nuevoSaldo = Math.max(0, creditoActual.saldo_pendiente - cuota.monto_capital)
      await supabase
        .from('credito')
        .update({
          saldo_pendiente:  nuevoSaldo,
          cuotas_pagadas:   creditoActual.cuotas_pagadas + 1,
          updated_at:       new Date().toISOString(),
        })
        .eq('id_credito', planPago.id_credito)
    }

    console.log(`[Wompi Webhook] Pago CONFIRMADO — cuota ${cuota.id_cuota}`)

  } else if (['DECLINED', 'ERROR', 'VOIDED'].includes(estado)) {
    console.log(`[Wompi Webhook] Pago ${estado} — referencia: ${referencia}`)
    // Registrar el intento fallido para auditoría
    await supabase.from('pago').insert({
      id_cuota:           null, // sin cuota asignada (pago fallido)
      id_credito:         null,
      monto_pagado:       monto / 100,
      monto_capital:      0,
      monto_interes:      0,
      monto_mora:         0,
      metodo_pago:        'WOMPI',
      referencia_externa: referencia,
      estado:             'FALLIDO',
    }).catch(() => null) // silenciamos errores de constraint
  }

  return NextResponse.json({ ok: true })
}
