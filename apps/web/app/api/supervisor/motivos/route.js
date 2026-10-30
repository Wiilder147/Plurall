/* ==========================================================================
 * ARCHIVO: route.js
 * RUTA: apps/web/app/api/supervisor/motivos/route.js
 * DESCRIPCIÓN: API del catálogo de motivos de rechazo.
 * FUNCIONALIDAD: POST crea un motivo; PATCH activa/desactiva uno existente.
 *                Solo ADMIN y SUPERVISOR. Usa service client tras validar rol.
 * ========================================================================== */
import { NextResponse } from 'next/server'
import { validarTextoLibre, REGLAS_TEXTO } from '@/lib/validacion'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

// Comparación de nombres de motivo ignorando mayúsculas y espacios (M-12)
const normalizarMotivo = (t) => String(t ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('es')

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

  const { descripcion_motivo, visible_cliente = false } = await request.json()
  if (!descripcion_motivo?.trim()) {
    return NextResponse.json({ error: 'La descripción es obligatoria' }, { status: 400 })
  }
  const errorTexto = validarTextoLibre(descripcion_motivo, REGLAS_TEXTO.motivoCatalogo)
  if (errorTexto) return NextResponse.json({ error: errorTexto }, { status: 400 })

  const service = getServiceClient()

  // M-12: no duplicar un motivo existente (ignorando mayúsculas y espacios)
  const { data: existentes } = await service.from('motivo_rechazo').select('descripcion_motivo')
  if ((existentes ?? []).some(m => normalizarMotivo(m.descripcion_motivo) === normalizarMotivo(descripcion_motivo))) {
    return NextResponse.json({ error: 'Este motivo ya existe' }, { status: 409 })
  }

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

  const { id_motivo, activo, descripcion_motivo, visible_cliente } = await request.json()
  if (!id_motivo) return NextResponse.json({ error: 'id_motivo requerido' }, { status: 400 })

  const service = getServiceClient()
  const cambios = {}
  if (activo !== undefined) cambios.activo = !!activo
  if (visible_cliente !== undefined) cambios.visible_cliente = !!visible_cliente

  // M-10: el nombre del motivo ahora se puede corregir, con las mismas reglas
  if (descripcion_motivo !== undefined) {
    const errorTexto = validarTextoLibre(descripcion_motivo, REGLAS_TEXTO.motivoCatalogo)
    if (errorTexto) return NextResponse.json({ error: errorTexto }, { status: 400 })
    const { data: existentes } = await service.from('motivo_rechazo').select('id_motivo, descripcion_motivo')
    if ((existentes ?? []).some(m => m.id_motivo !== id_motivo && normalizarMotivo(m.descripcion_motivo) === normalizarMotivo(descripcion_motivo))) {
      return NextResponse.json({ error: 'Este motivo ya existe' }, { status: 409 })
    }
    cambios.descripcion_motivo = descripcion_motivo.trim()
  }
  if (!Object.keys(cambios).length) return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 })

  const { error } = await service
    .from('motivo_rechazo')
    .update(cambios)
    .eq('id_motivo', id_motivo)
  if (error) {
    console.error('[motivos PATCH]', error)
    return NextResponse.json({ error: 'No se pudo actualizar el motivo' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
