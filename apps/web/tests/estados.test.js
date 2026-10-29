import { describe, it, expect } from 'vitest'
import { labelEstadoCredito } from '../lib/estados'

// M-02 / M-03: el estado del crédito se muestra redactado para el usuario,
// igual que en la tarjeta de "Mis Documentos", nunca como código interno.
describe('labelEstadoCredito', () => {
  it('traduce los estados conocidos', () => {
    expect(labelEstadoCredito('EN_MORA')).toBe('En mora')
    expect(labelEstadoCredito('ACTIVO')).toBe('Activo')
    expect(labelEstadoCredito('PAGADO')).toBe('Pagado')
    expect(labelEstadoCredito('CANCELADO')).toBe('Cancelado')
    expect(labelEstadoCredito('CASTIGADO')).toBe('Castigado')
  })

  it('nunca devuelve guiones bajos ni el código en mayúsculas sostenidas', () => {
    for (const e of ['EN_MORA', 'ESTADO_NUEVO_X']) {
      const label = labelEstadoCredito(e)
      expect(label).not.toMatch(/_/)
      expect(label).not.toBe(e)
    }
  })

  it('valores vacíos no rompen', () => {
    expect(labelEstadoCredito(null)).toBe('—')
    expect(labelEstadoCredito(undefined)).toBe('—')
  })
})
