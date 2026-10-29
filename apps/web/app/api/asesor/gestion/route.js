/* ==========================================================================
 * ARCHIVO: route.js
 * RUTA: apps/web/app/api/asesor/gestion/route.js
 * DESCRIPCIÓN: Endpoint de API (Backend) para manejar la lógica de gestion
 * FUNCIONALIDAD: Este archivo define la lógica y estructura para su respectivo módulo.
 * ========================================================================== */
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'
import { distribuirPagoEfectivo, nuevoEstadoCredito } from '@/lib/credito'

/**
 * POST /api/asesor/gestion
 * Registra una gestión de cobranza realizada por el asesor.
 * Si el resultado es PAGO_RECIBIDO, también registra el pago en la tabla pago.
 */
export async function POST(request) {
  const supabase = await createClient()

  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  // Verificar rol ASESOR, SUPERVISOR o ADMIN
  const { data: perfil } = await supabase
    .from('perfil_usuario')
    .select('rol ( nombre_rol )')
    .eq('id', user.id)
    .single()

  const rol = perfil?.rol?.nombre_rol?.toUpperCase()
  if (!['ASESOR', 'SUPERVISOR', 'ADMIN'].includes(rol)) {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
  }

  const {
    clienteId, creditoId,
    tipo_gestion, resultado,
    observaciones, monto_prometido, fecha_promesa, monto_recibido,
  } = await request.json()

  if (!clienteId || !creditoId || !tipo_gestion || !resultado) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
  }

  // Un pago recibido exige un monto válido (antes se aceptaba cualquier valor)
  const esPago = resultado === 'PAGO_RECIBIDO'
  const montoEfectivo = Number(monto_recibido)
  if (esPago && (monto_recibido == null || !Number.isFinite(montoEfectivo) || montoEfectivo <= 0)) {
    return NextResponse.json({ error: 'Indica el monto recibido (mayor a $0).' }, { status: 400 })
  }

  // El crédito debe pertenecer al cliente indicado (la asignación se valida por cliente)
  const service = createServiceClient()
  const { data: creditoCli } = await service
    .from('credito').select('id_cliente').eq('id_credito', creditoId).maybeSingle()
  if (!creditoCli || creditoCli.id_cliente !== clienteId) {
    return NextResponse.json({ error: 'El crédito no corresponde al cliente' }, { status: 400 })
  }

  // Verificar que el cliente esté asignado a este asesor (solo para rol ASESOR)
  if (rol === 'ASESOR') {
    const { data: asignacion } = await supabase
      .from('asignacion_asesor')
      .select('id_asignacion')
      .eq('id_asesor', user.id)
      .eq('id_cliente', clienteId)
      .eq('activa', true)
      .single()

    if (!asignacion) {
      return NextResponse.json({ error: 'Este cliente no está asignado a tu cartera' }, { status: 403 })
    }
  }

  // 1. Registrar la gestión
  const { error: gestionErr } = await supabase
    .from('gestion_cobranza')
    .insert({
      id_credito:      creditoId,
      id_cliente:      clienteId,
      id_asesor:       user.id,
      tipo_gestion,
      resultado,
      observaciones:   observaciones || null,
      monto_prometido: monto_prometido || null,
      fecha_promesa:   fecha_promesa   || null,
      monto_recibido:  monto_recibido  || null,
      fecha_gestion:   new Date().toISOString(),
    })

  if (gestionErr) {
    console.error('[Gestión cobranza]', gestionErr)
    return NextResponse.json({ error: 'Error al registrar la gestión' }, { status: 500 })
  }

  // 2. Pago en efectivo (J-06/J-07, decisión de negocio 29-oct-2026): se aplica
  //    a las cuotas VENCIDAS de la más antigua a la más reciente; en cada una
  //    primero interés y luego capital; el excedente queda como saldo a favor.
  //    Antes solo se insertaba el pago: cuota y crédito nunca se actualizaban.
  if (esPago) {
    const resultadoPago = await aplicarPagoEfectivo(service, { creditoId, idAsesor: user.id, monto: montoEfectivo })
    if (resultadoPago.error) {
      return NextResponse.json({ error: resultadoPago.error }, { status: resultadoPago.status })
    }
    return NextResponse.json({ ok: true, pago: resultadoPago })
  }

  return NextResponse.json({ ok: true })
}

async function aplicarPagoEfectivo(db, { creditoId, idAsesor, monto }) {
  const ahora = new Date().toISOString()
  const hoy   = ahora.split('T')[0]

  const { data: plan } = await db
    .from('plan_pago').select('id_plan_pago').eq('id_credito', creditoId).maybeSingle()
  if (!plan) return { error: 'El crédito no tiene plan de pagos', status: 409 }

  const { data: cuotas } = await db
    .from('cuota')
    .select('id_cuota, numero_cuota, estado_cuota, fecha_vencimiento, monto_capital, monto_interes, monto_pagado_real')
    .eq('id_plan_pago', plan.id_plan_pago)
    .in('estado_cuota', ['VENCIDA', 'PENDIENTE'])
    .order('fecha_vencimiento', { ascending: true })
  const abiertas = (cuotas ?? []).slice()
    .sort((a, b) => String(a.fecha_vencimiento).localeCompare(String(b.fecha_vencimiento)))
  if (!abiertas.length) return { error: 'El crédito no tiene cuotas por pagar', status: 409 }
  const vencidas = abiertas.filter(c => c.estado_cuota === 'VENCIDA')

  // Abonos parciales previos: se leen de cuota.monto_pagado_real, que solo el
  // servidor puede escribir (no hay política UPDATE/INSERT en cuota). NO se
  // usa la tabla pago: el cliente puede insertar filas ahí vía RLS
  // (registrar_pago_autenticado) y falsear un abono. Con la regla "interés
  // primero", el reparto de lo ya abonado es determinista.
  const abonado = {}
  for (const c of vencidas) {
    const pagado  = Number(c.monto_pagado_real ?? 0)
    const interes = Math.min(pagado, Number(c.monto_interes))
    abonado[c.id_cuota] = { interes, capital: Math.max(0, pagado - interes), total: pagado }
  }

  const { aplicaciones, excedente } = distribuirPagoEfectivo(monto, vencidas.map(c => ({
    ...c,
    capital_pagado: abonado[c.id_cuota].capital,
    interes_pagado: abonado[c.id_cuota].interes,
  })))

  // Un recibo por cuota tocada; el excedente se anota en el último (o, si no
  // hubo cuotas vencidas, en la próxima cuota pendiente como ancla).
  const recibos = aplicaciones.map(a => ({ id_cuota: a.id_cuota, monto: a.interes + a.capital, capital: a.capital, interes: a.interes, delta: 0 }))
  if (excedente > 0) {
    if (recibos.length) recibos[recibos.length - 1].delta = excedente
    else recibos.push({ id_cuota: abiertas[0].id_cuota, monto: 0, capital: 0, interes: 0, delta: excedente })
  }
  const base = `EFE-${idAsesor.slice(0, 6).toUpperCase()}-${Date.now()}`
  for (const [i, r] of recibos.entries()) {
    const { error } = await db.from('pago').insert({
      id_cuota:            r.id_cuota,
      id_credito:          creditoId,
      id_usuario_receptor: idAsesor,
      monto_pagado:        Math.round((r.monto + r.delta) * 100) / 100,
      monto_capital:       r.capital,
      monto_interes:       r.interes,
      monto_mora:          0,
      metodo_pago:         'EFECTIVO',
      referencia_externa:  `${base}-${i + 1}`,
      estado:              'CONFIRMADO',
      fecha_pago:          ahora,
      saldo_a_favor_delta: r.delta || null,
    })
    if (error) {
      console.error('[Pago efectivo] Error registrando recibo:', error.message)
      return { error: 'No se pudo registrar el pago', status: 500 }
    }
  }

  // Avance de cada cuota tocada; las completadas → PAGADA. Condicional a que
  // sigan VENCIDA y a que el abono previo no haya cambiado (evita carreras).
  let completadas = 0
  let capitalAplicado = 0
  for (const a of aplicaciones) {
    const previo = abonado[a.id_cuota].total
    const nuevoPagado = Math.round((previo + a.interes + a.capital) * 100) / 100
    const cambios = a.completa
      ? { estado_cuota: 'PAGADA', monto_pagado_real: nuevoPagado, fecha_pago_real: hoy, updated_at: ahora }
      : { monto_pagado_real: nuevoPagado, updated_at: ahora }
    let q = db.from('cuota').update(cambios).eq('id_cuota', a.id_cuota).in('estado_cuota', ['VENCIDA'])
    q = previo > 0 ? q.eq('monto_pagado_real', previo) : q
    const { data: filas } = await q.select('id_cuota')
    if (!filas?.length) {
      console.error(`[Pago efectivo] REVISION MANUAL: cuota ${a.id_cuota} cambió durante el registro`)
    } else {
      capitalAplicado += a.capital
      if (a.completa) completadas++
    }
  }

  const { data: credito } = await db
    .from('credito')
    .select('saldo_pendiente, cuotas_pagadas, cuotas_en_mora, estado_credito, saldo_a_favor')
    .eq('id_credito', creditoId)
    .maybeSingle()
  if (credito) {
    const nuevoSaldo  = Math.max(0, Math.round((Number(credito.saldo_pendiente) - capitalAplicado) * 100) / 100)
    const nuevoEnMora = Math.max(0, Number(credito.cuotas_en_mora ?? 0) - completadas)
    await db
      .from('credito')
      .update({
        saldo_pendiente: nuevoSaldo,
        cuotas_pagadas:  Number(credito.cuotas_pagadas ?? 0) + completadas,
        cuotas_en_mora:  nuevoEnMora,
        saldo_a_favor:   Math.round((Number(credito.saldo_a_favor ?? 0) + excedente) * 100) / 100,
        estado_credito:  nuevoEstadoCredito(nuevoSaldo, nuevoEnMora, credito.estado_credito),
        updated_at:      ahora,
      })
      .eq('id_credito', creditoId)
  }

  return { cuotasCompletadas: completadas, capitalAplicado, saldoAFavor: excedente }
}
