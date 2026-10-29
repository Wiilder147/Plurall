/* ==========================================================================
 * ARCHIVO: pagos.js
 * RUTA: apps/web/lib/pagos.js
 * DESCRIPCIÓN: Lógica compartida del flujo de pago Wompi (server).
 * FUNCIONALIDAD: Valida propiedad de la cuota (protección IDOR) y resuelve un
 *                pago en dos modos:
 *                  - 'cuotas': pagar N cuotas completas por adelantado.
 *                  - 'libre' : pagar un monto libre; cubre las cuotas completas
 *                              que alcance y el sobrante queda como saldo a favor.
 *                En ambos modos se aplica el saldo a favor previo del crédito.
 *                La usan /api/pagos/cotizar (preview) y /api/pagos/iniciar.
 * ========================================================================== */

// Monto mínimo que acepta la pasarela (Wompi ~ $1.500 COP).
export const MIN_COBRO_COP = 1500

const round2 = (n) => Math.round(n * 100) / 100

// ── Cálculo de intereses de mora de UNA cuota ───────────────────────────────
// Mora = capital vencido × tasa_mora_diaria × días de atraso. Solo VENCIDA.
// J-11 (decisión de negocio 29-oct-2026): base = capital, no la cuota total.
export function calcularMora(cuota, tasaMoraDiaria) {
  if (cuota.estado_cuota !== 'VENCIDA') return 0

  const vencimiento = new Date(`${cuota.fecha_vencimiento}T00:00:00`)
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)

  const dias = Math.max(1, Math.floor((hoy - vencimiento) / 86400000))
  const tasa = Number(tasaMoraDiaria ?? 0.001)

  return round2(Number(cuota.monto_capital) * tasa * dias)
}

// Construye el elemento de cuotas_cubiertas a partir de una fila de cuota
function detalleCuota(c, mora) {
  return {
    id_cuota:          c.id_cuota,
    numero_cuota:      c.numero_cuota,
    monto_total_cuota: Number(c.monto_total_cuota),
    monto_capital:     Number(c.monto_capital),
    monto_interes:     Number(c.monto_interes),
    monto_mora:        mora,
    estado_previo:     c.estado_cuota,
  }
}

/**
 * Resuelve un pago (validando propiedad + saldo a favor).
 *
 * @param supabase  cliente Supabase con la sesión del usuario (respeta RLS)
 * @param opts.user      usuario autenticado
 * @param opts.cuotaId   cuota desde la que empieza el pago
 * @param opts.modo      'cuotas' (por defecto) | 'libre'
 * @param opts.numCuotas modo 'cuotas': cuántas cuotas pagar (1..maxCuotas)
 * @param opts.montoLibre modo 'libre': monto que el cliente quiere pagar ahora
 * @returns { error, status } o un objeto con el desglose resuelto.
 */
export async function resolverPago(supabase, { user, cuotaId, modo = 'cuotas', numCuotas = 1, montoLibre = 0 }) {
  if (!cuotaId) return { error: 'cuotaId requerido', status: 400 }

  // 1. Cuota de partida + su plan de pago
  const { data: cuota, error: cuotaErr } = await supabase
    .from('cuota')
    .select(`
      id_cuota, numero_cuota, estado_cuota,
      plan_pago ( id_plan_pago, id_credito, tasa_mora_diaria )
    `)
    .eq('id_cuota', cuotaId)
    .single()

  if (cuotaErr || !cuota) return { error: 'Cuota no encontrada', status: 404 }
  const plan = cuota.plan_pago
  if (!plan) return { error: 'Plan de pago no encontrado', status: 404 }

  // 2. Propiedad (IDOR): la cuota debe pertenecer al cliente logueado
  const { data: cliente } = await supabase
    .from('cliente')
    .select('id_cliente, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, telefono, dni, email')
    .eq('id_usuario_cuenta', user.id)
    .single()

  if (!cliente) return { error: 'No autorizado', status: 403 }

  const { data: credito } = await supabase
    .from('credito')
    .select('id_cliente, saldo_a_favor')
    .eq('id_credito', plan.id_credito)
    .single()

  if (!credito || credito.id_cliente !== cliente.id_cliente) {
    return { error: 'No autorizado', status: 403 }
  }

  const saldoPrevio = Number(credito.saldo_a_favor ?? 0)

  // 3. Cuotas pagables desde la seleccionada hacia adelante (orden ascendente)
  const { data: pagables, error: pagErr } = await supabase
    .from('cuota')
    .select('id_cuota, numero_cuota, monto_total_cuota, monto_capital, monto_interes, estado_cuota, fecha_vencimiento')
    .eq('id_plan_pago', plan.id_plan_pago)
    .in('estado_cuota', ['PENDIENTE', 'VENCIDA'])
    .gte('numero_cuota', cuota.numero_cuota)
    .order('numero_cuota', { ascending: true })

  if (pagErr) return { error: 'No se pudieron leer las cuotas', status: 500 }
  if (!pagables?.length) return { error: 'Esta cuota no está disponible para pago', status: 400 }

  const maxCuotas = pagables.length
  // costo de cada cuota = total + su mora
  const conCosto = pagables.map((c) => {
    const mora = calcularMora(c, plan.tasa_mora_diaria)
    return { c, mora, costo: round2(Number(c.monto_total_cuota) + mora) }
  })

  let cuotasCubiertas = []
  let montoACobrar = 0
  let saldoNuevo = saldoPrevio

  if (modo === 'libre') {
    const monto = round2(Math.max(0, Number(montoLibre) || 0))
    if (monto < MIN_COBRO_COP) {
      return { error: `El monto mínimo a pagar es ${MIN_COBRO_COP.toLocaleString('es-CO')} COP.`, status: 400 }
    }
    // Fondos = saldo a favor previo + lo que paga ahora. Cubrir cuotas en orden.
    let fondos = round2(saldoPrevio + monto)
    for (const item of conCosto) {
      if (fondos + 1e-6 >= item.costo) {
        fondos = round2(fondos - item.costo)
        cuotasCubiertas.push(detalleCuota(item.c, item.mora))
      } else break
    }
    saldoNuevo   = round2(fondos)             // sobrante → nuevo saldo a favor
    montoACobrar = monto                       // Wompi cobra lo que el cliente paga
  } else {
    // modo 'cuotas': N cuotas completas
    const n = Math.min(Math.max(1, Math.trunc(Number(numCuotas) || 1)), maxCuotas)
    const sel = conCosto.slice(0, n)
    const costoSel = round2(sel.reduce((s, it) => s + it.costo, 0))
    const saldoAplicado = Math.min(saldoPrevio, costoSel)
    cuotasCubiertas = sel.map((it) => detalleCuota(it.c, it.mora))
    saldoNuevo   = round2(saldoPrevio - saldoAplicado)
    montoACobrar = round2(costoSel - saldoAplicado)

    if (montoACobrar < MIN_COBRO_COP) {
      // El saldo a favor cubre (casi) todo; la pasarela no puede cobrar tan poco.
      return {
        error: 'Tu saldo a favor cubre estas cuotas. Aún no soportamos aplicar saldo sin un pago mínimo; contacta soporte.',
        status: 409,
      }
    }
  }

  const montoBase = round2(cuotasCubiertas.reduce((s, c) => s + c.monto_total_cuota, 0))
  const montoMora = round2(cuotasCubiertas.reduce((s, c) => s + c.monto_mora, 0))
  const costoCubiertas = round2(montoBase + montoMora)
  const saldoAplicado = round2(Math.min(saldoPrevio, costoCubiertas))
  const deltaSaldo = round2(saldoNuevo - saldoPrevio)

  return {
    cliente,
    idCredito:       plan.id_credito,
    cuotasCubiertas,
    maxCuotas,
    montoBase,
    montoMora,
    costoCubiertas,
    montoACobrar,
    saldoPrevio,
    saldoAplicado,
    saldoNuevo,
    deltaSaldo,
  }
}
