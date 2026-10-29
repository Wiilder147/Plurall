import { describe, it, expect } from 'vitest'
import { fechasVencimientoMensual } from '../lib/calculadora'

// J-03: las cuotas de un crédito mensual deben vencer una por mes calendario,
// sin saltar meses aunque el día del desembolso no exista en el mes destino.
describe('fechasVencimientoMensual (J-03)', () => {
  it('desembolso en un día que existe en todos los meses conserva el día', () => {
    expect(fechasVencimientoMensual(new Date(2026, 0, 15), 3))
      .toEqual(['2026-02-15', '2026-03-15', '2026-04-15'])
  })

  it('desembolso el 31 de enero: la primera cuota vence en febrero, no en marzo', () => {
    expect(fechasVencimientoMensual(new Date(2026, 0, 31), 4))
      .toEqual(['2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31'])
  })

  it('año bisiesto: 31 de enero → 29 de febrero', () => {
    expect(fechasVencimientoMensual(new Date(2028, 0, 31), 1)).toEqual(['2028-02-29'])
  })

  it('desembolso el 31 de agosto no salta septiembre', () => {
    expect(fechasVencimientoMensual(new Date(2026, 7, 31), 2))
      .toEqual(['2026-09-30', '2026-10-31'])
  })

  it('cruza el fin de año', () => {
    expect(fechasVencimientoMensual(new Date(2026, 10, 30), 3))
      .toEqual(['2026-12-30', '2027-01-30', '2027-02-28'])
  })

  it('cada cuota cae en un mes calendario distinto y consecutivo', () => {
    for (const dia of [28, 29, 30, 31]) {
      const fechas = fechasVencimientoMensual(new Date(2026, 0, dia), 24)
      const meses = fechas.map(f => f.slice(0, 7))
      expect(new Set(meses).size).toBe(24)
      for (let i = 1; i < fechas.length; i++) {
        const [y0, m0] = meses[i - 1].split('-').map(Number)
        const [y1, m1] = meses[i].split('-').map(Number)
        expect((y1 * 12 + m1) - (y0 * 12 + m0)).toBe(1)
      }
    }
  })
})
