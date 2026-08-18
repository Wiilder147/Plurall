/* ==========================================================================
 * ARCHIVO: ip.js
 * RUTA: apps/web/lib/ip.js
 * DESCRIPCIÓN: Utilidad para obtener la IP real del cliente en el servidor.
 * FUNCIONALIDAD: Lee la IP desde los headers que ponen los proxies/CDN
 *                (Vercel, Cloudflare). IMPORTANTE: en desarrollo local no hay
 *                proxy, así que normalmente devuelve null; en producción sí llega.
 * ========================================================================== */

/** Devuelve la IP del cliente a partir de los headers HTTP, o null. */
export function getClientIp(request) {
  const h = request.headers
  return (
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    h.get('x-real-ip') ||
    h.get('cf-connecting-ip') ||
    null
  )
}

/** User-Agent del cliente (para auditoría), o null. */
export function getUserAgent(request) {
  return request.headers.get('user-agent') || null
}
