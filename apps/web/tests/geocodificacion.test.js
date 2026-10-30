import { describe, it, expect, vi } from 'vitest'
import { consultasDireccion, geocodificarDireccion } from '../lib/geocodificacion'

// C-03: al escribir la dirección, el mapa debe ubicarla (geocodificación
// directa). Si la nomenclatura no se encuentra, se centra en la ciudad.
const datos = { direccion: 'cr 78 n 49-34 sur', ciudad: 'Bogotá', depto: 'Cundinamarca' }

describe('consultasDireccion', () => {
  it('primero dirección completa, luego la ciudad', () => {
    expect(consultasDireccion(datos)).toEqual([
      'cr 78 n 49-34 sur, Bogotá, Cundinamarca, Colombia',
      'Bogotá, Cundinamarca, Colombia',
    ])
  })
  it('sin ciudad no busca (evita ubicar en cualquier lugar del país)', () => {
    expect(consultasDireccion({ direccion: 'Calle 1', ciudad: '', depto: '' })).toEqual([])
  })
})

const respuesta = (filas) => ({ ok: true, json: async () => filas })

describe('geocodificarDireccion', () => {
  it('ubica la dirección exacta cuando Nominatim la encuentra', async () => {
    const f = vi.fn(async () => respuesta([{ lat: '4.6', lon: '-74.15' }]))
    expect(await geocodificarDireccion(datos, f)).toEqual({ lat: 4.6, lng: -74.15, precision: 'direccion' })
    expect(decodeURIComponent(f.mock.calls[0][0])).toContain('countrycodes=co')
  })
  it('si no encuentra la dirección, centra en la ciudad', async () => {
    const f = vi.fn().mockResolvedValueOnce(respuesta([])).mockResolvedValueOnce(respuesta([{ lat: '4.71', lon: '-74.07' }]))
    expect(await geocodificarDireccion(datos, f)).toEqual({ lat: 4.71, lng: -74.07, precision: 'ciudad' })
  })
  it('sin resultados o con error de red devuelve null', async () => {
    expect(await geocodificarDireccion(datos, vi.fn(async () => respuesta([])))).toBeNull()
    expect(await geocodificarDireccion(datos, vi.fn(async () => { throw new Error('red') }))).toBeNull()
  })
})
