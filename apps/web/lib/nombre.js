/* ==========================================================================
 * ARCHIVO: nombre.js
 * RUTA: apps/web/lib/nombre.js
 * DESCRIPCIÓN: Utilidades para nombres atómicos (sin columna nombre_completo).
 * ========================================================================== */

/**
 * Concatena las 4 partes del nombre (equivalente a concat_ws en SQL).
 * Acepta un objeto con las columnas o argumentos sueltos.
 */
export function formatNombre(persona) {
  if (!persona) return ''
  if (typeof persona === 'string') return persona.trim()

  const partes = [
    persona.primer_nombre,
    persona.segundo_nombre,
    persona.primer_apellido,
    persona.segundo_apellido,
  ]
    .map(p => (p == null ? '' : String(p).trim()))
    .filter(Boolean)

  return partes.join(' ')
}

/**
 * Parseo convención colombiana (igual que fn_parse_nombre en Postgres):
 *  1 token  → primer_nombre
 *  2 tokens → primer_nombre + primer_apellido
 *  3 tokens → primer_nombre + primer_apellido + segundo_apellido
 *  4+       → primer_nombre + segundo_nombre(s) + primer_apellido + segundo_apellido
 */
export function parseNombre(texto) {
  const limpio = String(texto ?? '').trim().replace(/\s+/g, ' ')
  if (!limpio) {
    return {
      primer_nombre: '',
      segundo_nombre: '',
      primer_apellido: '',
      segundo_apellido: '',
    }
  }

  const partes = limpio.split(' ')
  const n = partes.length

  if (n === 1) {
    return {
      primer_nombre: partes[0],
      segundo_nombre: '',
      primer_apellido: '',
      segundo_apellido: '',
    }
  }
  if (n === 2) {
    return {
      primer_nombre: partes[0],
      segundo_nombre: '',
      primer_apellido: partes[1],
      segundo_apellido: '',
    }
  }
  if (n === 3) {
    return {
      primer_nombre: partes[0],
      segundo_nombre: '',
      primer_apellido: partes[1],
      segundo_apellido: partes[2],
    }
  }
  return {
    primer_nombre: partes[0],
    segundo_nombre: partes.slice(1, n - 2).join(' '),
    primer_apellido: partes[n - 2],
    segundo_apellido: partes[n - 1],
  }
}

/** Primer token útil para saludos ("Hola, Pedro"). */
export function primerNombre(persona) {
  if (!persona) return 'Usuario'
  if (typeof persona === 'string') {
    const t = persona.trim().split(/\s+/)[0]
    return t || 'Usuario'
  }
  const pn = String(persona.primer_nombre ?? '').trim()
  if (pn) return pn
  const full = formatNombre(persona)
  return full.split(/\s+/)[0] || 'Usuario'
}

/** Cláusula .or() de Supabase para buscar por partes del nombre + campos extra. */
export function orBusquedaNombre(q, extras = ['dni', 'telefono', 'email']) {
  const term = String(q ?? '').trim()
  if (!term) return null
  const like = `%${term}%`
  const partes = [
    `primer_nombre.ilike.${like}`,
    `segundo_nombre.ilike.${like}`,
    `primer_apellido.ilike.${like}`,
    `segundo_apellido.ilike.${like}`,
    ...extras.map(col => `${col}.ilike.${like}`),
  ]
  return partes.join(',')
}
