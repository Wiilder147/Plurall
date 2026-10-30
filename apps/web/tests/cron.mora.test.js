import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { crearFakeDb } from './helpers/fakeSupabase.js'

// J-04 / M-04: el cron de mora debe (1) refrescar cuotas_en_mora y
// dias_mora_maximo también de créditos YA en mora, (2) notificar solo en la
// transición ACTIVO→EN_MORA y (3) usar la fecha de Colombia, no UTC.
const db = crearFakeDb()
const notificar = vi.fn(async () => null)
vi.mock('@supabase/supabase-js', () => ({ createClient: () => db }))
vi.mock('@/lib/notificacionesInApp', () => ({ notificarAsesorCliente: (...a) => notificar(...a) }))

const ejecutar = async () => {
  const { GET } = await import('../app/api/cron/mora/route.js')
  return GET(new Request('http://localhost/api/cron/mora', { headers: { authorization: 'Bearer s' } }))
}
const credito = (id) => db.tablas.credito.find(c => c.id_credito === id)
const cuota = (id) => db.tablas.cuota.find(c => c.id_cuota === id)

beforeEach(() => {
  process.env.CRON_SECRET = 's'
  notificar.mockClear()
  db.tablas = {
    plan_pago: [{ id_plan_pago: 'p1', id_credito: 'c1' }, { id_plan_pago: 'p2', id_credito: 'c2' }],
    credito: [
      { id_credito: 'c1', id_cliente: 'cl1', estado_credito: 'EN_MORA', cuotas_en_mora: 1, dias_mora_maximo: 75 },
      { id_credito: 'c2', id_cliente: 'cl2', estado_credito: 'ACTIVO', cuotas_en_mora: 0, dias_mora_maximo: 0 },
    ],
    cuota: [
      { id_cuota: 'a1', id_plan_pago: 'p1', plan_pago: { id_credito: 'c1' }, estado_cuota: 'VENCIDA', fecha_vencimiento: '2026-02-16' },
      { id_cuota: 'a2', id_plan_pago: 'p1', plan_pago: { id_credito: 'c1' }, estado_cuota: 'VENCIDA', fecha_vencimiento: '2026-03-16' },
      { id_cuota: 'a3', id_plan_pago: 'p1', plan_pago: { id_credito: 'c1' }, estado_cuota: 'PENDIENTE', fecha_vencimiento: '2026-04-16' },
      { id_cuota: 'b1', id_plan_pago: 'p2', plan_pago: { id_credito: 'c2' }, estado_cuota: 'PENDIENTE', fecha_vencimiento: '2026-10-09' },
      { id_cuota: 'b2', id_plan_pago: 'p2', plan_pago: { id_credito: 'c2' }, estado_cuota: 'PENDIENTE', fecha_vencimiento: '2026-11-09' },
    ],
  }
})
afterEach(() => { vi.useRealTimers(); delete process.env.CRON_SECRET })

describe('GET /api/cron/mora', () => {
  it('refresca un crédito que ya estaba en mora: 3 cuotas vencidas y 239 días (caso M-04)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-13T15:00:00-05:00'))
    await ejecutar()
    expect(credito('c1').cuotas_en_mora).toBe(3)
    expect(credito('c1').dias_mora_maximo).toBe(239)
  })

  it('un crédito al día con cuota vencida pasa a EN_MORA y se notifica UNA sola vez', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-13T15:00:00-05:00'))
    await ejecutar()
    expect(cuota('b1').estado_cuota).toBe('VENCIDA')
    expect(credito('c2')).toMatchObject({ estado_credito: 'EN_MORA', cuotas_en_mora: 1, dias_mora_maximo: 4 })
    await ejecutar()
    const avisosC2 = notificar.mock.calls.filter(([idCliente]) => idCliente === 'cl2')
    expect(avisosC2).toHaveLength(1)
    // c1 ya estaba en mora: no es una entrada nueva en mora
    expect(notificar.mock.calls.filter(([idCliente]) => idCliente === 'cl1')).toHaveLength(0)
  })

  it('usa la fecha de Colombia: a las 23:55 del 9-oct una cuota que vence el 9-oct NO está vencida', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-09T23:55:00-05:00'))
    await ejecutar()
    expect(cuota('b1').estado_cuota).toBe('PENDIENTE')
    expect(credito('c2').estado_credito).toBe('ACTIVO')
  })
})
