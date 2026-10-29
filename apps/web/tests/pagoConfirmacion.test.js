import { describe, it, expect } from 'vitest'
import { estadoTrasVerificacion } from '../lib/pagoConfirmacion'

// J-09: si el webhook aún no confirma, la pantalla debe salir del spinner
// "cargando" y pasar a "procesando" (donde se muestra el aviso de demora).
describe('estadoTrasVerificacion (J-09)', () => {
  it('sin resultado definitivo, "cargando" pasa a "procesando"', () => {
    expect(estadoTrasVerificacion('cargando', false)).toBe('procesando')
  })
  it('un estado definitivo no se pisa', () => {
    expect(estadoTrasVerificacion('confirmado', true)).toBe('confirmado')
    expect(estadoTrasVerificacion('fallido', true)).toBe('fallido')
  })
  it('"procesando" se mantiene mientras no haya resultado', () => {
    expect(estadoTrasVerificacion('procesando', false)).toBe('procesando')
  })
})
