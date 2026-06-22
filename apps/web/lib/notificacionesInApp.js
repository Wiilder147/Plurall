import { createServiceClient } from '@/lib/supabase/service'

export async function crearNotificacionStaff({
  idUsuario,
  codigoTipo = 'GENERAL',
  titulo,
  mensaje,
  metadata = {},
}) {
  if (!idUsuario) return { ok: false }
  try {
    const supabase = createServiceClient()
    const { error } = await supabase.from('notificacion_staff').insert({
      id_usuario: idUsuario,
      codigo_tipo: codigoTipo,
      titulo,
      mensaje,
      metadata,
      leida: false,
    })
    return { ok: !error, error: error?.message }
  } catch (e) {
    return { ok: false, error: e.message }
  }
}

export async function registrarNotificacionCliente({
  idCliente,
  codigoTipo,
  destinatario,
  asunto,
  cuerpo,
  idCredito,
  idSolicitud,
  estadoEnvio = 'ENVIADO',
  referenciaProveedor,
}) {
  if (!idCliente) return
  try {
    const supabase = createServiceClient()
    const { data: tipo } = await supabase
      .from('tipo_notificacion')
      .select('id_tipo_notif')
      .eq('codigo', codigoTipo)
      .maybeSingle()

    if (!tipo?.id_tipo_notif) return

    await supabase.from('notificacion').insert({
      id_cliente: idCliente,
      id_tipo_notif: tipo.id_tipo_notif,
      id_credito: idCredito || null,
      id_solicitud: idSolicitud || null,
      canal: 'EMAIL',
      destinatario: destinatario || '—',
      asunto,
      cuerpo,
      estado_envio: estadoEnvio,
      proveedor: 'RESEND',
      referencia_proveedor: referenciaProveedor || null,
      enviado_at: new Date().toISOString(),
    })
  } catch (e) {
    console.warn('[notificacion cliente]', e.message)
  }
}

export async function notificarAsesorCliente(clienteId, payload) {
  const supabase = createServiceClient()
  const { data: asig } = await supabase
    .from('asignacion_asesor')
    .select('id_asesor, cliente(nombre_completo)')
    .eq('id_cliente', clienteId)
    .eq('activa', true)
    .maybeSingle()
  if (!asig?.id_asesor) return

  const nombre = asig.cliente?.nombre_completo || 'Cliente'
  return crearNotificacionStaff({
    idUsuario: asig.id_asesor,
    codigoTipo: payload.codigoTipo || 'MORA_ASESOR',
    titulo: payload.titulo || `Cliente en mora: ${nombre}`,
    mensaje: payload.mensaje || `${nombre} requiere gestión de cobranza.`,
    metadata: { id_cliente: clienteId, ...payload.metadata },
  })
}

export async function getClienteIdByUserId(userId) {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('cliente')
    .select('id_cliente, email, telefono')
    .eq('id_usuario_cuenta', userId)
    .maybeSingle()
  return data
}
