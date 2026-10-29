import { describe, it, expect } from 'vitest'
import { distribuirPagoEfectivo } from '../lib/credito'

// J-06/J-07 (decisión de negocio 29-oct-2026): el efectivo se aplica a las
// cuotas vencidas de la más antigua a la más reciente; en cada una primero
// intereses y luego capital; el excedente queda como saldo a favor.
const c = (id, capital, interes, pagado = {}) => ({
  id_cuota: id, monto_capital: capital, monto_interes: interes,
  capital_pagado: pagado.capital ?? 0, interes_pagado: pagado.interes ?? 0,
})

describe('distribuirPagoEfectivo', () => {
  it('pago parcial (caso J-07): primero interés, luego capital; suma = monto pagado', () => {
    const r = distribuirPagoEfectivo(100_000, [c('a', 150_000, 40_000)])
    expect(r.aplicaciones).toEqual([{ id_cuota: 'a', interes: 40_000, capital: 60_000, completa: false }])
    expect(r.excedente).toBe(0)
  })

  it('pago exacto de la cuota la completa', () => {
    const r = distribuirPagoEfectivo(190_000, [c('a', 150_000, 40_000)])
    expect(r.aplicaciones[0]).toMatchObject({ interes: 40_000, capital: 150_000, completa: true })
    expect(r.excedente).toBe(0)
  })

  it('recorre las cuotas vencidas en orden y deja la última parcial', () => {
    const r = distribuirPagoEfectivo(250_000, [c('a', 150_000, 40_000), c('b', 150_000, 40_000)])
    expect(r.aplicaciones).toEqual([
      { id_cuota: 'a', interes: 40_000, capital: 150_000, completa: true },
      { id_cuota: 'b', interes: 40_000, capital: 20_000, completa: false },
    ])
  })

  it('tiene en cuenta lo ya abonado antes a la cuota', () => {
    const r = distribuirPagoEfectivo(90_000, [c('a', 150_000, 40_000, { interes: 40_000, capital: 60_000 })])
    expect(r.aplicaciones).toEqual([{ id_cuota: 'a', interes: 0, capital: 90_000, completa: true }])
  })

  it('el excedente sobre todas las cuotas vencidas queda como saldo a favor', () => {
    const r = distribuirPagoEfectivo(200_000, [c('a', 150_000, 40_000)])
    expect(r.excedente).toBe(10_000)
  })

  it('sin cuotas vencidas todo es saldo a favor', () => {
    expect(distribuirPagoEfectivo(50_000, [])).toEqual({ aplicaciones: [], excedente: 50_000 })
  })

  it('invariante contable: aplicado + excedente = monto recibido (con centavos)', () => {
    const cuotas = [c('a', 148_462.4, 41_569.6), c('b', 151_543.1, 38_488.9)]
    for (const monto of [1, 1_500, 41_569.6, 99_999.99, 190_032, 300_000, 500_000.55]) {
      const r = distribuirPagoEfectivo(monto, cuotas)
      const aplicado = r.aplicaciones.reduce((s, a) => s + a.interes + a.capital, 0)
      expect(Math.round((aplicado + r.excedente) * 100)).toBe(Math.round(monto * 100))
      for (const a of r.aplicaciones) {
        const cu = cuotas.find(x => x.id_cuota === a.id_cuota)
        expect(a.interes).toBeLessThanOrEqual(cu.monto_interes)
        expect(a.capital).toBeLessThanOrEqual(cu.monto_capital)
        // nunca capital antes de terminar el interés de la misma cuota
        if (a.capital > 0) expect(a.interes).toBe(cu.monto_interes)
      }
    }
  })
})
