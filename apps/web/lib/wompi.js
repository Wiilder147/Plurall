/* ==========================================================================
 * ARCHIVO: wompi.js
 * RUTA: apps/web/lib/wompi.js
 * DESCRIPCIÓN: Verificación de la firma de eventos de Wompi.
 * FUNCIONALIDAD: checksum = SHA256(valores de signature.properties + timestamp
 *                + secreto de eventos), según https://docs.wompi.co/docs/colombia/eventos/
 * ========================================================================== */
import { createHash, timingSafeEqual } from 'node:crypto'

// "transaction.amount_in_cents" → evento.data.transaction.amount_in_cents
function valorEnData(data, ruta) {
  return ruta.split('.').reduce((obj, k) => (obj == null ? undefined : obj[k]), data)
}

/**
 * @param {object} evento  - cuerpo del evento recibido
 * @param {string} secreto - WOMPI_EVENTS_SECRET; sin secreto la firma es inválida
 * @returns {boolean}
 */
export function firmaEventoWompiValida(evento, secreto) {
  if (!secreto) return false
  const props    = evento?.signature?.properties
  const checksum = evento?.signature?.checksum
  if (!Array.isArray(props) || props.length === 0 || typeof checksum !== 'string') return false
  if (evento.timestamp == null) return false

  const valores = props.map(p => valorEnData(evento.data, p))
  if (valores.some(v => v === undefined)) return false

  const esperado = createHash('sha256')
    .update(`${valores.join('')}${evento.timestamp}${secreto}`)
    .digest('hex')
  const a = Buffer.from(esperado.toLowerCase())
  const b = Buffer.from(checksum.toLowerCase())
  return a.length === b.length && timingSafeEqual(a, b)
}
