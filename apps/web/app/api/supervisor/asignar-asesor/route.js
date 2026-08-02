/* ==========================================================================
 * ARCHIVO: route.js
 * RUTA: apps/web/app/api/supervisor/asignar-asesor/route.js
 * DESCRIPCIÓN: Endpoint de API (Backend) para manejar la lógica de asignar-asesor
 * FUNCIONALIDAD: Este archivo define la lógica y estructura para su respectivo módulo.
 * ========================================================================== */
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

// POST /api/supervisor/asignar-asesor
// Body: { clienteId, asesorId }
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

  const { clienteId, asesorId } = await request.json()
  if (!clienteId || !asesorId) {
    return NextResponse.json({ error: 'clienteId y asesorId son requeridos' }, { status: 400 })
  }

  const service = getServiceClient()

  // Verificar que el asesor tenga rol ASESOR
  const { data: asesorPerfil } = await service
    .from('perfil_usuario')
    .select('rol ( nombre_rol )')
    .eq('id', asesorId)
    .single()

  if (asesorPerfil?.rol?.nombre_rol?.toUpperCase() !== 'ASESOR') {
    return NextResponse.json({ error: 'El usuario no tiene rol de ASESOR' }, { status: 400 })
  }

  // Asignación atómica (migración 22): cierra la asignación activa previa del
  // cliente y crea/reactiva la nueva en una sola transacción. Es obligatorio
  // pasar por el RPC porque existe un índice único parcial que impide que un
  // cliente tenga más de un asesor activo; un upsert directo fallaría (23505).
  const { error: rpcErr } = await service.rpc('asignar_asesor_a_cliente', {
    p_id_cliente: clienteId,
    p_id_asesor:  asesorId,
  })

  if (rpcErr) {
    console.error('[Asignar asesor]', rpcErr)
    return NextResponse.json({ error: 'Error al asignar asesor' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
