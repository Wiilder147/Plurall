/* ==========================================================================
 * ARCHIVO: estados.js
 * RUTA: apps/web/lib/estados.js
 * DESCRIPCIÓN: Textos legibles de los estados internos (códigos de BD).
 * FUNCIONALIDAD: Fuente única para no mostrar códigos como "EN_MORA" al usuario.
 * ========================================================================== */

// Mismos textos que la tarjeta de "Mis Documentos" (dashboard/documentos).
const LABEL_ESTADO_CREDITO = {
  ACTIVO:    'Activo',
  EN_MORA:   'En mora',
  PAGADO:    'Pagado',
  CANCELADO: 'Cancelado',
  CASTIGADO: 'Castigado',
}

// Código desconocido → "Codigo nuevo" (sin guiones bajos ni mayúsculas sostenidas).
function humanizar(codigo) {
  const t = String(codigo).replace(/_/g, ' ').toLowerCase()
  return t.charAt(0).toUpperCase() + t.slice(1)
}

export function labelEstadoCredito(estado) {
  if (!estado) return '—'
  return LABEL_ESTADO_CREDITO[estado] ?? humanizar(estado)
}
