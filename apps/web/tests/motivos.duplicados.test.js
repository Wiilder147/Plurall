import { describe, it, expect, vi, beforeEach } from 'vitest'
import { crearFakeDb } from './helpers/fakeSupabase.js'

// M-12: el catálogo no debe aceptar un motivo con un nombre ya existente.
const db = crearFakeDb()
vi.mock('@supabase/supabase-js', () => ({ createClient: () => db }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: db.from,
    auth: { getUser: async () => ({ data: { user: { id: 'sup-1' } }, error: null }) },
  }),
}))

async function crear(descripcion_motivo) {
  const { POST } = await import('../app/api/supervisor/motivos/route.js')
  return POST(new Request('http://localhost/api/supervisor/motivos', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ descripcion_motivo }),
  }))
}

describe('POST /api/supervisor/motivos — duplicados (M-12)', () => {
  beforeEach(() => {
    db.tablas = {
      perfil_usuario: [{ id: 'sup-1', rol: { nombre_rol: 'SUPERVISOR' } }],
      motivo_rechazo: [{ id_motivo: 'm1', descripcion_motivo: 'Documentación incompleta o ilegible', activo: true }],
    }
  })

  it('rechaza un nombre idéntico con un mensaje claro', async () => {
    const res = await crear('Documentación incompleta o ilegible')
    expect(res.status).toBe(409)
    expect((await res.json()).error).toMatch(/ya existe/i)
    expect(db.tablas.motivo_rechazo).toHaveLength(1)
  })

  it('rechaza el duplicado aunque cambien mayúsculas o espacios', async () => {
    const res = await crear('  documentación   INCOMPLETA o ilegible ')
    expect(res.status).toBe(409)
    expect(db.tablas.motivo_rechazo).toHaveLength(1)
  })

  it('acepta un motivo nuevo', async () => {
    const res = await crear('Zona geográfica no cubierta actualmente')
    expect(res.status).toBe(200)
    expect(db.tablas.motivo_rechazo).toHaveLength(2)
  })
})
