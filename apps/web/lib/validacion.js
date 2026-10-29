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

// Reglas de textos libres (criterio de auditoría 29-oct-2026, delegado por negocio):
// mínimo para que quede una nota/motivo real, máximo para que no desborde la UI.
export const REGLAS_TEXTO = {
  notaAsesor:     { min: 10, max: 500, etiqueta: 'El motivo o nota' },
  motivoCatalogo: { min: 5,  max: 150, etiqueta: 'El motivo' },
}

/** Devuelve un mensaje de error o null si el texto es válido. */
export function validarTextoLibre(texto, { min, max, etiqueta = 'El texto' }) {
  const t = String(texto ?? '').trim()
  if (t.length < min) return `${etiqueta} debe tener al menos ${min} caracteres.`
  if (t.length > max) return `${etiqueta} admite máximo ${max} caracteres.`
  if ((t.match(/\p{L}/gu) ?? []).length < 3) return `${etiqueta} debe contener al menos 3 letras.`
  return null
}
