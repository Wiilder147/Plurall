import { calcularAmortizacion } from './calculadora'

/**
 * Solicitud APROBADA que aún no tiene crédito desembolsado.
 * Retorna null si no hay ninguna en ese estado.
 */
export async function getSolicitudAprobadaPendiente(supabase, idCliente) {
  if (!idCliente) return null

  const { data } = await supabase
    .from('solicitud_credito')
    .select(`
      id_solicitud, monto_solicitado, plazo_meses, fecha_decision,
      estado_solicitud!inner ( nombre ),
      decision_solicitud ( monto_aprobado, plazo_aprobado, tasa_interes_aprobada, comentarios_cliente )
    `)
    .eq('id_cliente', idCliente)
    .eq('estado_solicitud.nombre', 'APROBADA')
    .order('fecha_solicitud', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data) return null

  const decision = Array.isArray(data.decision_solicitud)
    ? data.decision_solicitud[0]
    : data.decision_solicitud

  const monto = decision?.monto_aprobado ?? data.monto_solicitado
  const plazo = decision?.plazo_aprobado ?? data.plazo_meses
  const tasaEA = decision?.tasa_interes_aprobada
    ? (Math.pow(1 + decision.tasa_interes_aprobada, 12) - 1) * 100
    : 28
  const { cuotaMensual } = calcularAmortizacion(monto, tasaEA, plazo)

  return {
    idSolicitud: data.id_solicitud,
    monto,
    plazo,
    cuotaEstimada: cuotaMensual,
    fechaDecision: data.fecha_decision,
    mensajeAnalista: decision?.comentarios_cliente ?? null,
  }
}

/**
 * Última solicitud del cliente (cualquier estado) con su motivo de rechazo
 * cuando aplica. Sirve para decidir qué pantalla mostrar en el Home:
 *  - RECHAZADA  → agradecimiento + motivo disimulado + reintento a los 90 días
 *  - PENDIENTE / EN_ESTUDIO → pre-aprobado, te contactaremos
 * Retorna null si el cliente nunca ha solicitado.
 */
export async function getUltimaSolicitudCliente(supabase, idCliente) {
  if (!idCliente) return null

  const { data } = await supabase
    .from('solicitud_credito')
    .select(`
      id_solicitud, monto_solicitado, plazo_meses, fecha_solicitud, fecha_decision,
      comentarios_cliente,
      estado_solicitud!inner ( nombre ),
      motivo_rechazo ( descripcion_motivo, visible_cliente )
    `)
    .eq('id_cliente', idCliente)
    .order('fecha_solicitud', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data) return null

  const estado    = Array.isArray(data.estado_solicitud) ? data.estado_solicitud[0]?.nombre : data.estado_solicitud?.nombre
  const motivoRow = Array.isArray(data.motivo_rechazo) ? data.motivo_rechazo[0] : data.motivo_rechazo

  // Fecha en que podrá volver a solicitar: 90 días después de la última solicitud
  const base = data.fecha_solicitud ? new Date(data.fecha_solicitud) : null
  const fechaReintento = base ? new Date(base.getTime() + 90 * 86400 * 1000) : null
  const puedeReintentar = fechaReintento ? Date.now() >= fechaReintento.getTime() : true

  return {
    idSolicitud:    data.id_solicitud,
    estado,
    monto:          data.monto_solicitado,
    plazo:          data.plazo_meses,
    fechaSolicitud: data.fecha_solicitud,
    fechaDecision:  data.fecha_decision,
    // Solo exponemos el motivo si está marcado como visible para el cliente
    motivoVisible:  motivoRow?.visible_cliente ? motivoRow.descripcion_motivo : null,
    mensajeAnalista: data.comentarios_cliente ?? null,
    fechaReintento,
    puedeReintentar,
  }
}
