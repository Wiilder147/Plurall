import { describe, it, expect } from 'vitest'
import { celularVisible, esCelularPlaceholder } from '../lib/telefono'
import { formatNombre, primerNombre, esApellidoPlaceholder } from '../lib/nombre'

// WF-03: el celular de relleno del trigger de registro no se muestra como número.
describe('celularVisible (WF-03)', () => {
  it('oculta "0000000000" y vacíos', () => {
    for (const v of ['0000000000', '000 000 0000', '', '  ', null, undefined]) {
      expect(esCelularPlaceholder(v)).toBe(true)
      expect(celularVisible(v)).toBeNull()
    }
  })

  it('un celular real se devuelve igual', () => {
    expect(celularVisible('3001234567')).toBe('3001234567')
    expect(celularVisible('3000000000')).toBe('3000000000')
  })
})

// WF-04: el apellido de relleno 'NOMBRE' no forma parte del nombre mostrado.
describe('formatNombre sin apellido de relleno (WF-04)', () => {
  it('omite "NOMBRE" como apellido (casos del reporte)', () => {
    expect(formatNombre({ primer_nombre: 'Laura', primer_apellido: 'NOMBRE' })).toBe('Laura')
    expect(formatNombre({ primer_nombre: 'Wiild', primer_apellido: 'NOMBRE', segundo_apellido: null })).toBe('Wiild')
    expect(esApellidoPlaceholder('NOMBRE')).toBe(true)
  })

  it('conserva apellidos reales y el resto de partes', () => {
    expect(formatNombre({ primer_nombre: 'Ana', segundo_nombre: 'María', primer_apellido: 'Pérez', segundo_apellido: 'Gómez' }))
      .toBe('Ana María Pérez Gómez')
    expect(formatNombre({ primer_nombre: 'Luis', primer_apellido: 'Nombrero' })).toBe('Luis Nombrero')
    expect(esApellidoPlaceholder('Nombre')).toBe(false)
  })

  it('el primer nombre para saludos no cambia', () => {
    expect(primerNombre({ primer_nombre: 'Laura', primer_apellido: 'NOMBRE' })).toBe('Laura')
  })
})
