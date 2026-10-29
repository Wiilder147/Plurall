import { NextResponse } from 'next/server'
import { tieneKycRechazado, MENSAJE_KYC_RECHAZADO } from '@/lib/kyc'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

/**
 * PATCH /api/asesor/solicitudes/:id
 * Body: { accion: 'PRE_APROBAR' | 'RECHAZAR', notas: string }
 *
 * Permite al asesor mover una solicitud PENDIENTE a EN_ESTUDIO (pre-aprobada)
 * o a RECHAZADA. El supervisor luego aprueba el desembolso desde /admin.
 */
export async function PATCH(request, { params }) {
  const supabase = await createClient()

  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: perfil } = await supabase
    .from('perfil_usuario')
    .select('rol ( nombre_rol )')
    .eq('id', user.id)
    .single()

  const rol = perfil?.rol?.nombre_rol?.toUpperCase()
  if (!['ASESOR', 'SUPERVISOR', 'ADMIN'].includes(rol)) {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
  }

  const { id } = await params
  const body   = await request.json()
  const { accion, notas = '' } = body

  if (!['PRE_APROBAR', 'RECHAZAR'].includes(accion)) {
    return NextResponse.json({ error: 'Acción inválida' }, { status: 400 })
  }

  const service = getServiceClient()

  // Verificar que la solicitud existe y está en PENDIENTE
  const { data: sol } = await service
    .from('solicitud_credito')
    .select('id_solicitud, id_cliente, estado_solicitud ( nombre )')
    .eq('id_solicitud', id)
    .single()

  if (!sol) return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 })

  const estadoActual = sol.estado_solicitud?.nombre?.toUpperCase()
  if (estadoActual !== 'PENDIENTE') {
    return NextResponse.json({ error: 'Solo se pueden gestionar solicitudes en estado PENDIENTE' }, { status: 409 })
  }

  if (accion === 'PRE_APROBAR' && await tieneKycRechazado(service, sol.id_cliente)) {
    return NextResponse.json({ error: MENSAJE_KYC_RECHAZADO }, { status: 409 })
  }

  // Determinar estado destino
  const nuevoEstadoNombre = accion === 'PRE_APROBAR' ? 'EN_ESTUDIO' : 'RECHAZADA'

  const { data: estadoRow } = await service
    .from('estado_solicitud')
    .select('id_estado_solicitud')
    .ilike('nombre', nuevoEstadoNombre)
    .single()

  if (!estadoRow) {
    return NextResponse.json({ error: 'Estado destino no encontrado en la BD' }, { status: 500 })
  }

  const { error: updErr } = await service
    .from('solicitud_credito')
    .update({
      id_estado_solicitud:  estadoRow.id_estado_solicitud,
      id_usuario_evaluador: user.id,
      comentarios_analista: notas || null,
      updated_at:           new Date().toISOString(),
    })
    .eq('id_solicitud', id)

  if (updErr) {
    console.error('[Asesor solicitud PATCH]', updErr)
    return NextResponse.json({ error: 'Error al actualizar la solicitud' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, nuevoEstado: nuevoEstadoNombre })
}
