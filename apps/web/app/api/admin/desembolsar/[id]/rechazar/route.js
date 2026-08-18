/* ==========================================================================
 * ARCHIVO: route.js
 * RUTA: apps/web/app/api/admin/desembolsar/[id]/rechazar/route.js
 * DESCRIPCIÓN: Rechazo del desembolso de una solicitud APROBADA (ADMIN/SUPERVISOR).
 * FUNCIONALIDAD: POST /api/admin/desembolsar/:id/rechazar { motivo }
 *   Devuelve la solicitud aprobada al estado RECHAZADA (no se desembolsa) y
 *   registra el motivo. No crea crédito.
 * ========================================================================== */
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'

export async function POST(request, { params }) {
  const supabase = await createClient()

  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: perfil } = await supabase
    .from('perfil_usuario').select('rol ( nombre_rol )').eq('id', user.id).single()
  if (!['ADMIN', 'SUPERVISOR'].includes(perfil?.rol?.nombre_rol?.toUpperCase())) {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
  }

  const { id: solicitudId } = await params
  const { motivo } = await request.json().catch(() => ({}))
  if (!motivo || !String(motivo).trim()) {
    return NextResponse.json({ error: 'El motivo de rechazo es obligatorio.' }, { status: 422 })
  }

  const service = createServiceClient()

  const { data: sol } = await service
    .from('solicitud_credito')
    .select('id_solicitud, estado_solicitud ( nombre )')
    .eq('id_solicitud', solicitudId)
    .single()

  if (!sol) return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 })
  if (sol.estado_solicitud?.nombre?.toUpperCase() !== 'APROBADA') {
    return NextResponse.json({ error: 'Solo se puede rechazar el desembolso de una solicitud APROBADA.' }, { status: 409 })
  }

  const { data: estadoRech } = await service
    .from('estado_solicitud').select('id_estado_solicitud').ilike('nombre', 'RECHAZADA').single()
  if (!estadoRech) return NextResponse.json({ error: 'Estado RECHAZADA no configurado' }, { status: 500 })

  const { error: updErr } = await service
    .from('solicitud_credito')
    .update({ id_estado_solicitud: estadoRech.id_estado_solicitud, updated_at: new Date().toISOString() })
    .eq('id_solicitud', solicitudId)

  if (updErr) {
    console.error('[Rechazar desembolso]', updErr)
    return NextResponse.json({ error: 'No se pudo rechazar el desembolso' }, { status: 500 })
  }

  console.log(`[Desembolso] Solicitud ${solicitudId} RECHAZADA en desembolso por ${perfil?.rol?.nombre_rol}. Motivo: ${String(motivo).trim()}`)
  return NextResponse.json({ ok: true })
}
