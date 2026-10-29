/* ==========================================================================
 * ARCHIVO: route.js
 * RUTA: apps/web/app/api/admin/desembolsar/batch/route.js
 * DESCRIPCIÓN: Endpoint de API (Backend) para manejar la lógica de batch
 * FUNCIONALIDAD: Este archivo define la lógica y estructura para su respectivo módulo.
 * ========================================================================== */
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { calcularAmortizacion, fechasVencimientoMensual, validarCondicionesAprobacion } from '@/lib/calculadora'
import { notificarDesembolso } from '@/lib/notificaciones'
import { formatNombre } from '@/lib/nombre'

function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

/**
 * Lógica central de desembolso — reutilizable por el endpoint individual y el batch.
 * Crea credito + plan_pago + cuotas y actualiza el estado de la solicitud.
 * @returns { ok, creditoId, error }
 */
export async function desembolsarSolicitud(solicitudId, service) {
  // Obtener la solicitud y su decisión
  const { data: sol, error: solErr } = await service
    .from('solicitud_credito')
    .select(`
      id_solicitud, id_cliente,
      estado_solicitud ( nombre ),
      decision_solicitud ( monto_aprobado, plazo_aprobado, tasa_interes_aprobada ),
      cliente ( primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, email )
    `)
    .eq('id_solicitud', solicitudId)
    .single()

  if (solErr || !sol) return { ok: false, error: 'Solicitud no encontrada' }
  if (sol.estado_solicitud?.nombre?.toUpperCase() !== 'APROBADA') {
    return { ok: false, error: 'La solicitud no está en estado APROBADA' }
  }

  // Verificar crédito activo (RN-07)
  const { data: creditoExistente } = await service
    .from('credito')
    .select('id_credito')
    .eq('id_cliente', sol.id_cliente)
    .in('estado_credito', ['ACTIVO', 'EN_MORA'])
    .single()

  if (creditoExistente) return { ok: false, error: 'El cliente ya tiene un crédito activo' }

  const decision = sol.decision_solicitud?.[0]
  if (!decision) return { ok: false, error: 'Sin decisión de aprobación registrada' }

  const monto  = decision.monto_aprobado
  const plazo  = decision.plazo_aprobado
  const tasaEM = decision.tasa_interes_aprobada

  // M-18: no desembolsar decisiones con condiciones inválidas (p. ej. plazo -36)
  const erroresCond = validarCondicionesAprobacion({ monto: Number(monto), plazo, tasaEM: Number(tasaEM) })
  if (erroresCond.length) return { ok: false, error: erroresCond.map(e => e.mensaje).join(' ') }
  const tasaEA = (Math.pow(1 + tasaEM, 12) - 1) * 100

  const sim = calcularAmortizacion(monto, tasaEA, plazo)

  const ahora             = new Date()
  const fechaDesemb       = ahora.toISOString()
  // J-03: una cuota por mes calendario (sin desbordar días 29-31)
  const fechasVenc        = fechasVencimientoMensual(ahora, plazo)
  const fechaPrimeraCuota = fechasVenc[0]
  const fechaUltimaCuota  = fechasVenc[fechasVenc.length - 1]

  // 1. Crédito
  const { data: credito, error: creditoErr } = await service
    .from('credito')
    .insert({
      id_solicitud:         solicitudId,
      id_cliente:           sol.id_cliente,
      monto_desembolsado:   monto,
      tasa_interes_anual:   tasaEA,
      tasa_interes_mensual: tasaEM,
      numero_cuotas:        plazo,
      cuota_fija:           sim.cuotaMensual,
      fecha_desembolso:     fechaDesemb,
      fecha_primera_cuota:  fechaPrimeraCuota,
      fecha_ultima_cuota:   fechaUltimaCuota,
      estado_credito:       'ACTIVO',
      saldo_pendiente:      monto,
      cuotas_pagadas:       0,
      cuotas_en_mora:       0,
    })
    .select('id_credito')
    .single()

  if (creditoErr) return { ok: false, error: 'Error al crear el crédito: ' + creditoErr.message }

  // 2. Plan de pago
  const { data: planPago, error: planErr } = await service
    .from('plan_pago')
    .insert({
      id_credito:         credito.id_credito,
      num_cuotas_totales: plazo,
      frecuencia_pago:    'MENSUAL',
      fecha_inicio_cobro: fechaPrimeraCuota,
      fecha_fin_cobro:    fechaUltimaCuota,
      tasa_mora_diaria:   0.001,
    })
    .select('id_plan_pago')
    .single()

  if (planErr) return { ok: false, error: 'Error al crear plan de pago' }

  // 3. Cuotas
  const cuotasInsert = sim.tablaCuotas.map((c, idx) => {
    return {
      id_plan_pago:       planPago.id_plan_pago,
      numero_cuota:       c.numero,
      monto_capital:      c.capital,
      monto_interes:      c.interes,
      monto_total_cuota:  c.cuota,
      saldo_despues_pago: c.saldo,
      fecha_vencimiento:  fechasVenc[idx],
      estado_cuota:       'PENDIENTE',
    }
  })

  const { error: cuotasErr } = await service.from('cuota').insert(cuotasInsert)
  if (cuotasErr) return { ok: false, error: 'Error al crear cuotas' }

  // 4. Actualizar estado solicitud → DESEMBOLSADA
  const { data: estadoDesemb } = await service
    .from('estado_solicitud')
    .select('id_estado_solicitud')
    .ilike('nombre', 'DESEMBOLSADA')
    .single()

  if (estadoDesemb) {
    await service
      .from('solicitud_credito')
      .update({ id_estado_solicitud: estadoDesemb.id_estado_solicitud, updated_at: new Date().toISOString() })
      .eq('id_solicitud', solicitudId)
  }

  // 5. Notificación (fire-and-forget)
  if (sol.cliente?.email) {
    notificarDesembolso({
      email:            sol.cliente.email,
      nombre:           formatNombre(sol.cliente),
      creditoId:        credito.id_credito,
      monto,
      cuotaFija:        sim.cuotaMensual,
      numeroCuotas:     plazo,
      fechaPrimeraCuota: fechaPrimeraCuota,
    }).catch(err => console.error('[Notif Batch]', err))
  }

  return { ok: true, creditoId: credito.id_credito, cuotas: plazo }
}

/**
 * POST /api/admin/desembolsar/batch
 * Body: { solicitudIds: string[] }
 *
 * Desembolsa múltiples solicitudes APROBADAS en una sola operación.
 * Procesa cada una de forma independiente — si una falla, las demás continúan.
 * Solo accesible por ADMIN o SUPERVISOR.
 */
export async function POST(request) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()

  if (authErr || !user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: perfil } = await supabase
    .from('perfil_usuario')
    .select('rol ( nombre_rol )')
    .eq('id', user.id)
    .single()

  const rol = perfil?.rol?.nombre_rol?.toUpperCase()
  if (!['ADMIN', 'SUPERVISOR'].includes(rol)) {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
  }

  const body = await request.json()
  const { solicitudIds } = body

  if (!Array.isArray(solicitudIds) || solicitudIds.length === 0) {
    return NextResponse.json({ error: 'solicitudIds debe ser un arreglo no vacío' }, { status: 400 })
  }

  if (solicitudIds.length > 50) {
    return NextResponse.json({ error: 'Máximo 50 solicitudes por lote' }, { status: 400 })
  }

  const service  = getServiceClient()
  const exitosos = []
  const fallidos = []

  // Procesar en paralelo (máximo 5 concurrentes para no saturar la BD)
  const CHUNK = 5
  for (let i = 0; i < solicitudIds.length; i += CHUNK) {
    const chunk = solicitudIds.slice(i, i + CHUNK)
    const resultados = await Promise.allSettled(
      chunk.map(id => desembolsarSolicitud(id, service))
    )
    resultados.forEach((res, idx) => {
      const id = chunk[idx]
      if (res.status === 'fulfilled' && res.value.ok) {
        exitosos.push({ id, creditoId: res.value.creditoId })
      } else {
        const razon = res.status === 'rejected'
          ? res.reason?.message
          : res.value?.error
        fallidos.push({ id, razon })
        console.error(`[Batch Desembolso] Falló ${id}:`, razon)
      }
    })
  }

  console.log(`[Batch Desembolso] ${exitosos.length} exitosos, ${fallidos.length} fallidos`)

  return NextResponse.json({
    ok:       fallidos.length === 0,
    exitosos,
    fallidos,
    resumen:  `${exitosos.length} desembolsados, ${fallidos.length} con error`,
  }, { status: fallidos.length === solicitudIds.length ? 500 : 200 })
}
