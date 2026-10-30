import { describe, it, expect, vi, beforeEach } from 'vitest'
import { crearFakeDb } from './helpers/fakeSupabase.js'
import { resolverMotivoRechazo } from '../lib/motivos'

// M-08 / M-09: los rechazos usan el catálogo de motivos (no listas fijas ni
// texto libre) y guardan id_motivo_rechazo; el cliente ve el texto solo si el
// motivo es visible_cliente.
const db = crearFakeDb()
vi.mock('@supabase/supabase-js', () => ({ createClient: () => db }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ from: db.from, auth: { getUser: async () => ({ data: { user: { id: 'sup-1' } }, error: null }) } }),
}))
vi.mock('@/lib/notificaciones', () => ({ notificarSolicitudAprobada: async () => null, notificarSolicitudRechazada: async () => null }))

beforeEach(() => {
  db.tablas = {
    perfil_usuario: [{ id: 'sup-1', rol: { nombre_rol: 'SUPERVISOR' } }],
    motivo_rechazo: [
      { id_motivo: 'm-vis', descripcion_motivo: 'Documentación incompleta o ilegible', visible_cliente: true, activo: true },
      { id_motivo: 'm-int', descripcion_motivo: 'Alerta interna de riesgo', visible_cliente: false, activo: true },
      { id_motivo: 'm-off', descripcion_motivo: 'Motivo retirado', visible_cliente: true, activo: false },
    ],
    estado_solicitud: [{ nombre: 'EN_ESTUDIO', id_estado_solicitud: 'e-est' }, { nombre: 'RECHAZADA', id_estado_solicitud: 'e-rec' }],
    solicitud_credito: [{ id_solicitud: 's1', id_cliente: 'cl1', id_estado_solicitud: 'e-est', estado_solicitud: { nombre: 'EN_ESTUDIO' }, cliente: {} }],
    decision_solicitud: [],
    documento_cliente: [],
  }
})

describe('resolverMotivoRechazo', () => {
  it('acepta solo motivos activos del catálogo', async () => {
    expect((await resolverMotivoRechazo(db, 'm-vis')).motivo.descripcion_motivo).toMatch(/Documentación/)
    expect((await resolverMotivoRechazo(db, 'm-off')).error).toBeTruthy()
    expect((await resolverMotivoRechazo(db, 'no-existe')).error).toBeTruthy()
    expect((await resolverMotivoRechazo(db, undefined)).error).toBeTruthy()
  })
})

async function rechazar(body) {
  const { PATCH } = await import('../app/api/admin/solicitud/[id]/route.js')
  return PATCH(new Request('http://localhost/x', { method: 'PATCH', body: JSON.stringify({ accion: 'RECHAZAR', ...body }) }),
    { params: Promise.resolve({ id: 's1' }) })
}

describe('PATCH /api/admin/solicitud — RECHAZAR (M-09)', () => {
  it('exige un motivo del catálogo', async () => {
    const res = await rechazar({ comentarios_cliente: 'texto suelto' })
    expect(res.status).toBe(400)
    expect(db.tablas.decision_solicitud).toHaveLength(0)
  })

  it('guarda id_motivo_rechazo y el texto visible para el cliente', async () => {
    const res = await rechazar({ id_motivo_rechazo: 'm-vis' })
    expect(res.status).toBe(200)
    expect(db.tablas.decision_solicitud[0]).toMatchObject({ id_motivo_rechazo: 'm-vis', comentarios_cliente: 'Documentación incompleta o ilegible' })
    expect(db.tablas.solicitud_credito[0].id_motivo_rechazo).toBe('m-vis')
  })

  it('un motivo interno no se muestra al cliente', async () => {
    await rechazar({ id_motivo_rechazo: 'm-int' })
    expect(db.tablas.decision_solicitud[0].comentarios_cliente).toBeNull()
  })
})
