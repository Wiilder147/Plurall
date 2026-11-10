/* ==========================================================================
 * ARCHIVO: telefono.js
 * RUTA: apps/web/lib/telefono.js
 * DESCRIPCIÓN: Distingue un celular real del valor de relleno '0000000000'.
 * FUNCIONALIDAD: Antes de db/33 el trigger de registro creaba clientes sin
 *                celular con '0000000000' (WF-03). Ese valor no es un número de
 *                contacto: no se muestra ni se usa para llamar o escribir.
 *                Es seguro importarlo desde componentes cliente.
 * ========================================================================== */

/** true si el celular está vacío o es el relleno (solo ceros). */
export function esCelularPlaceholder(cel) {
  if (cel == null) return true
  const limpio = String(cel).replace(/\D/g, '')
  return limpio === '' || /^0+$/.test(limpio)
}

/** Devuelve el celular solo si es real (mostrable); si es relleno, null. */
export function celularVisible(cel) {
  return esCelularPlaceholder(cel) ? null : String(cel).trim()
}
