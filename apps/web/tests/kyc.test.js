import { describe, it, expect, beforeEach } from 'vitest'
import { crearFakeDb } from './helpers/fakeSupabase.js'
import { tieneKycRechazado, rechazarSolicitudesPorKyc } from '../lib/kyc'

// M-01 (decisión de negocio 29-oct-2026): si un documento KYC se rechaza, la
// solicitud de crédito activa se rechaza automáticamente; y ningún flujo
// puede aprobar/desembolsar con un KYC rechazado.
const db = crearFakeDb()
const E = { PENDIENTE: 'e-pen', EN_ESTUDIO: 'e-est', APROBADA: 'e-apr', RECHAZADA: 'e-rec', DESEMBOLSADA: 'e-des' }

beforeEach(() => {
  db.tablas = {
    estado_solicitud: Object.entries(E).map(([nombre, id]) => ({ nombre, id_estado_solicitud: id })),
    documento_cliente: [
      { id_documento: 'd1', id_cliente: 'cl1', tipo_documento: 'CEDULA_FRONTAL', estado_verificacion: 'APROBADO', activo: true },
      { id_documento: 'd2', id_cliente: 'cl1', tipo_documento: 'CEDULA_TRASERA', estado_verificacion: 'RECHAZADO', activo: true },
      { id_documento: 'd3', id_cliente: 'cl2', tipo_documento: 'CEDULA_TRASERA', estado_verificacion: 'RECHAZADO', activo: false },
    ],
    solicitud_credito: [
      { id_solicitud: 's1', id_cliente: 'cl1', id_estado_solicitud: E.EN_ESTUDIO },
      { id_solicitud: 's2', id_cliente: 'cl1', id_estado_solicitud: E.DESEMBOLSADA },
      { id_solicitud: 's3', id_cliente: 'cl3', id_estado_solicitud: E.PENDIENTE },
    ],
    decision_solicitud: [],
  }
})

describe('KYC rechazado (M-01)', () => {
  it('detecta un documento activo rechazado; ignora los inactivos', async () => {
    expect(await tieneKycRechazado(db, 'cl1')).toBe(true)
    expect(await tieneKycRechazado(db, 'cl2')).toBe(false)
    expect(await tieneKycRechazado(db, 'cl3')).toBe(false)
  })

  it('rechaza la solicitud activa del cliente con decisión trazable; no toca desembolsadas ni otros clientes', async () => {
    const n = await rechazarSolicitudesPorKyc(db, { idCliente: 'cl1', idUsuario: 'staff-1', motivo: 'Cédula ilegible' })
    expect(n).toBe(1)
    const sol = (id) => db.tablas.solicitud_credito.find(s => s.id_solicitud === id)
    expect(sol('s1').id_estado_solicitud).toBe(E.RECHAZADA)
    expect(sol('s2').id_estado_solicitud).toBe(E.DESEMBOLSADA)
    expect(sol('s3').id_estado_solicitud).toBe(E.PENDIENTE)
    expect(db.tablas.decision_solicitud).toHaveLength(1)
    expect(db.tablas.decision_solicitud[0]).toMatchObject({ id_solicitud: 's1', resultado: 'RECHAZADO', id_analista: 'staff-1' })
    expect(db.tablas.decision_solicitud[0].comentarios_cliente).toMatch(/documento/i)
  })
})
