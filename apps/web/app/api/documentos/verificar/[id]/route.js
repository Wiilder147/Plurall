/* ==========================================================================
 * ARCHIVO: route.js
 * RUTA: apps/web/app/api/documentos/verificar/[id]/route.js
 * DESCRIPCIÓN: Verificación de documentos KYC por parte del staff.
 * FUNCIONALIDAD: PATCH /api/documentos/verificar/:idDocumento
 *   Permite a ADMIN/SUPERVISOR/ASESOR marcar un documento como APROBADO o
 *   RECHAZADO (con motivo), registrando quién y cuándo.
 * ========================================================================== */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { rechazarSolicitudesPorKyc } from '@/lib/kyc'

const STAFF = ['ADMIN', 'SUPERVISOR', 'ASESOR']
const ESTADOS = ['PENDIENTE', 'APROBADO', 'RECHAZADO']

export async function PATCH(request, { params }) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: perfil } = await supabase
    .from('perfil_usuario').select('rol ( nombre_rol )').eq('id', user.id).single()
  const rol = perfil?.rol?.nombre_rol?.toUpperCase()
  if (!STAFF.includes(rol)) return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })

  const { id } = await params
  const { estado, motivo = '' } = await request.json()
  if (!ESTADOS.includes(String(estado).toUpperCase())) {
    return NextResponse.json({ error: 'Estado inválido' }, { status: 400 })
  }
  const estadoFinal = String(estado).toUpperCase()
  if (estadoFinal === 'RECHAZADO' && !motivo.trim()) {
    return NextResponse.json({ error: 'Indica el motivo del rechazo' }, { status: 400 })
  }

  const service = createServiceClient()
  const { error } = await service
    .from('documento_cliente')
    .update({
      estado_verificacion: estadoFinal,
      motivo_rechazo_doc: estadoFinal === 'RECHAZADO' ? motivo.trim() : null,
      verificado_por: user.id,
      verificado_at: new Date().toISOString(),
    })
    .eq('id_documento', id)

  if (error) {
    console.error('[Verificar doc]', error)
    return NextResponse.json({ error: 'No se pudo actualizar el documento' }, { status: 500 })
  }

  // M-01 (decisión de negocio 29-oct-2026): documento rechazado → la solicitud
  // de crédito activa del cliente se rechaza automáticamente.
  let solicitudesRechazadas = 0
  if (estadoFinal === 'RECHAZADO') {
    const { data: doc } = await service
      .from('documento_cliente').select('id_cliente').eq('id_documento', id).maybeSingle()
    if (doc?.id_cliente) {
      solicitudesRechazadas = await rechazarSolicitudesPorKyc(service, {
        idCliente: doc.id_cliente, idUsuario: user.id, motivo: motivo.trim(),
      })
    }
  }
  return NextResponse.json({ ok: true, estado: estadoFinal, solicitudesRechazadas })
}
