import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── NEW-06: la ventana del rate limit en Redis debe durar windowSec segundos ──
describe('rateLimit (Upstash) — ventana en milisegundos correcta', () => {
  beforeEach(() => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://redis.test'
    process.env.UPSTASH_REDIS_REST_TOKEN = 't'
  })
  afterEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL
    delete process.env.UPSTASH_REDIS_REST_TOKEN
    vi.unstubAllGlobals()
  })

  it('windowSec=600 expira a los 600 s, no a los 600 ms', async () => {
    const fetchMock = vi.fn(async () => ({ json: async () => [{ result: 1 }, { result: 1 }] }))
    vi.stubGlobal('fetch', fetchMock)
    const { rateLimit } = await import('../lib/rateLimit.js')
    await rateLimit('k', { limit: 5, windowSec: 600 })
    const cmds = JSON.parse(fetchMock.mock.calls[0][1].body)
    const expira = cmds.find(c => /EXPIRE$/.test(c[0]))
    const ms = expira[0] === 'PEXPIRE' ? Number(expira[2]) : Number(expira[2]) * 1000
    expect(ms).toBe(600_000)
  })
})

// ── S-C2: el OTP de recuperación no puede adivinarse por fuerza bruta ──
const db = { otps: [], updates: [], passwordResets: [] }

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: { admin: { updateUserById: async (id, attrs) => { db.passwordResets.push({ id, attrs }); return { error: null } } } },
    from: (tabla) => {
      const filtros = {}
      const q = {
        select: () => q,
        eq: (c, v) => { filtros[c] = v; return q },
        gte: () => q,
        order: () => q,
        limit: async () => ({ data: db.otps.filter(o => o.celular === filtros.celular && !o.usado), error: null }),
        single: async () => ({ data: tabla === 'cliente' ? { id_usuario_cuenta: 'user-victima' } : null, error: null }),
        update: (vals) => {
          const u = { tabla, vals, filtros }
          db.updates.push(u)
          const thenable = {
            eq: (c, v) => { filtros[c] = v; return thenable },
            then: (res) => {
              if (tabla === 'otp_recuperacion' && vals.usado) {
                db.otps.forEach(o => {
                  if ((filtros.id_otp && o.id_otp === filtros.id_otp) || (!filtros.id_otp && o.celular === filtros.celular)) o.usado = true
                })
              }
              return res({ error: null })
            },
          }
          return thenable
        },
      }
      return q
    },
  }),
}))

const verificar = (celular, otp) => import('../app/api/auth/otp/verificar/route.js').then(({ POST }) =>
  POST(new Request('http://localhost/api/auth/otp/verificar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '203.0.113.7' },
    body: JSON.stringify({ celular, otp, newPassword: 'NuevaClave123' }),
  })))

describe('POST /api/auth/otp/verificar — límite de intentos (S-C2)', () => {
  beforeEach(() => { db.otps = []; db.updates = []; db.passwordResets = [] })

  it('el código correcto en el primer intento restablece la contraseña', async () => {
    db.otps.push({ id_otp: 'o1', celular: '3110000001', otp_code: '482913', usado: false })
    const res = await verificar('3110000001', '482913')
    expect(res.status).toBe(200)
    expect(db.passwordResets).toHaveLength(1)
  })

  it('tras 5 códigos erróneos, el código correcto ya NO sirve (OTP invalidado)', async () => {
    db.otps.push({ id_otp: 'o2', celular: '3110000002', otp_code: '482913', usado: false })
    for (let i = 0; i < 5; i++) {
      const r = await verificar('3110000002', String(100000 + i))
      expect(r.status).toBe(400)
    }
    const res = await verificar('3110000002', '482913')
    expect([400, 429]).toContain(res.status)
    expect(db.passwordResets).toHaveLength(0)
    expect(db.otps.every(o => o.usado)).toBe(true)
  })
})
