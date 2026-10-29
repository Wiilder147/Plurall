/* ==========================================================================
 * ARCHIVO: pagoConfirmacion.js
 * RUTA: apps/web/lib/pagoConfirmacion.js
 * DESCRIPCIÓN: Transición de estado de la pantalla de confirmación de pago.
 * ========================================================================== */

// J-09: tras la primera verificación sin resultado definitivo (pago aún no
// registrado o PROCESANDO), se sale del spinner a "procesando", que es donde
// la pantalla muestra el aviso cuando el polling se agota.
export function estadoTrasVerificacion(estadoActual, terminado) {
  if (terminado) return estadoActual
  return estadoActual === 'cargando' ? 'procesando' : estadoActual
}
