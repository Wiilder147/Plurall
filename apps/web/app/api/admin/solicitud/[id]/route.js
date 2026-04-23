import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// PATCH /api/admin/solicitud/:id
// Body: { accion: 'APROBAR' | 'RECHAZAR', monto_aprobado?, plazo_aprobado?, tasa_interes_aprobada?, comentarios_cliente?, comentarios_tecnicos? }
export async function PATCH(request, { params }) {
  const supabase = await createClient()

  // Verificar que sea admin o analista
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: perfil } = await supabase
    .from('perfil_usuario')
    .select('id_rol, rol ( nombre_rol )')
    .eq('id', user.id)
    .single()

  const nombreRol = perfil?.rol?.nombre_rol?.toUpperCase()
  if (!['ADMIN', 'ANALISTA'].includes(nombreRol)) {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
  }

  const { id } = await params
  const body   = await request.json()
  const { accion, monto_aprobado, plazo_aprobado, tasa_interes_aprobada,
          comentarios_cliente, comentarios_tecnicos } = body

  if (!['APROBAR', 'RECHAZAR'].includes(accion)) {
    return NextResponse.json({ error: 'Acción inválida' }, { status: 400 })
  }

  const service = getServiceClient()

  // Obtener solicitud
  const { data: sol } = await service
    .from('solicitud_credito')
    .select('id_solicitud, id_cliente, id_estado_solicitud, estado_solicitud(nombre)')
    .eq('id_solicitud', id)
    .single()

  if (!sol) return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 })

  const estadoActual = sol.estado_solicitud?.nombre?.toUpperCase()
  if (!['PENDIENTE', 'EN_ESTUDIO'].includes(estadoActual)) {
    return NextResponse.json({ error: 'La solicitud ya fue procesada' }, { status: 409 })
  }

  // Obtener el estado destino
  const nuevoEstadoNombre = accion === 'APROBAR' ? 'APROBADA' : 'RECHAZADA'
  const { data: estadoRow } = await service
    .from('estado_solicitud')
    .select('id_estado_solicitud')
    .ilike('nombre', nuevoEstadoNombre)
    .single()

  if (!estadoRow) return NextResponse.json({ error: 'Estado destino no encontrado' }, { status: 500 })

  // Registrar decisión
  const { error: decisionErr } = await service.from('decision_solicitud').insert({
    id_solicitud:         id,
    id_analista:          user.id,
    resultado:            accion === 'APROBAR' ? 'APROBADO' : 'RECHAZADO',
    monto_aprobado:       accion === 'APROBAR' ? monto_aprobado : null,
    plazo_aprobado:       accion === 'APROBAR' ? plazo_aprobado : null,
    tasa_interes_aprobada: accion === 'APROBAR' ? tasa_interes_aprobada : null,
    comentarios_cliente,
    comentarios_tecnicos,
    fecha_decision:       new Date().toISOString(),
  })

  if (decisionErr) {
    console.error('[Admin] Error al registrar decisión:', decisionErr)
    return NextResponse.json({ error: 'Error al registrar decisión' }, { status: 500 })
  }

  // Actualizar estado de la solicitud
  await service
    .from('solicitud_credito')
    .update({
      id_estado_solicitud: estadoRow.id_estado_solicitud,
      id_usuario_evaluador: user.id,
      fecha_decision:      new Date().toISOString(),
      comentarios_analista: comentarios_tecnicos,
      updated_at:          new Date().toISOString(),
    })
    .eq('id_solicitud', id)

  return NextResponse.json({ ok: true, resultado: nuevoEstadoNombre })
}
