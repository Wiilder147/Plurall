/* ==========================================================================
 * ARCHIVO: validacion.js
 * RUTA: apps/web/lib/validacion.js
 * DESCRIPCIÓN: Validaciones compartidas entre formularios (registro,
 *              funnel de crédito) y testeables de forma aislada.
 * ========================================================================== */

// El type="email" nativo acepta "usuario@gmail" sin TLD; este regex exige
// usuario, dominio y TLD completos (ej: usuario@gmail.com)
export const EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/

export function esEmailValido(email) {
  return typeof email === 'string' && EMAIL_REGEX.test(email.trim())
}

// Celular colombiano: exactamente 10 dígitos
export function esCelularValido(celular) {
  return typeof celular === 'string' && /^\d{10}$/.test(celular.replace(/\D/g, '')) &&
         celular.replace(/\D/g, '').length === 10
}
