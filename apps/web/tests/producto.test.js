import { describe, it, expect, vi, afterEach } from 'vitest'
import { MONTO_MIN, MONTO_MAX, PLAZOS, tasaUsuraEA, tasaMoraDiariaMaxima } from '../lib/producto'
import { validarCondicionesAprobacion, tasaEAaEM } from '../lib/calculadora'
import { calcularMora } from '../lib/pagos'

// Reglas de producto confirmadas por negocio (29-oct-2026):
// monto $400.000–$10.000.000; plazos 12, 24 o 36 meses; tasa ≤ usura vigente.
describe('reglas de producto', () => {
  it('constantes', () => {
    expect(MONTO_MIN).toBe(400_000)
    expect(MONTO_MAX).toBe(10_000_000)
    expect(PLAZOS).toEqual([12, 24, 36])
    expect(tasaUsuraEA()).toBe(28.59) // Superfinanciera, consumo, octubre 2026
  })

  const ok = { monto: 3_250_000, plazo: 24, tasaEM: tasaEAaEM(28) }
  it('aprobación dentro de los límites', () => {
    expect(validarCondicionesAprobacion(ok)).toEqual([])
    expect(validarCondicionesAprobacion({ ...ok, monto: 400_000, plazo: 36 })).toEqual([])
    expect(validarCondicionesAprobacion({ ...ok, monto: 10_000_000, plazo: 12 })).toEqual([])
  })
  it('rechaza monto fuera de $400.000–$10.000.000', () => {
    for (const monto of [399_999, 10_000_001, 100_000]) {
      expect(validarCondicionesAprobacion({ ...ok, monto }).map(e => e.campo)).toContain('monto')
    }
  })
  it('rechaza plazos distintos de 12, 24 o 36', () => {
    for (const plazo of [30, 18, 6, 48]) {
      expect(validarCondicionesAprobacion({ ...ok, plazo }).map(e => e.campo)).toContain('plazo')
    }
  })
  it('rechaza tasa por encima de la usura', () => {
    expect(validarCondicionesAprobacion({ ...ok, tasaEM: tasaEAaEM(28.59) })).toEqual([])
    expect(validarCondicionesAprobacion({ ...ok, tasaEM: tasaEAaEM(30) }).map(e => e.campo)).toContain('tasa')
  })
})

// NEW-08: la mora pactada (0,1 % diario ≈ 44 % EA) supera la tasa máxima legal;
// el contrato dice "tasa máxima legal" → se topa a la usura equivalente diaria.
describe('mora topada a la usura (NEW-08)', () => {
  afterEach(() => vi.useRealTimers())
  it('tasa diaria máxima = equivalente diario de la usura EA', () => {
    expect(tasaMoraDiariaMaxima()).toBeCloseTo(Math.pow(1.2859, 1 / 365) - 1, 12)
    expect(Math.pow(1.001, 365) - 1).toBeGreaterThan(0.2859)
  })
  it('calcularMora no cobra por encima del tope legal', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 9, 11, 12))
    const cuota = { estado_cuota: 'VENCIDA', fecha_vencimiento: '2026-10-01', monto_capital: 100000 }
    const tope = Math.round(100000 * tasaMoraDiariaMaxima() * 10 * 100) / 100
    expect(calcularMora(cuota, 0.001)).toBe(tope)
    expect(calcularMora(cuota, 0.0001)).toBe(100) // tasa menor que el tope se respeta
  })
})
