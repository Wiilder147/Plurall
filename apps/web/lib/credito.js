/* ==========================================================================
 * ARCHIVO: credito.js
 * RUTA: apps/web/lib/credito.js
 * DESCRIPCIÓN: Reglas de estado del crédito compartidas (Wompi y efectivo).
 * ========================================================================== */

// Estados que significan "crédito sin deuda": PAGADO (todas las cuotas
// pagadas) y CANCELADO (prepago/anulación). Paz y salvo y métricas usan ambos.
export const CREDITO_SALDADO = ['PAGADO', 'CANCELADO']

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
