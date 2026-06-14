/* ==========================================================================
 * ARCHIVO: route.js
 * RUTA: apps/web/app/api/supervisor/motivos/route.js
 * DESCRIPCIÓN: API del catálogo de motivos de rechazo.
 * FUNCIONALIDAD: POST crea un motivo; PATCH activa/desactiva uno existente.
 *                Solo ADMIN y SUPERVISOR. Usa service client tras validar rol.
 * ========================================================================== */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

async function validarRol() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return { ok: false, status: 401, msg: 'No autorizado' }
  const { data: perfil } = await supabase
    .from('perfil_usuario')
    .select('rol ( nombre_rol )')
    .eq('id', user.id)
    .single()
  const rol = perfil?.rol?.nombre_rol?.toUpperCase()
  if (!['ADMIN', 'SUPERVISOR'].includes(rol)) return { ok: false, status: 403, msg: 'Acceso denegado' }
  return { ok: true }
}

export async function POST(request) {
  const v = await validarRol()
  if (!v.ok) return NextResponse.json({ error: v.msg }, { status: v.status })

  const { descripcion_motivo, visible_cliente = true } = await request.json()
  if (!descripcion_motivo?.trim()) {
    return NextResponse.json({ error: 'La descripción es obligatoria' }, { status: 400 })
  }

  const service = getServiceClient()
  const { error } = await service.from('motivo_rechazo').insert({
    descripcion_motivo: descripcion_motivo.trim(),
    visible_cliente,
    activo: true,
  })
  if (error) {
    console.error('[motivos POST]', error)
    return NextResponse.json({ error: 'No se pudo crear el motivo' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

export async function PATCH(request) {
  const v = await validarRol()
  if (!v.ok) return NextResponse.json({ error: v.msg }, { status: v.status })

  const { id_motivo, activo } = await request.json()
  if (!id_motivo) return NextResponse.json({ error: 'id_motivo requerido' }, { status: 400 })

  const service = getServiceClient()
  const { error } = await service
    .from('motivo_rechazo')
    .update({ activo: !!activo })
    .eq('id_motivo', id_motivo)
  if (error) {
    console.error('[motivos PATCH]', error)
    return NextResponse.json({ error: 'No se pudo actualizar el motivo' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
