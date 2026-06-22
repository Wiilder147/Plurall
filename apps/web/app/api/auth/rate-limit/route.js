import { rateLimit, getClientIp } from '@/lib/rateLimit'
import { NextResponse } from 'next/server'

export async function POST(request) {
  const ip = getClientIp(request)
  const { action = 'default' } = await request.json().catch(() => ({}))
  const key = `rl:${action}:${ip}`
  const { success, remaining } = await rateLimit(key, { limit: action === 'registro' ? 5 : 10, windowSec: 600 })
  if (!success) {
    return NextResponse.json({ error: 'Demasiados intentos. Espera unos minutos.' }, { status: 429 })
  }
  return NextResponse.json({ ok: true, remaining })
}
