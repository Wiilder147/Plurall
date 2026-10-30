/* ==========================================================================
 * ARCHIVO: route.js
 * RUTA: apps/web/app/api/admin/solicitud/[id]/route.js
 * DESCRIPCIÓN: Endpoint de API (Backend) para manejar la lógica de [id]
 * FUNCIONALIDAD: Este archivo define la lógica y estructura para su respectivo módulo.
 * ========================================================================== */
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { calcularAmortizacion, validarCondicionesAprobacion } from '@/lib/calculadora'
import { formatNombre } from '@/lib/nombre'
import { tieneKycRechazado, MENSAJE_KYC_RECHAZADO } from '@/lib/kyc'
import { resolverMotivoRechazo, textoMotivoCliente } from '@/lib/motivos'
import {
  notificarSolicitudAprobada,
  notificarSolicitudRechazada,
} from '@/lib/notificaciones'

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
  if (!['ADMIN', 'SUPERVISOR'].includes(nombreRol)) {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
  }

  const { id } = await params
  const body   = await request.json()
  const { accion, monto_aprobado, plazo_aprobado, tasa_interes_aprobada,
          comentarios_cliente, comentarios_tecnicos } = body

  if (!['APROBAR', 'RECHAZAR'].includes(accion)) {
    return NextResponse.json({ error: 'Acción inválida' }, { status: 400 })
  }

  // M-17: no registrar aprobaciones con condiciones imposibles (plazo negativo, NaN…)
  if (accion === 'APROBAR') {
    const errores = validarCondicionesAprobacion({
      monto: monto_aprobado, plazo: plazo_aprobado, tasaEM: tasa_interes_aprobada,
    })
    if (errores.length) {
      return NextResponse.json({ error: errores.map(e => e.mensaje).join(' '), errores }, { status: 400 })
    }
  }

  const service = getServiceClient()

  // Obtener solicitud + datos del cliente para la notificación
  const { data: sol } = await service
    .from('solicitud_credito')
    .select(`
      id_solicitud, id_cliente, id_estado_solicitud, estado_solicitud(nombre),
      monto_solicitado, plazo_meses,
      cliente ( primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, email )
    `)
    .eq('id_solicitud', id)
    .single()

  if (!sol) return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 })

  const estadoActual = sol.estado_solicitud?.nombre?.toUpperCase()
  if (!['PENDIENTE', 'EN_ESTUDIO'].includes(estadoActual)) {
    return NextResponse.json({ error: 'La solicitud ya fue procesada' }, { status: 409 })
  }
  if (accion === 'APROBAR' && await tieneKycRechazado(service, sol.id_cliente)) {
    return NextResponse.json({ error: MENSAJE_KYC_RECHAZADO }, { status: 409 })
  }

  // M-09: el rechazo usa un motivo ACTIVO del catálogo (antes una lista fija)
  let motivo = null
  if (accion === 'RECHAZAR') {
    const r = await resolverMotivoRechazo(service, body.id_motivo_rechazo)
    if (r.error) return NextResponse.json({ error: r.error }, { status: 400 })
    motivo = r.motivo
  }
  const comentarioCliente = accion === 'RECHAZAR' ? textoMotivoCliente(motivo) : comentarios_cliente

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
    comentarios_cliente:  comentarioCliente,
    comentarios_tecnicos,
    id_motivo_rechazo:    motivo?.id_motivo ?? null,
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
      id_estado_solicitud:  estadoRow.id_estado_solicitud,
      id_usuario_evaluador: user.id,
      fecha_decision:       new Date().toISOString(),
      comentarios_analista: comentarios_tecnicos,
      ...(motivo ? { id_motivo_rechazo: motivo.id_motivo } : {}),
      updated_at:           new Date().toISOString(),
    })
    .eq('id_solicitud', id)

  // ── Notificación por email al cliente ────────────────────────
  const clienteEmail = sol.cliente?.email
  const clienteNombre = formatNombre(sol.cliente)

  if (clienteEmail) {
    if (accion === 'APROBAR') {
      // Calcular cuota estimada para el email
      const tasaEA = monto_aprobado && tasa_interes_aprobada
        ? (Math.pow(1 + tasa_interes_aprobada, 12) - 1) * 100
        : 28
      const { cuotaMensual } = calcularAmortizacion(
        monto_aprobado || sol.monto_solicitado,
        tasaEA,
        plazo_aprobado || sol.plazo_meses,
      )
      notificarSolicitudAprobada({
        email:             clienteEmail,
        nombre:            clienteNombre,
        solicitudId:       id,
        montoAprobado:     monto_aprobado,
        plazoAprobado:     plazo_aprobado,
        cuotaFija:         cuotaMensual,
        comentariosCliente: comentarios_cliente,
      }).catch(err => console.error('[Notif] Error email aprobación:', err))
    } else {
      notificarSolicitudRechazada({
        email:             clienteEmail,
        nombre:            clienteNombre,
        solicitudId:       id,
        comentariosCliente: comentarioCliente,
      }).catch(err => console.error('[Notif] Error email rechazo:', err))
    }
  }

  return NextResponse.json({ ok: true, resultado: nuevoEstadoNombre })
}
