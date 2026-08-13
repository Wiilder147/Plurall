/* ==========================================================================
 * ARCHIVO: calculadora.js
 * RUTA: apps/web/lib/calculadora.js
 * DESCRIPCIÓN: Módulo de utilidades y funciones compartidas.
 * FUNCIONALIDAD: Este archivo define la lógica y estructura para su respectivo módulo.
 * ========================================================================== */
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

// Formatea valores numéricos a moneda COP sin decimales.
export function formatCOP(valor) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(valor);
}
