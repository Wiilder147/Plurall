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
