import { describe, it, expect, vi, beforeEach } from 'vitest'

// S-C1: endpoints con datos de toda la cartera (service-role, sin RLS) deben
// exigir rol ADMIN o SUPERVISOR. Un CLIENTE o ASESOR autenticado → 403 y la
// consulta privilegiada no se ejecuta.

const estado = { user: null, rol: null }
const serviceFactory = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: estado.user }, error: null }) },
    from: () => {
      const q = {
        select: () => q,
        eq: () => q,
        single: async () => ({ data: estado.rol ? { rol: { nombre_rol: estado.rol } } : null, error: null }),
      }
      return q
    },
  }),
}))

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: (...a) => {
    serviceFactory(...a)
    // Consulta encadenable que devuelve vacío: basta para que el handler termine.
    const q = new Proxy(() => {}, {
      get: (_, prop) => (prop === 'then'
        ? (res) => res({ data: [], error: null, count: 0 })
        : () => q),
      apply: () => q,
    })
    return q
  },
}))

const rutas = {
  'mora-critica':          () => import('../app/api/supervisor/mora-critica/route.js'),
  'solicitudes-recientes': () => import('../app/api/supervisor/solicitudes-recientes/route.js'),
  'dashboard-data':        () => import('../app/api/supervisor/dashboard-data/route.js'),
}

const req = () => new Request('http://localhost/api/supervisor/x?meses=3')

describe.each(Object.entries(rutas))('GET /api/supervisor/%s', (_, cargar) => {
  beforeEach(() => { serviceFactory.mockClear(); estado.user = null; estado.rol = null })

  it('sin sesión → 401', async () => {
    const { GET } = await cargar()
    const res = await GET(req())
    expect(res.status).toBe(401)
    expect(serviceFactory).not.toHaveBeenCalled()
  })

  it.each(['CLIENTE', 'ASESOR', null])('rol %s → 403 sin consultar con service-role', async (rol) => {
    estado.user = { id: 'u-1' }; estado.rol = rol
    const { GET } = await cargar()
    const res = await GET(req())
    expect(res.status).toBe(403)
    expect(serviceFactory).not.toHaveBeenCalled()
  })

  it.each(['SUPERVISOR', 'ADMIN'])('rol %s → acceso permitido', async (rol) => {
    estado.user = { id: 'u-1' }; estado.rol = rol
    const { GET } = await cargar()
    const res = await GET(req())
    expect(res.status).not.toBe(401)
    expect(res.status).not.toBe(403)
    expect(serviceFactory).toHaveBeenCalled()
  })
})
