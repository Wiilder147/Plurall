/* ==========================================================================
 * ARCHIVO: route.js
 * RUTA: apps/web/app/api/asesor/gestion/route.js
 * DESCRIPCIÓN: Endpoint de API (Backend) para manejar la lógica de gestion
 * FUNCIONALIDAD: Este archivo define la lógica y estructura para su respectivo módulo.
 * ========================================================================== */
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

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

  // 2. Si es pago en efectivo, registrar en tabla pago
  if (resultado === 'PAGO_RECIBIDO' && monto_recibido > 0) {
    // Buscar la cuota más antigua vencida para aplicar el pago
    const { data: plan } = await supabase
      .from('plan_pago')
      .select('id_plan_pago')
      .eq('id_credito', creditoId)
      .single()

    if (plan) {
      const { data: cuotaVencida } = await supabase
        .from('cuota')
        .select('id_cuota, monto_capital, monto_interes, monto_total_cuota')
        .eq('id_plan_pago', plan.id_plan_pago)
        .eq('estado_cuota', 'VENCIDA')
        .order('fecha_vencimiento', { ascending: true })
        .limit(1)
        .single()

      if (cuotaVencida) {
        await supabase.from('pago').insert({
          id_cuota:           cuotaVencida.id_cuota,
          id_credito:         creditoId,
          id_usuario_receptor: user.id,
          monto_pagado:       monto_recibido,
          monto_capital:      Math.min(monto_recibido, cuotaVencida.monto_capital),
          monto_interes:      cuotaVencida.monto_interes,
          monto_mora:         Math.max(0, monto_recibido - cuotaVencida.monto_total_cuota),
          metodo_pago:        'EFECTIVO',
          referencia_externa: `EFE-${user.id.slice(0,6).toUpperCase()}-${Date.now()}`,
          estado:             'CONFIRMADO',
          fecha_pago:         new Date().toISOString(),
        })
      }
    }
  }

  return NextResponse.json({ ok: true })
}
