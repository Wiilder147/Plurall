/* ==========================================================================
 * ARCHIVO: producto.js
 * RUTA: apps/web/lib/producto.js
 * DESCRIPCIÓN: Reglas del producto de crédito (fuente única para UI y API).
 * FUNCIONALIDAD: Montos y plazos confirmados por negocio (29-oct-2026) y tope
 *                legal de tasa (usura) para aprobación y mora.
 * ========================================================================== */

export const MONTO_MIN = 400_000
export const MONTO_MAX = 10_000_000
export const PLAZOS    = [12, 24, 36]

// Tasa de usura EA (%) — Superfinanciera, crédito de consumo y ordinario,
// vigencia 01/10/2026–31/10/2026: 28,59 %. Es la más baja de todas las
// modalidades, así que es legal sin importar cómo se clasifique el crédito.
// Se certifica MENSUALMENTE: actualizar con la variable TASA_USURA_EA.
const USURA_EA_POR_DEFECTO = 28.59

export function tasaUsuraEA() {
  const env = Number(process.env.TASA_USURA_EA)
  return Number.isFinite(env) && env > 0 ? env : USURA_EA_POR_DEFECTO
}

// Tasa de mora diaria máxima: equivalente diario de la usura EA (la mora no
// puede superar la tasa máxima legal; el contrato remite a ella).
export function tasaMoraDiariaMaxima() {
  return Math.pow(1 + tasaUsuraEA() / 100, 1 / 365) - 1
}
