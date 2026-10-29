import { describe, it, expect, vi, beforeEach } from 'vitest'
import { crearFakeDb } from './helpers/fakeSupabase.js'

// H3: DELETE /api/auth/lockout no debe permitir que un tercero desbloquee
// (o resetee los intentos de) una cuenta ajena.
const db = crearFakeDb()
const sesion = { user: null }
vi.mock('@supabase/supabase-js', () => ({ createClient: () => db }))
vi.mock('@/lib/supabase/service', () => ({ createServiceClient: () => db }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: sesion.user }, error: null }) } }),
}))

const borrar = async (celular) => {
  const { DELETE } = await import('../app/api/auth/lockout/route.js')
  return DELETE(new Request('http://localhost/api/auth/lockout', {
    method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ celular }),
  }))
}
const victima = () => db.tablas.perfil_usuario.find(p => p.id === 'u-victima')

describe('DELETE /api/auth/lockout (H3)', () => {
  beforeEach(() => {
    sesion.user = null
    db.tablas = {
      cliente: [
        { telefono: '3120000001', id_usuario_cuenta: 'u-victima' },
        { telefono: '3120000002', id_usuario_cuenta: 'u-atacante' },
      ],
      perfil_usuario: [
        { id: 'u-victima', intentos_fallidos: 3, bloqueado_hasta: '2099-01-01T00:00:00Z' },
        { id: 'u-atacante', intentos_fallidos: 1, bloqueado_hasta: null },
      ],
    }
  })

  it('sin sesión no desbloquea a nadie', async () => {
    await borrar('3120000001')
    expect(victima().intentos_fallidos).toBe(3)
    expect(victima().bloqueado_hasta).not.toBeNull()
  })

  it('con sesión de otro usuario no desbloquea a la víctima', async () => {
    sesion.user = { id: 'u-atacante' }
    await borrar('3120000001')
    expect(victima().intentos_fallidos).toBe(3)
  })

  it('tras su propio login exitoso, el usuario resetea su contador', async () => {
    sesion.user = { id: 'u-victima' }
    const res = await borrar('3120000001')
    expect(res.status).toBe(200)
    expect(victima().intentos_fallidos).toBe(0)
    expect(victima().bloqueado_hasta).toBeNull()
  })
})
