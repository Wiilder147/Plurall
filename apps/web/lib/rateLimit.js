/**
 * Rate limiting con Upstash Redis; fallback en memoria si no hay credenciales.
 */

const memoryStore = new Map()

function memoryLimit(key, limit, windowMs) {
  const now = Date.now()
  const entry = memoryStore.get(key) || { count: 0, reset: now + windowMs }
  if (now > entry.reset) {
    entry.count = 0
    entry.reset = now + windowMs
  }
  entry.count++
  memoryStore.set(key, entry)
  return { success: entry.count <= limit, remaining: Math.max(0, limit - entry.count) }
}

export async function rateLimit(key, { limit = 10, windowSec = 60 } = {}) {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  if (url && token) {
    try {
      const windowMs = windowSec * 1000
      const res = await fetch(`${url}/pipeline`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify([
          ['INCR', key],
          ['PEXPIRE', key, windowSec, 'NX'],
        ]),
      })
      const data = await res.json()
      const count = data?.[0]?.result ?? 1
      return { success: count <= limit, remaining: Math.max(0, limit - count) }
    } catch {
      /* fallback memoria */
    }
  }

  return memoryLimit(key, limit, windowSec * 1000)
}

export function getClientIp(request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown'
}
