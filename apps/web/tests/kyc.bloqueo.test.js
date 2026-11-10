import { describe, it, expect, vi, beforeEach } from 'vitest'
import { crearFakeDb } from './helpers/fakeSupabase.js'
import { bloqueoKyc, MENSAJE_KYC_RECHAZADO, MENSAJE_KYC_INCOMPLETO } from '../lib/kyc'

// JM-01 (decisión 09-nov-2026): ningún flujo pre-aprueba, aprueba ni desembolsa
// si la cédula (frontal y trasera) no está APROBADA o hay un documento
// RECHAZADO. Se prueban los route handlers reales, no solo la función.
const db = crearFakeDb()
let rolActual = 'SUPERVISOR'
vi.mock('@supabase/supabase-js', () => ({ createClient: () => db }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ from: db.from, auth: { getUser: async () => ({ data: { user: { id: 'staff-1' } }, error: null }) } }),
}))
vi.mock('@/lib/notificaciones', () => ({
  notificarDesembolso: async () => null, notificarSolicitudAprobada: async () => null, notificarSolicitudRechazada: async () => null,
}))

const doc = (tipo, estado, extra = {}) => ({ id_documento: `${tipo}-${estado}`, id_cliente: 'cl1', tipo_documento: tipo, estado_verificacion: estado, activo: true, ...extra })
const KYC_OK = [doc('CEDULA_FRONTAL', 'APROBADO'), doc('CEDULA_TRASERA', 'APROBADO')]

function sembrar({ documentos, estadoSol = 'APROBADA', plazo = 36 }) {
  db.tablas = {
    perfil_usuario: [{ id: 'staff-1', rol: { nombre_rol: rolActual } }],
    estado_solicitud: [
      { nombre: 'PENDIENTE', id_estado_solicitud: 'e-pen' }, { nombre: 'EN_ESTUDIO', id_estado_solicitud: 'e-est' },
      { nombre: 'APROBADA', id_estado_solicitud: 'e-apr' }, { nombre: 'DESEMBOLSADA', id_estado_solicitud: 'e-des' },
    ],
    solicitud_credito: [{
      id_solicitud: 's1', id_cliente: 'cl1', estado_solicitud: { nombre: estadoSol },
      decision_solicitud: [{ monto_aprobado: 3_250_000, plazo_aprobado: plazo, tasa_interes_aprobada: 0.02 }],
      cliente: { primer_nombre: 'Ana', primer_apellido: 'Pérez', email: null },
    }],
    documento_cliente: documentos,
    decision_solicitud: [], credito: [], plan_pago: [], cuota: [], motivo_rechazo: [],
  }
}

describe('bloqueoKyc', () => {
  it('rechazado bloquea con su propio mensaje, aunque lo demás esté aprobado', async () => {
    sembrar({ documentos: [...KYC_OK, doc('CEDULA_TRASERA', 'RECHAZADO', { id_documento: 'r' })] })
    expect(await bloqueoKyc(db, 'cl1')).toBe(MENSAJE_KYC_RECHAZADO)
  })

  it('cédula pendiente o sin cargar bloquea (caso del reporte: 1/2 aprobados)', async () => {
    sembrar({ documentos: [doc('CEDULA_FRONTAL', 'APROBADO'), doc('CEDULA_TRASERA', 'PENDIENTE')] })
    expect(await bloqueoKyc(db, 'cl1')).toBe(MENSAJE_KYC_INCOMPLETO)
    sembrar({ documentos: [doc('CEDULA_FRONTAL', 'APROBADO')] })
    expect(await bloqueoKyc(db, 'cl1')).toBe(MENSAJE_KYC_INCOMPLETO)
    sembrar({ documentos: [] })
    expect(await bloqueoKyc(db, 'cl1')).toBe(MENSAJE_KYC_INCOMPLETO)
  })

  it('ignora documentos inactivos y soportes que no son de identidad', async () => {
    sembrar({ documentos: [...KYC_OK, doc('CEDULA_TRASERA', 'RECHAZADO', { id_documento: 'viejo', activo: false }), doc('RECIBO_PUBLICO', 'PENDIENTE')] })
    expect(await bloqueoKyc(db, 'cl1')).toBeNull()
    sembrar({ documentos: [doc('CEDULA_FRONTAL', 'APROBADO', { activo: false }), doc('CEDULA_TRASERA', 'APROBADO')] })
    expect(await bloqueoKyc(db, 'cl1')).toBe(MENSAJE_KYC_INCOMPLETO)
  })
})

async function desembolsar() {
  const { POST } = await import('../app/api/admin/desembolsar/[id]/route.js')
  return POST(new Request('http://localhost/x', { method: 'POST' }), { params: Promise.resolve({ id: 's1' }) })
}

describe('POST /api/admin/desembolsar/:id (JM-01, JM-18)', () => {
  beforeEach(() => { rolActual = 'SUPERVISOR' })

  it('KYC pendiente: 409 y no crea crédito', async () => {
    sembrar({ documentos: [doc('CEDULA_FRONTAL', 'APROBADO'), doc('CEDULA_TRASERA', 'PENDIENTE')] })
    const res = await desembolsar()
    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe(MENSAJE_KYC_INCOMPLETO)
    expect(db.tablas.credito).toHaveLength(0)
  })

  it('KYC rechazado: 409 y no crea crédito', async () => {
    sembrar({ documentos: [doc('CEDULA_FRONTAL', 'APROBADO'), doc('CEDULA_TRASERA', 'RECHAZADO')] })
    expect((await desembolsar()).status).toBe(409)
    expect(db.tablas.credito).toHaveLength(0)
  })

  it.each([-36, 0, 12.5, NaN, null, '', '36', Infinity])('plazo aprobado inválido (%s): 422 y no crea crédito', async (plazo) => {
    sembrar({ documentos: KYC_OK, plazo })
    const res = await desembolsar()
    expect(res.status).toBe(422)
    expect((await res.json()).errores.map(e => e.campo)).toContain('plazo')
    expect(db.tablas.credito).toHaveLength(0)
  })

  it('KYC completo y condiciones válidas: crea el crédito ACTIVO con 36 cuotas', async () => {
    sembrar({ documentos: KYC_OK })
    const res = await desembolsar()
    expect(res.status).toBe(200)
    expect(db.tablas.credito).toHaveLength(1)
    expect(db.tablas.credito[0]).toMatchObject({ estado_credito: 'ACTIVO', numero_cuotas: 36 })
  })
})

describe('Aprobar y pre-aprobar con KYC incompleto (JM-01)', () => {
  it('PATCH /api/admin/solicitud APROBAR: 409, sin decisión registrada', async () => {
    rolActual = 'SUPERVISOR'
    sembrar({ documentos: [doc('CEDULA_FRONTAL', 'PENDIENTE')], estadoSol: 'EN_ESTUDIO' })
    const { PATCH } = await import('../app/api/admin/solicitud/[id]/route.js')
    const res = await PATCH(new Request('http://localhost/x', {
      method: 'PATCH',
      body: JSON.stringify({ accion: 'APROBAR', monto_aprobado: 3_250_000, plazo_aprobado: 36, tasa_interes_aprobada: 0.02 }),
    }), { params: Promise.resolve({ id: 's1' }) })
    expect(res.status).toBe(409)
    expect(db.tablas.decision_solicitud).toHaveLength(0)
  })

  it('PATCH /api/asesor/solicitudes PRE_APROBAR: 409, la solicitud sigue PENDIENTE', async () => {
    rolActual = 'ASESOR'
    sembrar({ documentos: [], estadoSol: 'PENDIENTE' })
    const { PATCH } = await import('../app/api/asesor/solicitudes/[id]/route.js')
    const res = await PATCH(new Request('http://localhost/x', {
      method: 'PATCH', body: JSON.stringify({ accion: 'PRE_APROBAR', notas: 'Verifiqué ingresos y referencias.' }),
    }), { params: Promise.resolve({ id: 's1' }) })
    expect(res.status).toBe(409)
    expect(db.tablas.solicitud_credito[0].id_estado_solicitud).toBeUndefined()
  })
})
