import { describe, it, expect } from 'vitest'
import { documentoVisible, esDniPlaceholder, esDniValido } from '../lib/dni'

// WF-02: los documentos de relleno del trigger de registro no se muestran como cédula.
describe('documentoVisible (WF-02)', () => {
  it('oculta los valores del reporte y los formatos de todos los triggers', () => {
    for (const v of ['SNbb5b2ce909364228', 'SN6b957928114542a9', 'SN-f1cddad8', 'SNab77bd2670f84a66',
                     'SN-3f2a1b4c-0d9e-4f6a-8b7c-1d2e3f4a5b6c']) {
      expect(esDniPlaceholder(v)).toBe(true)
      expect(documentoVisible(v)).toBeNull()
    }
  })

  it('vacío o nulo → null', () => {
    expect(documentoVisible(null)).toBeNull()
    expect(documentoVisible(undefined)).toBeNull()
    expect(documentoVisible('  ')).toBeNull()
  })

  it('una cédula real se devuelve igual', () => {
    expect(documentoVisible('1020304050')).toBe('1020304050')
    expect(documentoVisible(' 79123456 ')).toBe('79123456')
  })
})

describe('esDniValido', () => {
  it('solo dígitos, entre 5 y 12', () => {
    expect(esDniValido('1020304050')).toBe(true)
    expect(esDniValido('12345')).toBe(true)
    expect(esDniValido('1234')).toBe(false)
    expect(esDniValido('1234567890123')).toBe(false)
    expect(esDniValido('10.203.040')).toBe(false)
    expect(esDniValido('')).toBe(false)
    expect(esDniValido(1020304050)).toBe(false)
  })
})
