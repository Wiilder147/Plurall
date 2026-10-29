import { describe, it, expect, vi, beforeEach } from 'vitest'
import { crearFakeDb } from './helpers/fakeSupabase.js'

// J-06/J-07: un pago en efectivo registrado por el asesor debe reflejarse en
// cuota y crédito, con capital + interés = monto aplicado.
const db = crearFakeDb()
const sesion = { user: { id: 'asesor-1' } }
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ ...db, from: db.from, auth: { getUser: async () => ({ data: { user: sesion.user }, error: null }) } }),
}))
vi.mock('@/lib/supabase/service', () => ({ createServiceClient: () => db }))

function sembrar() {
  db.tablas = {
    perfil_usuario: [{ id: 'asesor-1', rol: { nombre_rol: 'ASESOR' } }],
    asignacion_asesor: [
      { id_asignacion: 'as1', id_asesor: 'asesor-1', id_cliente: 'cl1', activa: true },
      { id_asignacion: 'as2', id_asesor: 'asesor-1', id_cliente: 'cl2', activa: true },
    ],
    gestion_cobranza: [],
    credito: [
      { id_credito: 'cr1', id_cliente: 'cl1', saldo_pendiente: 300_000, cuotas_pagadas: 0, cuotas_en_mora: 2, estado_credito: 'EN_MORA', saldo_a_favor: 0 },
      { id_credito: 'cr2', id_cliente: 'cl2', saldo_pendiente: 300_000, cuotas_pagadas: 0, cuotas_en_mora: 0, estado_credito: 'ACTIVO', saldo_a_favor: 0 },
    ],
    plan_pago: [{ id_plan_pago: 'p1', id_credito: 'cr1' }, { id_plan_pago: 'p2', id_credito: 'cr2' }],
    cuota: [
      { id_cuota: 'q1', id_plan_pago: 'p1', numero_cuota: 1, estado_cuota: 'VENCIDA', fecha_vencimiento: '2026-08-01', monto_capital: 150_000, monto_interes: 40_000, monto_total_cuota: 190_000 },
      { id_cuota: 'q2', id_plan_pago: 'p1', numero_cuota: 2, estado_cuota: 'VENCIDA', fecha_vencimiento: '2026-09-01', monto_capital: 150_000, monto_interes: 40_000, monto_total_cuota: 190_000 },
    ],
    pago: [],
  }
}

async function registrar(body) {
  const { POST } = await import('../app/api/asesor/gestion/route.js')
  return POST(new Request('http://localhost/api/asesor/gestion', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clienteId: 'cl1', creditoId: 'cr1', tipo_gestion: 'VISITA', resultado: 'PAGO_RECIBIDO', ...body }),
  }))
}
const cuota = (id) => db.tablas.cuota.find(c => c.id_cuota === id)
const cr1 = () => db.tablas.credito.find(c => c.id_credito === 'cr1')

describe('POST /api/asesor/gestion — pago en efectivo', () => {
  beforeEach(sembrar)

  it('J-06: una cuota completa en efectivo marca la cuota PAGADA y actualiza el crédito', async () => {
    const res = await registrar({ monto_recibido: 190_000 })
    expect(res.status).toBe(200)
    expect(cuota('q1').estado_cuota).toBe('PAGADA')
    expect(cr1().saldo_pendiente).toBe(150_000)
    expect(cr1().cuotas_pagadas).toBe(1)
    expect(cr1().cuotas_en_mora).toBe(1)
  })

  it('J-07: un pago parcial registra interés primero y capital + interés = monto', async () => {
    await registrar({ monto_recibido: 100_000 })
    const pagos = db.tablas.pago
    const total = pagos.reduce((s, p) => s + p.monto_pagado, 0)
    expect(total).toBe(100_000)
    for (const p of pagos) {
      expect(p.monto_capital + p.monto_interes + p.monto_mora).toBeLessThanOrEqual(p.monto_pagado)
    }
    expect(pagos[0]).toMatchObject({ monto_interes: 40_000, monto_capital: 60_000, estado: 'CONFIRMADO' })
    expect(cuota('q1').estado_cuota).toBe('VENCIDA')
    expect(cr1().saldo_pendiente).toBe(240_000)
  })

  it('el excedente sobre las cuotas vencidas queda como saldo a favor', async () => {
    await registrar({ monto_recibido: 400_000 })
    expect(cuota('q1').estado_cuota).toBe('PAGADA')
    expect(cuota('q2').estado_cuota).toBe('PAGADA')
    expect(cr1().saldo_pendiente).toBe(0)
    expect(cr1().estado_credito).toBe('PAGADO')
    expect(cr1().saldo_a_favor).toBe(20_000)
    expect(db.tablas.pago.reduce((s, p) => s + p.monto_pagado, 0)).toBe(400_000)
  })

  it('dos abonos parciales sucesivos completan la cuota (avance guardado en la cuota)', async () => {
    await registrar({ monto_recibido: 100_000 })
    expect(cuota('q1').estado_cuota).toBe('VENCIDA')
    expect(cuota('q1').monto_pagado_real).toBe(100_000)
    await registrar({ monto_recibido: 90_000 })
    expect(cuota('q1').estado_cuota).toBe('PAGADA')
    expect(cr1().saldo_pendiente).toBe(150_000)
    expect(cr1().cuotas_pagadas).toBe(1)
  })

  it('un pago CONFIRMADO insertado por el cliente (RLS M4) no reduce lo que debe', async () => {
    // El cliente puede insertar filas en pago para su crédito vía PostgREST.
    db.tablas.pago.push({ id_cuota: 'q1', id_credito: 'cr1', monto_pagado: 190_000, monto_capital: 150_000,
      monto_interes: 40_000, monto_mora: 0, metodo_pago: 'EFECTIVO', estado: 'CONFIRMADO', referencia_externa: 'EFE-FALSO-1' })
    await registrar({ monto_recibido: 1_000 })
    expect(cuota('q1').estado_cuota).toBe('VENCIDA')
    expect(cr1().cuotas_pagadas).toBe(0)
    expect(cr1().saldo_pendiente).toBe(300_000)
  })

  it('no permite abonar a un crédito que no pertenece al cliente indicado', async () => {
    const res = await registrar({ creditoId: 'cr2', monto_recibido: 190_000 })
    expect(res.status).toBe(400)
    expect(db.tablas.pago).toHaveLength(0)
  })

  it('rechaza montos no válidos', async () => {
    for (const monto_recibido of [-5, 'abc', 0]) {
      sembrar()
      const res = await registrar({ monto_recibido })
      expect(res.status).toBe(400)
      expect(db.tablas.pago).toHaveLength(0)
    }
  })
})
