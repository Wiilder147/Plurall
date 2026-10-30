import { describe, it, expect } from 'vitest'
import { puntosPorRangos, puntosPorOpciones, clasificarPuntaje, colorScore } from '../lib/scoring'

// Rangos reales de la pregunta de ingreso mensual (db/11_ponderacion_score_numerico.sql)
const RANGOS_INGRESO = [
  { id_pregunta: 'ing', valor_min: 0,       valor_max: 1000000, puntos: 40  },
  { id_pregunta: 'ing', valor_min: 1000000, valor_max: 3000000, puntos: 90  },
  { id_pregunta: 'ing', valor_min: 3000000, valor_max: 6000000, puntos: 140 },
  { id_pregunta: 'ing', valor_min: 6000000, valor_max: null,    puntos: 180 },
]

// Rangos de deudas: el primer rango [0, 1) captura exactamente "sin deudas"
const RANGOS_DEUDAS = [
  { id_pregunta: 'deu', valor_min: 0, valor_max: 1,       puntos: 150 },
  { id_pregunta: 'deu', valor_min: 1, valor_max: 1000000, puntos: 110 },
]

describe('puntosPorRangos', () => {
  it('asigna el rango correcto (semántica [min, max))', () => {
    expect(puntosPorRangos([{ id_pregunta: 'ing', respuesta_numerica: 500000 }], RANGOS_INGRESO)).toBe(40)
    expect(puntosPorRangos([{ id_pregunta: 'ing', respuesta_numerica: 2500000 }], RANGOS_INGRESO)).toBe(90)
  })

  it('el límite inferior es inclusivo y el superior exclusivo', () => {
    // exactamente 1.000.000 cae en el segundo rango, no en el primero
    expect(puntosPorRangos([{ id_pregunta: 'ing', respuesta_numerica: 1000000 }], RANGOS_INGRESO)).toBe(90)
    expect(puntosPorRangos([{ id_pregunta: 'ing', respuesta_numerica: 999999.99 }], RANGOS_INGRESO)).toBe(40)
  })

  it('valor_max null significa sin tope superior', () => {
    expect(puntosPorRangos([{ id_pregunta: 'ing', respuesta_numerica: 50000000 }], RANGOS_INGRESO)).toBe(180)
  })

  it('cero cae en el rango [0, 1): cliente sin deudas obtiene el máximo', () => {
    expect(puntosPorRangos([{ id_pregunta: 'deu', respuesta_numerica: 0 }], RANGOS_DEUDAS)).toBe(150)
    expect(puntosPorRangos([{ id_pregunta: 'deu', respuesta_numerica: 1 }], RANGOS_DEUDAS)).toBe(110)
  })

  it('suma varias preguntas e ignora respuestas sin valor numérico o sin rango', () => {
    const respuestas = [
      { id_pregunta: 'ing',   respuesta_numerica: 4000000 }, // 140
      { id_pregunta: 'deu',   respuesta_numerica: 0 },       // 150
      { id_pregunta: 'ing',   respuesta_numerica: null },    // ignorada
      { id_pregunta: 'otra',  respuesta_numerica: 99 },      // sin rangos → 0
    ]
    expect(puntosPorRangos(respuestas, [...RANGOS_INGRESO, ...RANGOS_DEUDAS])).toBe(290)
  })

  it('tolera listas vacías o indefinidas', () => {
    expect(puntosPorRangos([], [])).toBe(0)
    expect(puntosPorRangos(undefined, undefined)).toBe(0)
  })
})

describe('puntosPorOpciones', () => {
  const OPCIONES = [
    { id_opcion: 'a', valor_puntos: 50 },
    { id_opcion: 'b', valor_puntos: 30 },
  ]

  it('suma los puntos de las opciones seleccionadas', () => {
    expect(puntosPorOpciones([{ id_opcion: 'a' }, { id_opcion: 'b' }], OPCIONES)).toBe(80)
  })

  it('ignora respuestas sin opción (texto libre)', () => {
    expect(puntosPorOpciones([{ id_opcion: null }, { id_opcion: 'a' }], OPCIONES)).toBe(50)
  })
})

describe('clasificarPuntaje (umbrales del modelo)', () => {
  const MODELO = { puntaje_minimo: 600 }

  it('>= mínimo → PRE_APROBADO', () => {
    expect(clasificarPuntaje(600, MODELO)).toBe('PRE_APROBADO')
    expect(clasificarPuntaje(790, MODELO)).toBe('PRE_APROBADO')
  })

  it('>= 67% del mínimo → REVISION_MANUAL', () => {
    expect(clasificarPuntaje(402, MODELO)).toBe('REVISION_MANUAL')
    expect(clasificarPuntaje(599, MODELO)).toBe('REVISION_MANUAL')
  })

  it('< 67% del mínimo → RECHAZAR', () => {
    expect(clasificarPuntaje(401, MODELO)).toBe('RECHAZAR')
    expect(clasificarPuntaje(0, MODELO)).toBe('RECHAZAR')
  })

  // W-05 (decisión 29-oct-2026): escala 0–1000; 600 crudo ≡ 429 escalado (migración 44)
  it('usa 429 como mínimo por defecto si no hay modelo (escala 0–1000)', () => {
    expect(clasificarPuntaje(429)).toBe('PRE_APROBADO')
    expect(clasificarPuntaje(428)).not.toBe('PRE_APROBADO')
  })
})

describe('colorScore (W-05)', () => {
  it('el color sigue la regla de aprobación del modelo, no umbrales fijos', () => {
    const modelo = { puntaje_minimo: 429 }
    expect(colorScore(429, modelo)).toMatch(/emerald/)
    expect(colorScore(300, modelo)).toMatch(/yellow/)
    expect(colorScore(100, modelo)).toMatch(/red/)
    expect(colorScore(null, modelo)).toMatch(/slate/)
  })
})
