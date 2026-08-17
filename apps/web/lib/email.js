/* ==========================================================================
 * ARCHIVO: email.js
 * RUTA: apps/web/lib/email.js
 * DESCRIPCIÓN: Utilidades para el "correo virtual" de acceso.
 * FUNCIONALIDAD: El login es por celular; Supabase Auth exige un email, así que
 *                se usa uno sintético ({celular}@plurall.app / .co, o
 *                {celular}@gmail.com). Ese correo NUNCA debe mostrarse a ningún
 *                usuario. El correo real (si el cliente lo dio) vive en
 *                cliente.email. Estas funciones distinguen uno de otro.
 * ========================================================================== */

// Correo sintético = parte local solo dígitos + dominio de acceso.
// Ej: 3600000037@plurall.app, 3215464660@plurall.co, 321546466@gmail.com
const EMAIL_SINTETICO_RE = /^\d+@(plurall\.(app|co)|gmail\.com)$/i

/** true si el correo es el sintético de acceso (o está vacío). */
export function esEmailSintetico(email) {
  if (!email) return true
  return EMAIL_SINTETICO_RE.test(String(email).trim())
}

/** Devuelve el correo solo si es real (mostrable); si es sintético, null. */
export function emailVisible(email) {
  return esEmailSintetico(email) ? null : String(email).trim()
}
