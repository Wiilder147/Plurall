/* ==========================================================================
 * ARCHIVO: dni.js
 * RUTA: apps/web/lib/dni.js
 * DESCRIPCIÓN: Número de documento (cédula) del cliente: validación y
 *              visualización.
 * FUNCIONALIDAD: WF-02. El trigger de registro guarda 'SN' + 16 hex del id de
 *                Auth cuando el alta no trae documento (cliente.dni es NOT NULL
 *                y UNIQUE). Ese valor es interno: NUNCA debe mostrarse como si
 *                fuera una cédula (pantallas, PDF, Wompi, reportes).
 * ========================================================================== */

// Placeholders de los triggers: 'SN' + hex (db/16, 20, 33) y 'SN-' + uuid (db/12)
const DNI_PLACEHOLDER_RE = /^SN-?[0-9a-f-]+$/i

// Cédula: solo dígitos, entre 5 y 12 (12 = límite que ya tenía el formulario).
export const DNI_REGEX = /^\d{5,12}$/

/** true si el valor es el documento interno de relleno (o está vacío). */
export function esDniPlaceholder(dni) {
  if (dni == null || String(dni).trim() === '') return true
  return DNI_PLACEHOLDER_RE.test(String(dni).trim())
}

/** Devuelve el documento solo si es real (mostrable); si es de relleno, null. */
export function documentoVisible(dni) {
  return esDniPlaceholder(dni) ? null : String(dni).trim()
}

export function esDniValido(dni) {
  return typeof dni === 'string' && DNI_REGEX.test(dni)
}
