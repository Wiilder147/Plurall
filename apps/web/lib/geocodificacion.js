/* ==========================================================================
 * ARCHIVO: geocodificacion.js
 * RUTA: apps/web/lib/geocodificacion.js
 * DESCRIPCIÓN: Geocodificación directa (texto → coordenadas) con Nominatim.
 * FUNCIONALIDAD: C-03: ubicar en el mapa la dirección escrita. Si la
 *                nomenclatura no se encuentra, centra en la ciudad para que el
 *                usuario ajuste el pin. Se invoca al salir del campo (no por
 *                tecla) para respetar el límite de uso de Nominatim.
 * ========================================================================== */

/** Consultas en orden de precisión: dirección completa y luego ciudad. */
export function consultasDireccion({ direccion, ciudad, depto }) {
  const c = String(ciudad ?? '').trim()
  if (!c) return []
  const d = String(direccion ?? '').trim()
  const region = [c, String(depto ?? '').trim(), 'Colombia'].filter(Boolean).join(', ')
  return [...(d ? [`${d}, ${region}`] : []), region]
}

/** @returns {Promise<{lat:number, lng:number, precision:'direccion'|'ciudad'}|null>} */
export async function geocodificarDireccion(datos, fetchImpl = fetch) {
  const consultas = consultasDireccion(datos)
  for (const [i, q] of consultas.entries()) {
    try {
      const url = 'https://nominatim.openstreetmap.org/search?' + new URLSearchParams({
        q, format: 'json', limit: '1', countrycodes: 'co', 'accept-language': 'es',
      })
      const res = await fetchImpl(url, { headers: { Accept: 'application/json' } })
      if (!res.ok) continue
      const [hit] = await res.json()
      if (hit?.lat && hit?.lon) {
        const esDireccion = i === 0 && consultas.length > 1
        return { lat: parseFloat(hit.lat), lng: parseFloat(hit.lon), precision: esDireccion ? 'direccion' : 'ciudad' }
      }
    } catch {
      return null
    }
  }
  return null
}
