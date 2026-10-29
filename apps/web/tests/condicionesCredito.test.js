import { describe, it, expect } from 'vitest'
import { tasaEAaEM, validarCondicionesAprobacion } from '../lib/calculadora'

// NEW-05: el supervisor aprueba una tasa EA; el desembolso reconvierte la EM
// guardada con (1+EM)^12-1. Ida y vuelta debe devolver la misma EA.
describe('tasaEAaEM (NEW-05)', () => {
  it('28% EA → EM efectiva equivalente (no nominal 28/12)', () => {
    const em = tasaEAaEM(28)
    expect(em).toBeCloseTo(Math.pow(1.28, 1 / 12) - 1, 12)
    expect(em).not.toBeCloseTo(0.28 / 12, 4)
  })

  it('la EA reconstruida al desembolsar es la aprobada', () => {
    for (const ea of [12, 24.5, 28, 35]) {
      const eaDesembolso = (Math.pow(1 + tasaEAaEM(ea), 12) - 1) * 100
      expect(eaDesembolso).toBeCloseTo(ea, 9)
    }
  })
})

// M-15/M-16/M-17/M-18: el servidor no debe aceptar condiciones imposibles.
describe('validarCondicionesAprobacion', () => {
  const ok = { monto: 3_250_000, plazo: 24, tasaEM: tasaEAaEM(28) }

  it('acepta condiciones válidas', () => {
    expect(validarCondicionesAprobacion(ok)).toEqual([])
  })

  it('rechaza plazo negativo, cero o no entero (M-17/M-18)', () => {
    for (const plazo of [-36, -93, 0, 12.5, null, undefined, NaN, '24']) {
      const errores = validarCondicionesAprobacion({ ...ok, plazo })
      expect(errores.map(e => e.campo)).toContain('plazo')
    }
  })

  it('rechaza monto no positivo, no finito o fuera de la precisión de la BD (M-15)', () => {
    for (const monto of [0, -1, NaN, Infinity, null, 1e20]) {
      const errores = validarCondicionesAprobacion({ ...ok, monto })
      expect(errores.map(e => e.campo)).toContain('monto')
    }
  })

  it('rechaza tasa no positiva o no finita (M-15)', () => {
    for (const tasaEM of [0, -0.1, NaN, null, Infinity]) {
      const errores = validarCondicionesAprobacion({ ...ok, tasaEM })
      expect(errores.map(e => e.campo)).toContain('tasa')
    }
  })

  it('cada error indica campo y regla en un mensaje legible (M-16)', () => {
    const errores = validarCondicionesAprobacion({ monto: -1, plazo: -36, tasaEM: -2 })
    expect(errores).toHaveLength(3)
    for (const e of errores) {
      expect(typeof e.mensaje).toBe('string')
      expect(e.mensaje.length).toBeGreaterThan(10)
    }
  })
})
