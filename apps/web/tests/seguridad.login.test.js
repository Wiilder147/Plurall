import { describe, it, expect, vi, beforeEach } from 'vitest'
import { crearFakeDb } from './helpers/fakeSupabase.js'

// H3 (decisión 29-oct-2026: login en el servidor): el bloqueo por intentos
// fallidos se aplica en el servidor ANTES de autenticar; ya no depende de que
// el navegador consulte /api/auth/lockout (endpoint eliminado).
const db = crearFakeDb()
const signIn = vi.fn()
vi.mock('@/lib/supabase/service', () => ({ createServiceClient: () => db }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { signInWithPassword: signIn } }),
}))

const CLAVE = 'Correcta123'
let ip = 0
async function login(celular, password) {
  const { POST } = await import('../app/api/auth/login/route.js')
  return POST(new Request('http://localhost/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': `198.51.100.${++ip % 250}` },
    body: JSON.stringify({ celular, password }),
  }))
}
const perfil = () => db.tablas.perfil_usuario[0]

beforeEach(() => {
  signIn.mockReset()
  signIn.mockImplementation(async ({ password }) =>
    password === CLAVE ? { data: {}, error: null } : { data: {}, error: { code: 'invalid_credentials', message: 'Invalid login credentials' } })
  db.tablas = { perfil_usuario: [{ id: 'u-1', intentos_fallidos: 0, bloqueado_hasta: null }] }
  db.rpcs = {
    id_usuario_por_celular: ({ cel }) => (cel === '3150000001' ? 'u-1' : null),
    registrar_intento_login_fallido: ({ uid, limite, minutos }, d) => {
      const p = d.tablas.perfil_usuario.find(x => x.id === uid)
      p.intentos_fallidos += 1
      if (p.intentos_fallidos >= limite) p.bloqueado_hasta = new Date(Date.now() + minutos * 60000).toISOString()
      return [{ intentos: p.intentos_fallidos, bloqueado_hasta: p.bloqueado_hasta }]
    },
  }
})

describe('POST /api/auth/login (H3)', () => {
  it('celular inválido → 400 sin autenticar', async () => {
    expect((await login('123', CLAVE)).status).toBe(400)
    expect(signIn).not.toHaveBeenCalled()
  })

  it('número no registrado → 404 sin autenticar', async () => {
    expect((await login('3159999999', CLAVE)).status).toBe(404)
    expect(signIn).not.toHaveBeenCalled()
  })

  it('al tercer fallo bloquea la cuenta', async () => {
    expect((await login('3150000001', 'mala1')).status).toBe(401)
    expect((await login('3150000001', 'mala2')).status).toBe(401)
    const r = await login('3150000001', 'mala3')
    expect(r.status).toBe(423)
    expect(perfil().bloqueado_hasta).not.toBeNull()
  })

  it('con la cuenta bloqueada NO autentica ni con la contraseña correcta', async () => {
    perfil().bloqueado_hasta = new Date(Date.now() + 10 * 60000).toISOString()
    const r = await login('3150000001', CLAVE)
    expect(r.status).toBe(423)
    expect((await r.json()).minutosRestantes).toBeGreaterThan(0)
    expect(signIn).not.toHaveBeenCalled()
  })

  it('login correcto → 200 y reinicia el contador', async () => {
    perfil().intentos_fallidos = 2
    const r = await login('3150000001', CLAVE)
    expect(r.status).toBe(200)
    expect(perfil().intentos_fallidos).toBe(0)
    expect(signIn).toHaveBeenCalledWith({ email: '3150000001@plurall.app', password: CLAVE })
  })
})
