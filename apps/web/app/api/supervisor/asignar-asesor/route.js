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

  // Upsert de la asignación (si ya existe, reactivar)
  const { error: upsertErr } = await service
    .from('asignacion_asesor')
    .upsert({
      id_asesor:        asesorId,
      id_cliente:       clienteId,
      activa:           true,
      fecha_asignacion: new Date().toISOString(),
    }, { onConflict: 'id_asesor,id_cliente' })

  if (upsertErr) {
    console.error('[Asignar asesor]', upsertErr)
    return NextResponse.json({ error: 'Error al asignar asesor' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
