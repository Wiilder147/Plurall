/* ==========================================================================
 * ARCHIVO: credito.js
 * RUTA: apps/web/lib/credito.js
 * DESCRIPCIÓN: Reglas de estado del crédito compartidas (Wompi y efectivo).
 * ========================================================================== */

// Estados que significan "crédito sin deuda": PAGADO (todas las cuotas
// pagadas) y CANCELADO (prepago/anulación). Paz y salvo y métricas usan ambos.
export const CREDITO_SALDADO = ['PAGADO', 'CANCELADO']

const aCentavos = (v) => Math.round(Number(v ?? 0) * 100)

/**
 * Distribuye un pago en efectivo (J-06/J-07, decisión de negocio 29-oct-2026):
 * cuotas en el orden recibido (más antigua primero); en cada una primero el
 * interés pendiente y luego el capital pendiente; lo que sobra es saldo a favor.
 * Se trabaja en centavos enteros: aplicado + excedente = monto, exacto.
 *
 * @param {number} monto
 * @param {{id_cuota, monto_capital, monto_interes, capital_pagado?, interes_pagado?}[]} cuotas
 * @returns {{ aplicaciones: {id_cuota, interes, capital, completa}[], excedente: number }}
 */
export function distribuirPagoEfectivo(monto, cuotas) {
  let resto = aCentavos(monto)
  const aplicaciones = []
  for (const c of cuotas) {
    if (resto <= 0) break
    const intPend = Math.max(0, aCentavos(c.monto_interes) - aCentavos(c.interes_pagado))
    const capPend = Math.max(0, aCentavos(c.monto_capital) - aCentavos(c.capital_pagado))
    const interes = Math.min(resto, intPend)
    resto -= interes
    const capital = Math.min(resto, capPend)
    resto -= capital
    aplicaciones.push({
      id_cuota: c.id_cuota,
      interes:  interes / 100,
      capital:  capital / 100,
      completa: interes === intPend && capital === capPend,
    })
  }
  return { aplicaciones, excedente: resto / 100 }
}

// Recalcula el estado del crédito tras aplicar un pago.
// - saldo <= 0         → PAGADO (J-13: decisión de negocio 29-oct-2026)
// - sin cuotas en mora → ACTIVO (sale de mora automáticamente)
// - con cuotas en mora → EN_MORA
// Estados especiales (CASTIGADO, etc.) no se tocan salvo saldo 0.
export function nuevoEstadoCredito(saldo, cuotasEnMora, estadoActual) {
  if (saldo <= 0) return 'PAGADO'
  if (estadoActual === 'ACTIVO' || estadoActual === 'EN_MORA') {
    return cuotasEnMora <= 0 ? 'ACTIVO' : 'EN_MORA'
  }
  return estadoActual
}
