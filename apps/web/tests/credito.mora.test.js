import { describe, it, expect } from 'vitest'
import { resumenMora } from '../lib/credito'

// M-04: "Días mora máx." del Estado de Cuenta. Cuota en atraso según RN-08:
// fecha_vencimiento < hoy y no pagada (aunque el cron no la haya marcado).
const hoy = new Date('2026-10-13T15:00:00Z')

describe('resumenMora (M-04)', () => {
  it('caso del reporte: cuota #1 vencida el 16-feb → 239 días al 13-oct (no 75)', () => {
    const cuotas = [
      { numero_cuota: 1, estado_cuota: 'VENCIDA', fecha_vencimiento: '2026-02-16', monto_total_cuota: 266_583 },
      { numero_cuota: 2, estado_cuota: 'VENCIDA', fecha_vencimiento: '2026-03-16', monto_total_cuota: 266_583 },
      { numero_cuota: 9, estado_cuota: 'PENDIENTE', fecha_vencimiento: '2026-10-16', monto_total_cuota: 266_583 },
    ]
    expect(resumenMora(cuotas, 75, hoy).diasMoraMax).toBe(239)
  })

  it('segundo caso del reporte: guardado 0 con cuota vencida el 9-oct → 4 días', () => {
    const cuotas = [{ estado_cuota: 'VENCIDA', fecha_vencimiento: '2026-10-09', monto_total_cuota: 100 }]
    expect(resumenMora(cuotas, 0, hoy).diasMoraMax).toBe(4)
  })

  it('cuenta como atrasada una PENDIENTE con fecha pasada (cron no ejecutado, RN-08)', () => {
    const cuotas = [{ estado_cuota: 'PENDIENTE', fecha_vencimiento: '2026-10-01', monto_total_cuota: 100 }]
    const r = resumenMora(cuotas, 0, hoy)
    expect(r.enAtraso).toHaveLength(1)
    expect(r.diasMoraMax).toBe(12)
  })

  it('conserva el máximo histórico si es mayor que el atraso actual', () => {
    expect(resumenMora([], 40, hoy).diasMoraMax).toBe(40)
  })

  it('cuotas pagadas no cuentan', () => {
    const cuotas = [{ estado_cuota: 'PAGADA_MORA', fecha_vencimiento: '2026-01-01', monto_total_cuota: 100 }]
    expect(resumenMora(cuotas, 0, hoy)).toEqual({ enAtraso: [], diasMoraMax: 0 })
  })
})
