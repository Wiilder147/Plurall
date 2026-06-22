export const CORRELATION_HEADER = 'x-correlation-id'

function generateId() {
  // Web Crypto API — compatible con Edge Runtime (middleware)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

export function getOrCreateCorrelationId(request) {
  return request.headers.get(CORRELATION_HEADER) || generateId()
}

export function withCorrelationHeaders(response, correlationId) {
  if (response.headers) {
    response.headers.set(CORRELATION_HEADER, correlationId)
  }
  return response
}
