/* ==========================================================================
 * ARCHIVO: route.js
 * RUTA: apps/web/app/api/admin/solicitud/[id]/mover/route.js
 * DESCRIPCIÓN: Mueve una solicitud de paso en el flujo (adelantar/retroceder).
 * FUNCIONALIDAD: PATCH /api/admin/solicitud/:id/mover  { direccion }
 *   direccion: 'adelantar' | 'retroceder'. Recorre el pipeline lineal
 *   PENDIENTE → EN_ESTUDIO → APROBADA. El desembolso (paso final) se hace con
 *   su propio botón porque genera el crédito. Solo ADMIN y SUPERVISOR.
 * ========================================================================== */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

const STAFF = ['ADMIN', 'SUPERVISOR']
const PIPELINE = ['PENDIENTE', 'EN_ESTUDIO', 'APROBADA']

export async function PATCH(request, { params }) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: perfil } = await supabase
    .from('perfil_usuario').select('rol ( nombre_rol )').eq('id', user.id).single()
  const rol = perfil?.rol?.nombre_rol?.toUpperCase()
  if (!STAFF.includes(rol)) return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })

  const { id } = await params
  const { direccion } = await request.json()
  if (!['adelantar', 'retroceder'].includes(direccion)) {
    return NextResponse.json({ error: 'Dirección inválida' }, { status: 400 })
  }

  const service = createServiceClient()

  const { data: sol } = await service
    .from('solicitud_credito')
    .select('id_solicitud, estado_solicitud ( nombre )')
    .eq('id_solicitud', id)
    .single()
  if (!sol) return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 })

  const actual = sol.estado_solicitud?.nombre?.toUpperCase()

  // El desembolso es un paso aparte (crea el crédito) — no se mueve manualmente.
  if (actual === 'DESEMBOLSADA') {
    return NextResponse.json({ error: 'La solicitud ya fue desembolsada; no se puede mover.' }, { status: 409 })
  }

  let destino
  const idx = PIPELINE.indexOf(actual)
  if (idx === -1) {
    // Estado fuera del pipeline (RECHAZADA/CANCELADA): retroceder lo reabre en PENDIENTE.
    if (direccion === 'retroceder') destino = 'PENDIENTE'
    else return NextResponse.json({ error: 'Esta solicitud no puede avanzar desde su estado actual.' }, { status: 409 })
  } else {
    const nuevoIdx = direccion === 'adelantar' ? idx + 1 : idx - 1
    if (nuevoIdx < 0) return NextResponse.json({ error: 'La solicitud ya está en el primer paso.' }, { status: 409 })
    if (nuevoIdx >= PIPELINE.length) {
      return NextResponse.json({ error: 'Para el paso final usa el botón de Desembolso.' }, { status: 409 })
    }
    destino = PIPELINE[nuevoIdx]
  }

  const { data: estadoRow } = await service
    .from('estado_solicitud').select('id_estado_solicitud').ilike('nombre', destino).single()
  if (!estadoRow) return NextResponse.json({ error: 'Estado destino no encontrado' }, { status: 500 })

  const { error: updErr } = await service
    .from('solicitud_credito')
    .update({ id_estado_solicitud: estadoRow.id_estado_solicitud, updated_at: new Date().toISOString() })
    .eq('id_solicitud', id)
  if (updErr) {
    console.error('[Mover solicitud]', updErr)
    return NextResponse.json({ error: 'No se pudo mover la solicitud' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, estado: destino })
}
