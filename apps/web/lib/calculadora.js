/* ==========================================================================
 * ARCHIVO: calculadora.js
 * RUTA: apps/web/lib/calculadora.js
 * DESCRIPCIÓN: Módulo de utilidades y funciones compartidas.
 * FUNCIONALIDAD: Este archivo define la lógica y estructura para su respectivo módulo.
 * ========================================================================== */
import { MONTO_MIN, MONTO_MAX, PLAZOS, tasaUsuraEA } from './producto'

/**
 * Calculadora de Amortización Francesa.
 * Se ejecuta 100% en el navegador, sin llamadas al servidor.
 */
export function calcularAmortizacion(monto, tasaAnual, plazoMeses) {
  // tasa efectiva mensual, a partir de tasa anual en porcentaje.
  const r = Math.pow(1 + tasaAnual / 100, 1 / 12) - 1;
  const n = plazoMeses; // cantidad de meses.
  const P = monto; // principal prestado.

  // Fórmula de cuota fija francesa.
  const cuota = P * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);

  let saldo = P;
  const tablaCuotas = Array.from({ length: n }, (_, i) => {
    const interes = saldo * r; // interés del período actual.
    const capital = cuota - interes; // amortización de capital.
    saldo -= capital; // saldo restante después de pago.

    return {
      numero: i + 1,
      capital: Math.round(capital),
      interes: Math.round(interes),
      cuota: Math.round(cuota),
      saldo: Math.max(0, Math.round(saldo)),
    };
  });

  return {
    cuotaMensual: Math.round(cuota),
    totalPagar: Math.round(cuota * n),
    totalIntereses: Math.round(cuota * n - P),
    tasaMensual: r,
    tablaCuotas,
  };
}

/**
 * Convierte una tasa efectiva anual en porcentaje (28 = 28% EA) a la tasa
 * efectiva mensual en fracción que se guarda en decision_solicitud.
 * Es la inversa exacta de (1 + EM)^12 - 1 que usa el desembolso.
 */
export function tasaEAaEM(tasaEA) {
  return Math.pow(1 + tasaEA / 100, 1 / 12) - 1
}

/**
 * Valida las condiciones de una aprobación antes de registrarla o desembolsarla
 * con las reglas del producto (lib/producto.js): monto, plazos y tasa ≤ usura.
 *
 * @returns {{campo: 'monto'|'plazo'|'tasa', mensaje: string}[]} vacío si es válido
 */
export function validarCondicionesAprobacion({ monto, plazo, tasaEM }) {
  const errores = []
  if (typeof monto !== 'number' || !Number.isFinite(monto) || monto < MONTO_MIN || monto > MONTO_MAX) {
    errores.push({ campo: 'monto', mensaje: `El monto aprobado debe estar entre ${formatCOP(MONTO_MIN)} y ${formatCOP(MONTO_MAX)}.` })
  }
  if (!PLAZOS.includes(plazo)) {
    errores.push({ campo: 'plazo', mensaje: `El plazo aprobado debe ser de ${PLAZOS.join(', ')} meses.` })
  }
  const usura = tasaUsuraEA()
  const tasaEA = (Math.pow(1 + tasaEM, 12) - 1) * 100
  if (typeof tasaEM !== 'number' || !Number.isFinite(tasaEM) || tasaEM <= 0) {
    errores.push({ campo: 'tasa', mensaje: 'La tasa de interés aprobada debe ser mayor a 0%.' })
  } else if (tasaEA > usura + 1e-9) {
    errores.push({ campo: 'tasa', mensaje: `La tasa no puede superar la tasa de usura vigente (${usura}% EA).` })
  }
  return errores
}

/**
 * Fechas de vencimiento (YYYY-MM-DD) de un plan mensual de n cuotas.
 * La cuota k vence k meses después de fechaBase, el mismo día del mes; si ese
 * día no existe en el mes destino (29-31) se usa el último día de ese mes, de
 * modo que nunca se salta ni se repite un mes calendario.
 *
 * @param {Date}   fechaBase - fecha del desembolso (se usan sus componentes locales)
 * @param {number} n         - número de cuotas
 * @returns {string[]} fechas de vencimiento en orden
 */
export function fechasVencimientoMensual(fechaBase, n) {
  const anio = fechaBase.getFullYear()
  const mes  = fechaBase.getMonth()
  const dia  = fechaBase.getDate()
  return Array.from({ length: n }, (_, i) => {
    // Día 0 del mes siguiente = último día del mes destino (sin desbordar).
    const ultimoDia = new Date(anio, mes + i + 2, 0).getDate()
    const fecha = new Date(anio, mes + i + 1, Math.min(dia, ultimoDia))
    return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`
  })
}

/**
 * Días de mora transcurridos desde una fecha de vencimiento hasta hoy.
 * Devuelve 0 si aún no ha vencido. Trabaja a nivel de día (sin horas).
 *
 * @param {string|Date} fechaVencimiento - fecha de vencimiento (YYYY-MM-DD o Date)
 * @param {Date}        [hoy=new Date()]  - fecha de referencia
 * @returns {number} días de mora (>= 0)
 */
export function diasMoraDesde(fechaVencimiento, hoy = new Date()) {
  if (!fechaVencimiento) return 0
  // Normalizamos ambas fechas a medianoche UTC para contar días completos.
  const venc = new Date(`${String(fechaVencimiento).split('T')[0]}T00:00:00Z`)
  const ref  = new Date(`${hoy.toISOString().split('T')[0]}T00:00:00Z`)
  const dias = Math.floor((ref - venc) / 86400000)
  return dias > 0 ? dias : 0
}

/**
 * Interés de mora sobre el capital vencido.
 * mora = capitalBase × tasaMoraDiaria × díasMora
 *
 * @param {object} p
 * @param {number} p.capitalBase      - capital de la cuota en mora (COP)
 * @param {number} p.tasaMoraDiaria   - tasa diaria en fracción (0.001 = 0.1%/día)
 * @param {number} p.diasMora         - días de mora (>= 0)
 * @returns {number} monto de mora en COP, redondeado a peso
 */
export function calcularMora({ capitalBase = 0, tasaMoraDiaria = 0, diasMora = 0 }) {
  if (capitalBase <= 0 || tasaMoraDiaria <= 0 || diasMora <= 0) return 0
  return Math.round(capitalBase * tasaMoraDiaria * diasMora)
}

// Fracción → porcentaje legible (0.001 → "0.1%"). Para tasas guardadas como fracción.
export function formatPorcentaje(fraccion) {
  return `${Number((Number(fraccion ?? 0) * 100).toFixed(4))}%`
}

// Formatea valores numéricos a moneda COP sin decimales.
export function formatCOP(valor) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(valor);
}
