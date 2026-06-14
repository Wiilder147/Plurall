/* ==========================================================================
 * ARCHIVO: route.js
 * RUTA: apps/web/app/api/pqr/[id]/route.js
 * DESCRIPCIÓN: API de PQR — gestión por parte del staff.
 * FUNCIONALIDAD: PATCH permite a ADMIN/SUPERVISOR/ASESOR responder y cambiar
 *                el estado de una PQR.
 * ========================================================================== */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const ESTADOS = ['ABIERTO', 'EN_PROCESO', 'RESUELTO', 'CERRADO']

export async function PATCH(request, { params }) {
  const supabase = await createClient()

  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: perfil } = await supabase
    .from('perfil_usuario').select('rol ( nombre_rol )').eq('id', user.id).single()
  const rol = perfil?.rol?.nombre_rol?.toUpperCase()
  if (!['ADMIN', 'SUPERVISOR', 'ASESOR'].includes(rol)) {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
  }

  const { id } = await params
  const { respuesta, estado } = await request.json()

  const patch = { updated_at: new Date().toISOString() }
  if (typeof respuesta === 'string' && respuesta.trim()) {
    patch.respuesta = respuesta.trim()
    patch.id_respondido_por = user.id
    patch.fecha_respuesta = new Date().toISOString()
  }
  if (estado && ESTADOS.includes(String(estado).toUpperCase())) {
    patch.estado = String(estado).toUpperCase()
  }

  const { error } = await supabase.from('pqr').update(patch).eq('id_pqr', id)
  if (error) {
    console.error('[PQR PATCH]', error)
    return NextResponse.json({ error: 'No se pudo actualizar la PQR' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
