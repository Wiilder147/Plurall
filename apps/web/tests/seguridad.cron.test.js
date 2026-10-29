import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { crearFakeDb } from './helpers/fakeSupabase.js'

// M5: los cron (marcan mora, envían correos masivos) deben fallar cerrado
// si CRON_SECRET no está configurado.
const creaciones = vi.fn()
const db = crearFakeDb()
vi.mock('@supabase/supabase-js', () => ({ createClient: () => { creaciones(); return db } }))
vi.mock('@/lib/supabase/service', () => ({ createServiceClient: () => { creaciones(); return db } }))
vi.mock('@/lib/notificaciones', () => ({ notificarRecordatorioCuota: async () => null }))
vi.mock('@/lib/notificacionesInApp', () => ({
  notificarAsesorCliente: async () => null,
  registrarNotificacionCliente: async () => null,
}))

const rutas = {
  mora:          () => import('../app/api/cron/mora/route.js'),
  recordatorios: () => import('../app/api/cron/recordatorios/route.js'),
}
const req = (auth) => new Request('http://localhost/api/cron/x', { headers: auth ? { authorization: auth } : {} })

describe.each(Object.entries(rutas))('GET /api/cron/%s', (_, cargar) => {
  beforeEach(() => { creaciones.mockClear(); db.tablas = {} })
  afterEach(() => { delete process.env.CRON_SECRET })

  it('sin CRON_SECRET configurado → 401 y no toca la BD', async () => {
    delete process.env.CRON_SECRET
    const { GET } = await cargar()
    const res = await GET(req())
    expect(res.status).toBe(401)
    expect(creaciones).not.toHaveBeenCalled()
  })

  it('con secreto incorrecto → 401', async () => {
    process.env.CRON_SECRET = 's3creto'
    const { GET } = await cargar()
    expect((await GET(req('Bearer otro'))).status).toBe(401)
    expect(creaciones).not.toHaveBeenCalled()
  })

  it('con el secreto correcto → se ejecuta', async () => {
    process.env.CRON_SECRET = 's3creto'
    const { GET } = await cargar()
    const res = await GET(req('Bearer s3creto'))
    expect(res.status).not.toBe(401)
    expect(creaciones).toHaveBeenCalled()
  })
})
