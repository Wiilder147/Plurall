import { describe, it, expect } from 'vitest'
import { calcularAmortizacion, formatCOP } from '../lib/calculadora'

describe('calcularAmortizacion (amortización francesa)', () => {
  it('calcula la cuota fija de un crédito típico ($1.000.000, 28% EA, 12 meses)', () => {
    const { cuotaMensual, totalPagar, totalIntereses, tablaCuotas } =
      calcularAmortizacion(1_000_000, 28, 12)

    // tasa mensual equivalente: (1.28)^(1/12) - 1 ≈ 2.078%
    expect(cuotaMensual).toBeGreaterThan(83_333) // más que el capital puro
    expect(cuotaMensual).toBeLessThan(100_000)
    // totalPagar redondea (cuota × n) completo; cuotaMensual redondea la cuota:
    // pueden diferir por acumulación de redondeo, a lo sumo n/2 pesos
    expect(Math.abs(totalPagar - cuotaMensual * 12)).toBeLessThanOrEqual(6)
    expect(totalIntereses).toBe(totalPagar - 1_000_000)
    expect(tablaCuotas).toHaveLength(12)
  })

  it('el saldo termina en 0 al pagar la última cuota', () => {
    const { tablaCuotas } = calcularAmortizacion(5_000_000, 28, 24)
    expect(tablaCuotas.at(-1).saldo).toBe(0)
  })

  it('el interés de cada período decrece y el capital crece (francesa)', () => {
    const { tablaCuotas } = calcularAmortizacion(2_000_000, 28, 12)
    for (let i = 1; i < tablaCuotas.length; i++) {
      expect(tablaCuotas[i].interes).toBeLessThanOrEqual(tablaCuotas[i - 1].interes)
      expect(tablaCuotas[i].capital).toBeGreaterThanOrEqual(tablaCuotas[i - 1].capital)
    }
  })

  it('la suma de capital amortizado equivale al principal (±1 peso por redondeo por cuota)', () => {
    const n = 12
    const { tablaCuotas } = calcularAmortizacion(1_000_000, 28, n)
    const capitalTotal = tablaCuotas.reduce((s, c) => s + c.capital, 0)
    expect(Math.abs(capitalTotal - 1_000_000)).toBeLessThanOrEqual(n)
  })
})

describe('formatCOP', () => {
  it('formatea sin decimales con separador de miles', () => {
    // Intl usa espacio duro entre símbolo y cifra según ICU; comparamos sin espacios
    expect(formatCOP(1500000).replace(/\s/g, '')).toBe('$1.500.000')
    expect(formatCOP(0).replace(/\s/g, '')).toBe('$0')
  })
})
