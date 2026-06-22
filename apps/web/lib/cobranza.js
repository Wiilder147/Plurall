/**
 * Priorización inteligente de cola de cobranza.
 * Score = días_mora × peso_dias + ratio_saldo × peso_monto + cuotas_vencidas × peso_cuotas
 */

export function calcularScoreRiesgo({ diasMora = 0, saldoPendiente = 0, cuotasVencidas = 0, montoVencido = 0 }) {
  const diasScore = Math.min(diasMora, 120) * 2
  const cuotasScore = cuotasVencidas * 15
  const montoScore = Math.min(montoVencido / 100000, 50)
  const saldoScore = Math.min(saldoPendiente / 500000, 30)
  return Math.round(diasScore + cuotasScore + montoScore + saldoScore)
}

export function prioridadLabel(score) {
  if (score >= 80) return { label: 'Crítica', cls: 'bg-red-500/20 text-red-300 ring-red-500/30' }
  if (score >= 50) return { label: 'Alta', cls: 'bg-orange-500/20 text-orange-300 ring-orange-500/30' }
  if (score >= 25) return { label: 'Media', cls: 'bg-yellow-500/20 text-yellow-300 ring-yellow-500/30' }
  return { label: 'Baja', cls: 'bg-slate-500/20 text-slate-300 ring-slate-500/30' }
}

export const PLANTILLAS_GESTION = [
  { id: 'llamada_inicial', label: 'Llamada inicial', tipo: 'LLAMADA', resultado: 'EXITOSO', texto: 'Contacto telefónico. Cliente informado del saldo en mora y fecha límite de pago.' },
  { id: 'whatsapp_recordatorio', label: 'WhatsApp recordatorio', tipo: 'WHATSAPP', resultado: 'EXITOSO', texto: 'Mensaje de recordatorio enviado por WhatsApp con detalle de cuotas vencidas.' },
  { id: 'visita_domicilio', label: 'Visita domiciliaria', tipo: 'VISITA', resultado: 'EXITOSO', texto: 'Visita realizada al negocio/residencia. Se verificó situación del cliente.' },
  { id: 'promesa_pago', label: 'Promesa de pago', tipo: 'PROMESA_PAGO', resultado: 'PROMESA', texto: 'Cliente compromete pago parcial/total en fecha acordada.' },
  { id: 'no_contesta', label: 'No contesta', tipo: 'NO_CONTESTA', resultado: 'SIN_RESPUESTA', texto: 'Sin respuesta tras múltiples intentos de contacto.' },
  { id: 'pago_efectivo', label: 'Pago en efectivo', tipo: 'PAGO_EFECTIVO', resultado: 'PAGO_RECIBIDO', texto: 'Abono recibido en efectivo. Recibo entregado al cliente.' },
]
