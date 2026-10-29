import { describe, it, expect } from 'vitest'
import { fechaCierrePorCredito } from '../lib/credito'

// J-10: la "fecha de finalización" del historial debe salir del último pago
// real de las cuotas (escrito solo por el servidor), no de updated_at.
describe('fechaCierrePorCredito (J-10)', () => {
  it('toma el último fecha_pago_real de cada crédito', () => {
    const cuotas = [
      { fecha_pago_real: '2026-01-10', plan_pago: { id_credito: 'a' } },
      { fecha_pago_real: '2026-03-05', plan_pago: { id_credito: 'a' } },
      { fecha_pago_real: '2026-02-20', plan_pago: { id_credito: 'a' } },
      { fecha_pago_real: '2025-12-01', plan_pago: { id_credito: 'b' } },
    ]
    expect(fechaCierrePorCredito(cuotas)).toEqual({ a: '2026-03-05', b: '2025-12-01' })
  })
  it('ignora cuotas sin pago y tolera listas vacías', () => {
    expect(fechaCierrePorCredito([{ fecha_pago_real: null, plan_pago: { id_credito: 'a' } }])).toEqual({})
    expect(fechaCierrePorCredito(null)).toEqual({})
  })
})
