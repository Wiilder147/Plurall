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
import { firmaEventoWompiValida } from '@/lib/wompi'
import { notificarPagoConfirmado } from '@/lib/notificaciones'
import { formatNombre } from '@/lib/nombre'

// El webhook usa service role: Wompi no tiene cookies de sesión y la política
// RLS "staff_insertar_pago" no aplica a clientes.
// Se crea bajo demanda (no al evaluar el módulo) para que el build no falle
// cuando las variables de entorno no están disponibles.
let supabase = null
function getSupabase() {
  if (!supabase) supabase = createServiceClient()
  return supabase
}

// Estados de cuota que todavía admiten un pago (H1: nunca re-aplicar una
// cuota ya pagada por otro pago).
const CUOTA_PAGABLE = ['PENDIENTE', 'VENCIDA']

// H2d: reclamo atómico del pago pre-registrado. Solo una entrega del evento
// logra la transición PROCESANDO → CONFIRMADO; las demás no aplican nada.
async function reclamarPago(db, idRecibo, cambios) {
  const { data } = await db
    .from('pago')
    .update({ ...cambios, estado: 'CONFIRMADO' })
    .eq('id_recibo', idRecibo)
    .eq('estado', 'PROCESANDO')
    .select('id_recibo')
  return Array.isArray(data) && data.length > 0
}

// H2c: el monto cobrado por Wompi debe ser exactamente el pre-registrado.
function montoCoincide(pago, montoCentavos) {
  return Math.round(Number(pago.monto_pagado) * 100) === Number(montoCentavos)
}

// ── Recalcular el estado del crédito tras un pago ───────────────────────────
// - saldo <= 0            → CANCELADO (crédito saldado)
// - sin cuotas en mora    → ACTIVO   (sale de mora automáticamente)
// - con cuotas en mora    → EN_MORA
// Estados especiales (CASTIGADO, etc.) no se tocan salvo saldo 0.
function nuevoEstadoCredito(saldo, cuotasEnMora, estadoActual) {
  if (saldo <= 0) return 'CANCELADO'
  if (estadoActual === 'ACTIVO' || estadoActual === 'EN_MORA') {
    return cuotasEnMora <= 0 ? 'ACTIVO' : 'EN_MORA'
  }
  return estadoActual
}

// ── Asesor activo asignado al crédito (para atribuir el recaudo Wompi) ──────
// Así el pago por Wompi también "cuenta" en las métricas del asesor/cobranza.
async function asesorDeCredito(db, idCredito) {
  const { data: cr } = await db
    .from('credito').select('id_cliente').eq('id_credito', idCredito).maybeSingle()
  if (!cr?.id_cliente) return null
  const { data: asig } = await db
    .from('asignacion_asesor')
    .select('id_asesor')
    .eq('id_cliente', cr.id_cliente)
    .eq('activa', true)
    .maybeSingle()
  return asig?.id_asesor ?? null
}

// ── Confirmación de un pago que cubre VARIAS cuotas (pago adelantado) ────────
// El pre-registro (api/pagos/iniciar) guardó el detalle en pago.cuotas_cubiertas.
// Marca cada cuota como PAGADA/PAGADA_MORA, baja el saldo del crédito por la
// suma de capitales y actualiza contadores. Idempotente vía estado del pago.
async function confirmarMultiCuota(db, { pago, referencia, montoCentavos }) {
  const cubiertas = pago.cuotas_cubiertas
  const montoPagado = montoCentavos / 100
  const ahora = new Date().toISOString()
  const hoy   = ahora.split('T')[0]

  if (!montoCoincide(pago, montoCentavos)) {
    console.error(`[Wompi Webhook] REVISION MANUAL: monto ${montoCentavos} ≠ pre-registro ${pago.monto_pagado} — ref ${referencia}`)
    return NextResponse.json({ ok: true, msg: 'Monto no coincide — revisión manual' })
  }

  // 1. Confirmar el pago (los montos agregados ya venían del pre-registro).
  //    Se atribuye al asesor asignado para que el recaudo Wompi cuente en su
  //    gestión (igual que un pago manual en efectivo).
  const idAsesor = await asesorDeCredito(db, pago.id_credito)
  const reclamado = await reclamarPago(db, pago.id_recibo, {
    monto_pagado: montoPagado,
    fecha_pago: ahora,
    updated_at: ahora,
    ...(idAsesor ? { id_usuario_receptor: idAsesor } : {}),
  })
  if (!reclamado) return NextResponse.json({ ok: true, msg: 'Pago ya procesado' })

  // 2. Marcar cada cuota cubierta como pagada (con o sin mora), solo si sigue
  //    pendiente/vencida: otro pago pudo cubrirla entre el pre-registro y hoy.
  const aplicadas = []
  for (const c of cubiertas) {
    const conMora = Number(c.monto_mora) > 0
    const { data: filas } = await db
      .from('cuota')
      .update({
        estado_cuota:       conMora ? 'PAGADA_MORA' : 'PAGADA',
        monto_pagado_real:  Number(c.monto_total_cuota) + Number(c.monto_mora),
        monto_mora_cobrada: Number(c.monto_mora),
        fecha_pago_real:    hoy,
        updated_at:         ahora,
      })
      .eq('id_cuota', c.id_cuota)
      .in('estado_cuota', CUOTA_PAGABLE)
      .select('id_cuota')
    if (filas?.length) aplicadas.push(c)
  }
  const todasAplicadas = aplicadas.length === cubiertas.length
  if (!todasAplicadas) {
    console.error(`[Wompi Webhook] REVISION MANUAL: ${cubiertas.length - aplicadas.length} cuota(s) ya estaban pagadas — ref ${referencia}`)
  }

  const sumaCapital = aplicadas.reduce((s, c) => s + Number(c.monto_capital), 0)
  const enMora      = aplicadas.filter((c) => Number(c.monto_mora) > 0 || c.estado_previo === 'VENCIDA').length

  // 3. Actualizar saldo, contadores y saldo a favor del crédito
  const { data: creditoActual } = await db
    .from('credito')
    .select('saldo_pendiente, cuotas_pagadas, cuotas_en_mora, estado_credito, saldo_a_favor')
    .eq('id_credito', pago.id_credito)
    .maybeSingle()

  if (creditoActual) {
    const nuevoSaldo = Math.max(0, Number(creditoActual.saldo_pendiente) - sumaCapital)
    // saldo a favor: aplicar el delta calculado en el pre-registro (puede ser
    // negativo si se consumió saldo previo). Nunca baja de 0. Si alguna cuota
    // ya estaba pagada, el delta se calculó sobre un estado que ya no existe
    // (H1: doble gasto del saldo a favor) → no se aplica; queda a revisión.
    const deltaSaldoFavor = todasAplicadas ? Number(pago.saldo_a_favor_delta ?? 0) : 0
    const nuevoSaldoFavor = Math.max(0, Math.round((Number(creditoActual.saldo_a_favor ?? 0) + deltaSaldoFavor) * 100) / 100)
    const nuevoEnMora = Math.max(0, Number(creditoActual.cuotas_en_mora ?? 0) - enMora)

    await db
      .from('credito')
      .update({
        saldo_pendiente: nuevoSaldo,
        cuotas_pagadas:  Number(creditoActual.cuotas_pagadas ?? 0) + aplicadas.length,
        cuotas_en_mora:  nuevoEnMora,
        saldo_a_favor:   nuevoSaldoFavor,
        estado_credito:  nuevoEstadoCredito(nuevoSaldo, nuevoEnMora, creditoActual.estado_credito),
        updated_at:      ahora,
      })
      .eq('id_credito', pago.id_credito)

    // 4. Notificar al cliente (fire-and-forget) — solo si cubrió alguna cuota
    try {
      if (aplicadas.length === 0) throw new Error('sin cuotas cubiertas — solo abono a saldo')
      const { data: creditoCliente } = await db
        .from('credito')
        .select('cliente ( email, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido )')
        .eq('id_credito', pago.id_credito)
        .maybeSingle()

      if (creditoCliente?.cliente?.email) {
        const nums = aplicadas.map((c) => c.numero_cuota)
        const etiqueta = nums.length === 1
          ? `${nums[0]}`
          : `${nums[0]} a ${nums[nums.length - 1]} (${nums.length} cuotas)`
        notificarPagoConfirmado({
          email:          creditoCliente.cliente.email,
          nombre:         formatNombre(creditoCliente.cliente),
          numeroCuota:    etiqueta,
          montoPagado,
          saldoPendiente: nuevoSaldo,
          referencia,
        }).catch(() => null)
      }
    } catch { /* No bloquear el webhook si el email falla */ }
  }

  console.log(`[Wompi Webhook] Pago multi-cuota CONFIRMADO — ${aplicadas.length} cuotas, ref ${referencia}`)
  return NextResponse.json({ ok: true })
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

  // ── Verificar firma de Wompi (prevención de spoofing) ──
  // Sin secreto configurado se rechaza todo (antes se validaba contra '').
  if (!process.env.WOMPI_EVENTS_SECRET) {
    console.error('[Wompi Webhook] WOMPI_EVENTS_SECRET no configurado: evento rechazado')
    return NextResponse.json({ error: 'Webhook no configurado' }, { status: 500 })
  }
  if (!firmaEventoWompiValida(evento, process.env.WOMPI_EVENTS_SECRET)) {
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

    // ── Pago multi-cuota / monto libre: reconciliar cuotas + saldo a favor ──
    // Cualquier pago del flujo nuevo trae cuotas_cubiertas como array (puede
    // estar vacío si el monto libre solo alimentó el saldo a favor).
    if (Array.isArray(pago?.cuotas_cubiertas)) {
      return await confirmarMultiCuota(db, { pago, referencia, montoCentavos: monto })
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

    // ── Validación de monto (H2c: un monto distinto no se aplica) ──
    const montoEsperadoCentavos = Math.round(Number(pago?.monto_pagado ?? cuota.monto_total_cuota) * 100)
    if (Number(tx.amount_in_cents) !== montoEsperadoCentavos) {
      console.error(
        `[Wompi Webhook] REVISION MANUAL: monto esperado ${montoEsperadoCentavos}, recibido ${tx.amount_in_cents}. Referencia: ${referencia}`
      )
      return NextResponse.json({ ok: true, msg: 'Monto no coincide — revisión manual' })
    }

    const montoPagado = monto / 100
    const tieneMora   = Number(pago?.monto_mora ?? cuota.monto_mora_cobrada ?? 0) > 0

    // Atribuir el recaudo al asesor asignado (para que cuente en su gestión).
    const idAsesor = await asesorDeCredito(db, idCredito)

    // 1. Confirmar el pago (upsert: existe por pre-registro o se inserta)
    if (pago) {
      const reclamado = await reclamarPago(db, pago.id_recibo, {
        monto_pagado:  montoPagado,
        monto_capital: cuota.monto_capital,
        monto_interes: cuota.monto_interes,
        monto_mora:    Number(pago.monto_mora ?? 0),
        fecha_pago:    new Date().toISOString(),
        updated_at:    new Date().toISOString(),
        ...(idAsesor ? { id_usuario_receptor: idAsesor } : {}),
      })
      if (!reclamado) return NextResponse.json({ ok: true, msg: 'Pago ya procesado' })
    } else {
      // Sin pre-registro: el UNIQUE de referencia_externa hace de candado.
      const { error: insErr } = await db.from('pago').insert({
        id_cuota:           cuota.id_cuota,
        id_credito:         idCredito,
        monto_pagado:       montoPagado,
        monto_capital:      cuota.monto_capital,
        monto_interes:      cuota.monto_interes,
        monto_mora:         Number(cuota.monto_mora_cobrada ?? 0),
        metodo_pago:        'WOMPI',
        referencia_externa: referencia,
        estado:             'CONFIRMADO',
        ...(idAsesor ? { id_usuario_receptor: idAsesor } : {}),
      })
      if (insErr) return NextResponse.json({ ok: true, msg: 'Pago ya procesado' })
    }

    // 2. Actualizar estado de la cuota (PAGADA o PAGADA_MORA)
    //    El trigger trg_historial_cuota registra el cambio en historial_estado.
    const { data: cuotaAplicada } = await db
      .from('cuota')
      .update({
        estado_cuota:       tieneMora ? 'PAGADA_MORA' : 'PAGADA',
        monto_pagado_real:  montoPagado,
        monto_mora_cobrada: Number(pago?.monto_mora ?? cuota.monto_mora_cobrada ?? 0),
        fecha_pago_real:    new Date().toISOString().split('T')[0],
        updated_at:         new Date().toISOString(),
      })
      .eq('id_cuota', cuota.id_cuota)
      .in('estado_cuota', CUOTA_PAGABLE)
      .select('id_cuota')

    if (!cuotaAplicada?.length) {
      console.error(`[Wompi Webhook] REVISION MANUAL: cuota ${cuota.id_cuota} ya estaba pagada — ref ${referencia}`)
      return NextResponse.json({ ok: true, msg: 'Cuota ya pagada — revisión manual' })
    }

    // 3. Actualizar saldo y cuotas_pagadas del crédito
    const { data: creditoActual } = await db
      .from('credito')
      .select('saldo_pendiente, cuotas_pagadas, cuotas_en_mora, estado_credito')
      .eq('id_credito', idCredito)
      .maybeSingle()

    if (creditoActual) {
      const nuevoSaldo = Math.max(0, Number(creditoActual.saldo_pendiente) - Number(cuota.monto_capital))
      const nuevoEnMora = Math.max(0, Number(creditoActual.cuotas_en_mora ?? 0) - (tieneMora ? 1 : 0))
      await db
        .from('credito')
        .update({
          saldo_pendiente: nuevoSaldo,
          cuotas_pagadas:  Number(creditoActual.cuotas_pagadas ?? 0) + 1,
          cuotas_en_mora:  nuevoEnMora,
          estado_credito:  nuevoEstadoCredito(nuevoSaldo, nuevoEnMora, creditoActual.estado_credito),
          updated_at:      new Date().toISOString(),
        })
        .eq('id_credito', idCredito)
    }

    // 4. Notificar al cliente por email (fire-and-forget)
    try {
      const { data: creditoCliente } = await db
        .from('credito')
        .select('saldo_pendiente, cliente ( email, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido )')
        .eq('id_credito', idCredito)
        .maybeSingle()

      if (creditoCliente?.cliente?.email) {
        const nuevoSaldo = Math.max(0, Number(creditoActual?.saldo_pendiente ?? 0) - Number(cuota.monto_capital))
        notificarPagoConfirmado({
          email:          creditoCliente.cliente.email,
          nombre:         formatNombre(creditoCliente.cliente),
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
      // Actualizar el pre-registro (auditoría sin violar NOT NULL). Solo si
      // sigue PROCESANDO: un evento tardío no revierte un pago CONFIRMADO (H2e).
      await db
        .from('pago')
        .update({
          estado:     'FALLIDO',
          monto_pagado: monto / 100,
          updated_at: new Date().toISOString(),
        })
        .eq('id_recibo', pago.id_recibo)
        .eq('estado', 'PROCESANDO')
    } else {
      // Fallback: sin pre-registro, intentar localizar la cuota para no perder
      // la auditoría. id_cuota e id_credito son NOT NULL: sin ellos no se inserta.
      const cuota = await localizarCuotaPorReferencia(referencia)
      const { data: plan } = cuota?.id_plan_pago
        ? await db.from('plan_pago').select('id_credito').eq('id_plan_pago', cuota.id_plan_pago).maybeSingle()
        : { data: null }
      if (cuota && plan?.id_credito) {
        const { error: insErr } = await db
          .from('pago')
          .insert({
            id_cuota:           cuota.id_cuota,
            id_credito:         plan.id_credito,
            monto_pagado:       monto / 100,
            monto_capital:      0,
            monto_interes:      0,
            monto_mora:         0,
            metodo_pago:        'WOMPI',
            referencia_externa: referencia,
            estado:             'FALLIDO',
          })
        if (insErr) console.error('[Wompi Webhook] No se pudo auditar pago fallido:', insErr.message)
      }
    }
  }

  return NextResponse.json({ ok: true })
}