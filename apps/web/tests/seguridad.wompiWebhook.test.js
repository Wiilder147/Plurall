import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHash } from 'node:crypto'
import { crearFakeDb } from './helpers/fakeSupabase.js'
import { firmaEventoWompiValida } from '../lib/wompi'

// ── NEW-07: firma según la documentación oficial de Wompi ──────────────────
// https://docs.wompi.co/docs/colombia/eventos/ — mismas entradas del ejemplo
// oficial. La doc muestra "por ejemplo" el hash 3476DDA5…, que NO es el SHA256
// de su propia cadena; el valor real (verificado con node:crypto) es 5A18EC5E….
describe('firmaEventoWompiValida (NEW-07)', () => {
  const eventoDoc = {
    data: { transaction: { id: '1234-1610641025-49201', status: 'APPROVED', amount_in_cents: 4490000 } },
    signature: {
      properties: ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'],
      checksum: '5A18EC5E8FDB7DF463E9F94774CBA8F583BA21BD04A09CEFF2EA68A4BC0AEFBE',
    },
    timestamp: 1530291411,
  }
  const secretoDoc = 'prod_events_OcHnIzeBl5socpwByQ4hA52Em3USQ93Z'

  it('acepta el evento de ejemplo de la documentación', () => {
    expect(firmaEventoWompiValida(eventoDoc, secretoDoc)).toBe(true)
  })
  it('rechaza si se altera el monto', () => {
    const alterado = structuredClone(eventoDoc)
    alterado.data.transaction.amount_in_cents = 1000
    expect(firmaEventoWompiValida(alterado, secretoDoc)).toBe(false)
  })
  it('falla cerrado sin secreto configurado (H2a)', () => {
    expect(firmaEventoWompiValida(eventoDoc, '')).toBe(false)
    expect(firmaEventoWompiValida(eventoDoc, undefined)).toBe(false)
  })
})

// ── Webhook: idempotencia, monto y doble aplicación (H1, H2c-e, H2g) ────────
const SECRET = 'test_events_secret'
// Un solo objeto: la ruta cachea su cliente a nivel de módulo, así que entre
// tests se reemplazan las tablas, no el objeto.
const db = crearFakeDb()
vi.mock('@/lib/supabase/service', () => ({ createServiceClient: () => db }))
vi.mock('@/lib/notificaciones', () => ({ notificarPagoConfirmado: async () => null }))

function evento({ referencia, status = 'APPROVED', centavos }) {
  const tx = { id: `tx-${referencia}-${status}`, status, amount_in_cents: centavos, reference: referencia }
  const timestamp = 1_700_000_000
  const checksum = createHash('sha256')
    .update(`${tx.id}${tx.status}${tx.amount_in_cents}${timestamp}${SECRET}`).digest('hex').toUpperCase()
  return {
    event: 'transaction.updated',
    data: { transaction: tx },
    signature: { properties: ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'], checksum },
    timestamp,
  }
}

const cuotaC1 = { id_cuota: 'c1', numero_cuota: 1, monto_capital: 100000, monto_interes: 20000, monto_total_cuota: 120000, monto_mora: 0, estado_previo: 'PENDIENTE' }

function sembrar() {
  Object.assign(db.tablas = {}, {
    credito: [{ id_credito: 'cr1', id_cliente: 'cl1', saldo_pendiente: 1_000_000, cuotas_pagadas: 0, cuotas_en_mora: 0, estado_credito: 'ACTIVO', saldo_a_favor: 50_000 }],
    cuota: [{ id_cuota: 'c1', id_plan_pago: 'p1', estado_cuota: 'PENDIENTE', monto_capital: 100000, monto_interes: 20000, monto_total_cuota: 120000, numero_cuota: 1 }],
    asignacion_asesor: [],
    pago: [],
  })
}
function preRegistro(ref, { monto, delta = 0 }) {
  db.tablas.pago.push({
    id_recibo: `r-${ref}`, id_cuota: 'c1', id_credito: 'cr1', monto_pagado: monto, monto_mora: 0,
    referencia_externa: ref, estado: 'PROCESANDO', cuotas_cubiertas: [cuotaC1], saldo_a_favor_delta: delta,
  })
}

async function enviar(ev) {
  const { POST } = await import('../app/api/webhooks/wompi/route.js')
  return POST(new Request('http://localhost/api/webhooks/wompi', { method: 'POST', body: JSON.stringify(ev) }))
}
const credito = () => db.tablas.credito[0]
const pago = (ref) => db.tablas.pago.find(p => p.referencia_externa === ref)

describe('POST /api/webhooks/wompi', () => {
  beforeEach(() => { process.env.WOMPI_EVENTS_SECRET = SECRET; sembrar() })

  it('evento aprobado válido confirma pago, cuota y baja el saldo una vez', async () => {
    preRegistro('PLR-A', { monto: 120000 })
    const res = await enviar(evento({ referencia: 'PLR-A', centavos: 12_000_000 }))
    expect(res.status).toBe(200)
    expect(pago('PLR-A').estado).toBe('CONFIRMADO')
    expect(db.tablas.cuota[0].estado_cuota).toBe('PAGADA')
    expect(credito().saldo_pendiente).toBe(900_000)
    expect(credito().cuotas_pagadas).toBe(1)
  })

  it('sin WOMPI_EVENTS_SECRET no procesa nada (H2a)', async () => {
    delete process.env.WOMPI_EVENTS_SECRET
    preRegistro('PLR-A', { monto: 120000 })
    const res = await enviar(evento({ referencia: 'PLR-A', centavos: 12_000_000 }))
    expect(res.status).toBeGreaterThanOrEqual(400)
    expect(pago('PLR-A').estado).toBe('PROCESANDO')
    expect(credito().saldo_pendiente).toBe(1_000_000)
  })

  it('la misma notificación entregada dos veces se aplica una sola vez (H2d)', async () => {
    preRegistro('PLR-A', { monto: 120000 })
    const ev = evento({ referencia: 'PLR-A', centavos: 12_000_000 })
    await Promise.all([enviar(ev), enviar(ev)])
    expect(credito().saldo_pendiente).toBe(900_000)
    expect(credito().cuotas_pagadas).toBe(1)
  })

  it('monto distinto al pre-registrado no se aplica (H2c)', async () => {
    preRegistro('PLR-A', { monto: 120000 })
    await enviar(evento({ referencia: 'PLR-A', centavos: 150_000 }))
    expect(db.tablas.cuota[0].estado_cuota).toBe('PENDIENTE')
    expect(credito().saldo_pendiente).toBe(1_000_000)
    expect(pago('PLR-A').estado).not.toBe('CONFIRMADO')
  })

  it('dos pagos que cubren la misma cuota no bajan el saldo dos veces ni gastan dos veces el saldo a favor (H1)', async () => {
    preRegistro('PLR-A', { monto: 70000, delta: -50000 })
    preRegistro('PLR-B', { monto: 70000, delta: -50000 })
    await enviar(evento({ referencia: 'PLR-A', centavos: 7_000_000 }))
    await enviar(evento({ referencia: 'PLR-B', centavos: 7_000_000 }))
    expect(credito().saldo_pendiente).toBe(900_000)
    expect(credito().cuotas_pagadas).toBe(1)
    expect(credito().saldo_a_favor).toBe(0)
  })

  it('un DECLINED posterior no revierte un pago ya CONFIRMADO (H2e)', async () => {
    preRegistro('PLR-A', { monto: 120000 })
    await enviar(evento({ referencia: 'PLR-A', centavos: 12_000_000 }))
    await enviar(evento({ referencia: 'PLR-A', status: 'DECLINED', centavos: 12_000_000 }))
    expect(pago('PLR-A').estado).toBe('CONFIRMADO')
  })

  it('pagar la última cuota deja el crédito en PAGADO, no CANCELADO (J-13)', async () => {
    db.tablas.credito[0].saldo_pendiente = 100_000
    preRegistro('PLR-A', { monto: 120000 })
    await enviar(evento({ referencia: 'PLR-A', centavos: 12_000_000 }))
    expect(credito().saldo_pendiente).toBe(0)
    expect(credito().estado_credito).toBe('PAGADO')
  })

  it('DECLINED sin pre-registro no rompe el webhook (H2g)', async () => {
    const res = await enviar(evento({ referencia: 'PLR-ZZZZ-1', status: 'DECLINED', centavos: 100 }))
    expect(res.status).toBe(200)
  })
})
