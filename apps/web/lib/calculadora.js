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

// Formatea valores numéricos a moneda COP sin decimales.
export function formatCOP(valor) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(valor);
}
