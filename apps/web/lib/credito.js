/* ==========================================================================
 * ARCHIVO: credito.js
 * RUTA: apps/web/lib/credito.js
 * DESCRIPCIÓN: Reglas de estado del crédito compartidas (Wompi y efectivo).
 * ========================================================================== */
import { diasMoraDesde } from './calculadora'

// Estados que significan "crédito sin deuda": PAGADO (todas las cuotas
// pagadas) y CANCELADO (prepago/anulación). Paz y salvo y métricas usan ambos.
export const CREDITO_SALDADO = ['PAGADO', 'CANCELADO']

const aCentavos = (v) => Math.round(Number(v ?? 0) * 100)

/**
 * Distribuye un pago en efectivo (J-06/J-07, decisión de negocio 29-oct-2026):
 * cuotas en el orden recibido (más antigua primero); en cada una primero la
 * mora pendiente, luego el interés y por último el capital (imputación del
 * art. 1653 C.C.; mora confirmada 29-oct-2026); lo que sobra es saldo a favor.
 * Se trabaja en centavos enteros: aplicado + excedente = monto, exacto.
 *
 * @param {number} monto
 * @param {{id_cuota, monto_capital, monto_interes, capital_pagado?, interes_pagado?, mora_pendiente?}[]} cuotas
 * @returns {{ aplicaciones: {id_cuota, mora, interes, capital, completa}[], excedente: number }}
 */
export function distribuirPagoEfectivo(monto, cuotas) {
  let resto = aCentavos(monto)
  const aplicaciones = []
  for (const c of cuotas) {
    if (resto <= 0) break
    const moraPend = Math.max(0, aCentavos(c.mora_pendiente))
    const mora = Math.min(resto, moraPend)
    resto -= mora
    const intPend = Math.max(0, aCentavos(c.monto_interes) - aCentavos(c.interes_pagado))
    const capPend = Math.max(0, aCentavos(c.monto_capital) - aCentavos(c.capital_pagado))
    const interes = Math.min(resto, intPend)
    resto -= interes
    const capital = Math.min(resto, capPend)
    resto -= capital
    aplicaciones.push({
      id_cuota: c.id_cuota,
      mora:     mora / 100,
      interes:  interes / 100,
      capital:  capital / 100,
      completa: mora === moraPend && interes === intPend && capital === capPend,
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

// J-10: fecha real de cierre = último fecha_pago_real de las cuotas de cada
// crédito (solo el servidor escribe en cuota). Filas: { fecha_pago_real, plan_pago: { id_credito } }.
export function fechaCierrePorCredito(cuotas) {
  const cierre = {}
  for (const c of cuotas ?? []) {
    const id = c?.plan_pago?.id_credito
    const f  = c?.fecha_pago_real
    if (!id || !f) continue
    if (!cierre[id] || String(f) > String(cierre[id])) cierre[id] = String(f)
  }
  return cierre
}

const ESTADOS_PAGADA = ['PAGADA', 'PAGADA_MORA', 'CONDONADA']

// M-04: situación de mora a una fecha. Cuota en atraso según RN-08
// (docs/requerimientos.md:216): fecha_vencimiento < hoy y no pagada, aunque el
// cron no la haya marcado VENCIDA. "Días mora máx." = mayor entre el máximo
// histórico guardado y el atraso de la cuota más antigua.
export function resumenMora(cuotas, diasMoraGuardado = 0, hoy = new Date()) {
  const enAtraso = (cuotas ?? []).filter(c =>
    !ESTADOS_PAGADA.includes(c.estado_cuota) && diasMoraDesde(c.fecha_vencimiento, hoy) > 0
  )
  const actual = enAtraso.reduce((m, c) => Math.max(m, diasMoraDesde(c.fecha_vencimiento, hoy)), 0)
  return { enAtraso, diasMoraMax: Math.max(Number(diasMoraGuardado) || 0, actual) }
}
