import { describe, it, expect, vi, afterEach } from 'vitest'
import { calcularMora } from '../lib/pagos'

// J-11 (decisión de negocio 29-oct-2026): la mora se calcula sobre el
// CAPITAL vencido, no sobre la cuota total (evita cobrar interés sobre interés).
describe('calcularMora (flujo de pago Wompi) — base capital (J-11)', () => {
  afterEach(() => vi.useRealTimers())

  const cuota = { estado_cuota: 'VENCIDA', fecha_vencimiento: '2026-10-01', monto_capital: 100000, monto_interes: 20000, monto_total_cuota: 120000 }

  it('10 días al 0,1% diario sobre capital 100.000 → 1.000 (no 1.200)', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 9, 11, 12))
    expect(calcularMora(cuota, 0.001)).toBe(1000)
  })

  it('una cuota no vencida no genera mora', () => {
    expect(calcularMora({ ...cuota, estado_cuota: 'PENDIENTE' }, 0.001)).toBe(0)
  })
})
