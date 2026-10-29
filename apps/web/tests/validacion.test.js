import { describe, it, expect } from 'vitest'
import { esEmailValido, esCelularValido } from '../lib/validacion'

describe('esEmailValido', () => {
  it('acepta correos completos', () => {
    expect(esEmailValido('usuario@gmail.com')).toBe(true)
    expect(esEmailValido('nombre.apellido+tag@empresa.com.co')).toBe(true)
    expect(esEmailValido('  con.espacios@gmail.com  ')).toBe(true) // hace trim
  })

  it('rechaza el caso reportado: dominio sin TLD', () => {
    expect(esEmailValido('sdasdasda@gmail')).toBe(false)
  })

  it('rechaza formatos incompletos o inválidos', () => {
    expect(esEmailValido('sin-arroba.com')).toBe(false)
    expect(esEmailValido('a@b')).toBe(false)
    expect(esEmailValido('a@b.')).toBe(false)
    expect(esEmailValido('a@.com')).toBe(false)
    expect(esEmailValido('a b@gmail.com')).toBe(false)
    expect(esEmailValido('a@gmail.c')).toBe(false) // TLD de 1 letra
    expect(esEmailValido('')).toBe(false)
    expect(esEmailValido(null)).toBe(false)
    expect(esEmailValido(undefined)).toBe(false)
  })
})

describe('esCelularValido', () => {
  it('acepta celulares colombianos de 10 dígitos', () => {
    expect(esCelularValido('3001234567')).toBe(true)
  })

  it('rechaza longitudes distintas de 10', () => {
    expect(esCelularValido('300123456')).toBe(false)
    expect(esCelularValido('30012345678')).toBe(false)
    expect(esCelularValido('')).toBe(false)
  })
})

// M-05 / M-14 / M-10 / M-13: textos libres con longitud mínima/máxima y contenido real
import { validarTextoLibre, REGLAS_TEXTO } from '../lib/validacion'
describe('validarTextoLibre', () => {
  const { notaAsesor, motivoCatalogo } = REGLAS_TEXTO
  it('rechaza "-" y textos sin letras (M-05, M-14)', () => {
    expect(validarTextoLibre('-', notaAsesor)).toMatch(/al menos/i)
    expect(validarTextoLibre('---------- ', notaAsesor)).toMatch(/letras/i)
  })
  it('rechaza textos que superan el máximo (M-05: 500+ caracteres, M-13: 1.000+)', () => {
    expect(validarTextoLibre('a'.repeat(501), notaAsesor)).toMatch(/máximo/i)
    expect(validarTextoLibre('Motivo '.repeat(200), motivoCatalogo)).toMatch(/máximo/i)
  })
  it('acepta textos razonables', () => {
    expect(validarTextoLibre('Cliente verificado por llamada, datos consistentes.', notaAsesor)).toBeNull()
    expect(validarTextoLibre('Documentación incompleta o ilegible', motivoCatalogo)).toBeNull()
  })
  it('motivo del catálogo: mínimo 5 caracteres', () => {
    expect(validarTextoLibre('abc', motivoCatalogo)).toMatch(/al menos 5/i)
  })
})
