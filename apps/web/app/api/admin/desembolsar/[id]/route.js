/* ==========================================================================
 * ARCHIVO: route.js
 * RUTA: apps/web/app/api/admin/desembolsar/[id]/route.js
 * DESCRIPCIÓN: Endpoint de API (Backend) para manejar la lógica de [id]
 * FUNCIONALIDAD: Este archivo define la lógica y estructura para su respectivo módulo.
 * ========================================================================== */
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { calcularAmortizacion } from '@/lib/calculadora'
import { notificarDesembolso } from '@/lib/notificaciones'

function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// POST /api/admin/desembolsar/:solicitudId
// Crea credito + plan_pago + cuotas a partir de una solicitud APROBADA
export async function POST(request, { params }) {
  const supabase = await createClient()

  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: perfil } = await supabase
    .from('perfil_usuario')
    .select('id_rol, rol ( nombre_rol )')
    .eq('id', user.id)
    .single()

  if (!['ADMIN', 'ANALISTA'].includes(perfil?.rol?.nombre_rol?.toUpperCase())) {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
  }

  const { id: solicitudId } = await params
  const service = getServiceClient()

  // Obtener la solicitud y su decisión aprobada (+ datos del cliente para email)
  const { data: sol } = await service
    .from('solicitud_credito')
    .select(`
      id_solicitud, id_cliente,
      estado_solicitud ( nombre ),
      decision_solicitud ( monto_aprobado, plazo_aprobado, tasa_interes_aprobada ),
      cliente ( nombre_completo, email )
    `)
    .eq('id_solicitud', solicitudId)
    .single()

  if (!sol) return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 })
  if (sol.estado_solicitud?.nombre?.toUpperCase() !== 'APROBADA') {
    return NextResponse.json({ error: 'La solicitud no está en estado APROBADA' }, { status: 409 })
  }

  // Verificar que no tenga crédito activo (RN-07)
  const { data: creditoExistente } = await service
    .from('credito')
    .select('id_credito')
    .eq('id_cliente', sol.id_cliente)
    .in('estado_credito', ['ACTIVO', 'EN_MORA'])
    .single()

  if (creditoExistente) {
    return NextResponse.json({ error: 'El cliente ya tiene un crédito activo (RN-07)' }, { status: 409 })
  }

  const decision = sol.decision_solicitud?.[0]
  if (!decision) return NextResponse.json({ error: 'No hay decisión de aprobación registrada' }, { status: 400 })

  const monto  = decision.monto_aprobado
  const plazo  = decision.plazo_aprobado
  const tasaEM = decision.tasa_interes_aprobada            // tasa efectiva mensual (decimal)
  const tasaEA = (Math.pow(1 + tasaEM, 12) - 1) * 100     // convertir a EA%

  // Calcular amortización
  const sim = calcularAmortizacion(monto, tasaEA, plazo)

  // Fechas
  const ahora       = new Date()
  const fechaDesemb = ahora.toISOString()
  const fechaPrimeraCuota = new Date(ahora.getFullYear(), ahora.getMonth() + 1, ahora.getDate())
  const fechaUltimaCuota  = new Date(ahora.getFullYear(), ahora.getMonth() + plazo, ahora.getDate())

  // 1. Crear crédito
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
      fecha_primera_cuota:  fechaPrimeraCuota.toISOString().split('T')[0],
      fecha_ultima_cuota:   fechaUltimaCuota.toISOString().split('T')[0],
      estado_credito:       'ACTIVO',
      saldo_pendiente:      monto,
      cuotas_pagadas:       0,
      cuotas_en_mora:       0,
    })
    .select('id_credito')
    .single()

  if (creditoErr) {
    console.error('[Desembolso] Error al crear crédito:', creditoErr)
    return NextResponse.json({ error: 'Error al crear el crédito' }, { status: 500 })
  }

  // 2. Crear plan de pago
  const { data: planPago, error: planErr } = await service
    .from('plan_pago')
    .insert({
      id_credito:         credito.id_credito,
      num_cuotas_totales: plazo,
      frecuencia_pago:    'MENSUAL',
      fecha_inicio_cobro: fechaPrimeraCuota.toISOString().split('T')[0],
      fecha_fin_cobro:    fechaUltimaCuota.toISOString().split('T')[0],
      tasa_mora_diaria:   0.001,
    })
    .select('id_plan_pago')
    .single()

  if (planErr) {
    console.error('[Desembolso] Error al crear plan de pago:', planErr)
    return NextResponse.json({ error: 'Error al crear plan de pago' }, { status: 500 })
  }

  // 3. Crear cuotas individuales
  const cuotasInsert = sim.tablaCuotas.map((c, idx) => {
    const fechaVenc = new Date(
      fechaPrimeraCuota.getFullYear(),
      fechaPrimeraCuota.getMonth() + idx,
      fechaPrimeraCuota.getDate()
    )
    return {
      id_plan_pago:       planPago.id_plan_pago,
      numero_cuota:       c.numero,
      monto_capital:      c.capital,
      monto_interes:      c.interes,
      monto_total_cuota:  c.cuota,
      saldo_despues_pago: c.saldo,
      fecha_vencimiento:  fechaVenc.toISOString().split('T')[0],
      estado_cuota:       'PENDIENTE',
    }
  })

  const { error: cuotasErr } = await service.from('cuota').insert(cuotasInsert)

  if (cuotasErr) {
    console.error('[Desembolso] Error al crear cuotas:', cuotasErr)
    return NextResponse.json({ error: 'Error al crear el plan de cuotas' }, { status: 500 })
  }

  // 4. Actualizar estado de la solicitud a DESEMBOLSADA
  const { data: estadoDesemb } = await service
    .from('estado_solicitud')
    .select('id_estado_solicitud')
    .ilike('nombre', 'DESEMBOLSADA')
    .single()

  if (estadoDesemb) {
    await service
      .from('solicitud_credito')
      .update({
        id_estado_solicitud: estadoDesemb.id_estado_solicitud,
        updated_at:          new Date().toISOString(),
      })
      .eq('id_solicitud', solicitudId)
  }

  console.log(`[Desembolso] Crédito ${credito.id_credito} creado con ${plazo} cuotas.`)

  // ── Notificación por email al cliente ────────────────────────
  const clienteEmail  = sol.cliente?.email
  const clienteNombre = sol.cliente?.nombre_completo

  if (clienteEmail) {
    notificarDesembolso({
      email:            clienteEmail,
      nombre:           clienteNombre,
      creditoId:        credito.id_credito,
      monto,
      cuotaFija:        sim.cuotaMensual,
      numeroCuotas:     plazo,
      fechaPrimeraCuota: fechaPrimeraCuota.toISOString().split('T')[0],
    }).catch(err => console.error('[Notif] Error email desembolso:', err))
  }

  return NextResponse.json({
    ok:        true,
    creditoId: credito.id_credito,
    cuotas:    plazo,
    cuotaFija: sim.cuotaMensual,
  })
}
