/* ==========================================================================
 * ARCHIVO: pagos.js
 * RUTA: apps/web/lib/pagos.js
 * DESCRIPCIÓN: Lógica compartida del flujo de pago Wompi (server).
 * FUNCIONALIDAD: Valida propiedad de la cuota (protección IDOR), calcula la
 *                mora por cuota y resuelve el conjunto de N cuotas que un pago
 *                cubre cuando el cliente paga varias por adelantado.
 *                La usan /api/pagos/cotizar (preview) y /api/pagos/iniciar.
 * ========================================================================== */

// ── Cálculo de intereses de mora de UNA cuota ───────────────────────────────
// Mora = monto_total_cuota × tasa_mora_diaria × días de atraso.
// Solo aplica a cuotas VENCIDAS.
export function calcularMora(cuota, tasaMoraDiaria) {
  if (cuota.estado_cuota !== 'VENCIDA') return 0

  const vencimiento = new Date(`${cuota.fecha_vencimiento}T00:00:00`)
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)

  const dias = Math.max(1, Math.floor((hoy - vencimiento) / 86400000))
  const tasa = Number(tasaMoraDiaria ?? 0.001)

  return Math.round(Number(cuota.monto_total_cuota) * tasa * dias * 100) / 100
}

/**
 * Resuelve las cuotas que cubre un pago que arranca en `cuotaId` y abarca
 * `numCuotas` cuotas pagables (PENDIENTE/VENCIDA) consecutivas hacia adelante.
 *
 * Se paga en orden ascendente por numero_cuota desde la cuota seleccionada:
 * no se dejan huecos hacia adelante y no se puede pagar una cuota si la
 * seleccionada no le pertenece al usuario (IDOR).
 *
 * @param supabase  cliente Supabase con la sesión del usuario (respeta RLS)
 * @param user      usuario autenticado (auth.getUser)
 * @param cuotaId   cuota desde la que empieza el pago
 * @param numCuotas cuántas cuotas pagar (1..maxCuotas); se normaliza al rango
 * @returns { error, status } en caso de fallo, o
 *          { cuotasCubiertas, idCredito, montoBase, montoMora, montoTotal,
 *            maxCuotas, cliente }
 */
export async function resolverCuotasCubiertas(supabase, { user, cuotaId, numCuotas }) {
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

  // 2. Verificar propiedad (IDOR): la cuota debe pertenecer al cliente logueado
  const { data: cliente } = await supabase
    .from('cliente')
    .select('id_cliente, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, telefono, dni, email')
    .eq('id_usuario_cuenta', user.id)
    .single()

  if (!cliente) return { error: 'No autorizado', status: 403 }

  const { data: credito } = await supabase
    .from('credito')
    .select('id_cliente')
    .eq('id_credito', plan.id_credito)
    .single()

  if (!credito || credito.id_cliente !== cliente.id_cliente) {
    return { error: 'No autorizado', status: 403 }
  }

  // 3. Cuotas pagables desde la seleccionada hacia adelante (orden ascendente)
  const { data: pagables, error: pagErr } = await supabase
    .from('cuota')
    .select('id_cuota, numero_cuota, monto_total_cuota, monto_capital, monto_interes, estado_cuota, fecha_vencimiento')
    .eq('id_plan_pago', plan.id_plan_pago)
    .in('estado_cuota', ['PENDIENTE', 'VENCIDA'])
    .gte('numero_cuota', cuota.numero_cuota)
    .order('numero_cuota', { ascending: true })

  if (pagErr) return { error: 'No se pudieron leer las cuotas', status: 500 }
  if (!pagables?.length) {
    return { error: 'Esta cuota no está disponible para pago', status: 400 }
  }

  const maxCuotas = pagables.length

  // 4. Normalizar numCuotas al rango [1, maxCuotas]
  const n = Math.min(Math.max(1, Math.trunc(Number(numCuotas) || 1)), maxCuotas)

  // 5. Construir el detalle de las N cuotas cubiertas + agregados
  let montoBase = 0
  let montoMora = 0

  const cuotasCubiertas = pagables.slice(0, n).map((c) => {
    const mora = calcularMora(c, plan.tasa_mora_diaria)
    montoBase += Number(c.monto_total_cuota)
    montoMora += mora
    return {
      id_cuota:          c.id_cuota,
      numero_cuota:      c.numero_cuota,
      monto_total_cuota: Number(c.monto_total_cuota),
      monto_capital:     Number(c.monto_capital),
      monto_interes:     Number(c.monto_interes),
      monto_mora:        mora,
      estado_previo:     c.estado_cuota,
    }
  })

  montoBase  = Math.round(montoBase * 100) / 100
  montoMora  = Math.round(montoMora * 100) / 100
  const montoTotal = Math.round((montoBase + montoMora) * 100) / 100

  return {
    cliente,
    idCredito: plan.id_credito,
    cuotasCubiertas,
    maxCuotas,
    montoBase,
    montoMora,
    montoTotal,
  }
}
