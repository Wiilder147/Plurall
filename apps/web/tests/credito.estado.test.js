import { describe, it, expect } from 'vitest'
import { nuevoEstadoCredito, CREDITO_SALDADO } from '../lib/credito'

// J-13 (decisión de negocio 29-oct-2026): saldar el crédito con pagos
// normales → PAGADO. CANCELADO queda para prepago/anulación.
describe('nuevoEstadoCredito (J-13)', () => {
  it('saldo 0 → PAGADO', () => {
    expect(nuevoEstadoCredito(0, 0, 'ACTIVO')).toBe('PAGADO')
    expect(nuevoEstadoCredito(-5, 1, 'EN_MORA')).toBe('PAGADO')
  })
  it('sin cuotas en mora → ACTIVO; con mora → EN_MORA', () => {
    expect(nuevoEstadoCredito(1000, 0, 'EN_MORA')).toBe('ACTIVO')
    expect(nuevoEstadoCredito(1000, 2, 'ACTIVO')).toBe('EN_MORA')
  })
  it('estados especiales no se tocan si queda saldo', () => {
    expect(nuevoEstadoCredito(1000, 0, 'CASTIGADO')).toBe('CASTIGADO')
  })
  it('PAGADO y CANCELADO cuentan como crédito saldado', () => {
    expect(CREDITO_SALDADO).toEqual(expect.arrayContaining(['PAGADO', 'CANCELADO']))
  })
})
