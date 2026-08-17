/* ==========================================================================
 * ARCHIVO: route.js
 * RUTA: apps/web/app/api/pagos/iniciar/route.js
 * DESCRIPCIÓN: Endpoint que inicializa el pago de una cuota con Wompi.
 * FUNCIONALIDAD: Valida propiedad de la cuota, calcula mora si aplica,
 *                pre-registra el pago (estado PROCESANDO) para que el
 *                webhook pueda reconciliarlo por referencia, y genera la
 *                firma de integridad SHA-256 del widget.
 * ========================================================================== */
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { formatNombre } from '@/lib/nombre'

// ── Rate limiting con Upstash Redis ─────────────────────────────────────────
// Máximo 5 intentos de pago por usuario cada 10 minutos
const RATE_LIMIT = 5
const WINDOW_SEC = 600 // 10 minutos

async function checkRateLimit(userId) {
  const url   = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  // Si no hay Redis configurado, permitir sin límite
  if (!url || !token) return { permitido: true, restantes: RATE_LIMIT }

  const key = `pago_rate:${userId}`

  try {
    // Incrementar contador
    const incrRes = await fetch(`${url}/incr/${key}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const { result: intentos } = await incrRes.json()

    // Si es el primer intento, establecer TTL
    if (intentos === 1) {
      await fetch(`${url}/expire/${key}/${WINDOW_SEC}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    }

    const permitido  = intentos <= RATE_LIMIT
    const restantes  = Math.max(0, RATE_LIMIT - intentos)
    return { permitido, restantes, intentos }
  } catch {
    // Si Redis falla, no bloquear el pago
    return { permitido: true, restantes: RATE_LIMIT }
  }
}

// ── Cálculo de intereses de mora ────────────────────────────────────────────
// Mora = monto_total_cuota × tasa_mora_diaria × días de atraso
function calcularMora(cuota, planPago) {
  if (cuota.estado_cuota !== 'VENCIDA') return 0

  const vencimiento = new Date(`${cuota.fecha_vencimiento}T00:00:00`)
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)

  const dias = Math.max(1, Math.floor((hoy - vencimiento) / 86400000))
  const tasa = Number(planPago?.tasa_mora_diaria ?? 0.001)

  return Math.round(Number(cuota.monto_total_cuota) * tasa * dias * 100) / 100
}

// ── Pre-registro del pago (estado PROCESANDO) ───────────────────────────────
// Se usa service role porque la política RLS "staff_insertar_pago" solo
// permite insertar a staff con sesión; el cliente autenticado no puede.
// La referencia UNIQUE (migración 23) hace este paso idempotente.
async function preRegistrarPago(service, datos) {
  const { data, error } = await service
    .from('pago')
    .insert(datos)
    .select('id_recibo')
    .single()

  if (error?.code === '23505') return { reintentar: true } // referencia duplicada
  if (error) return { error }
  return { data }
}

export async function POST(request) {
  const supabase = await createClient()

  // Verificar sesión
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  // ── Rate limiting ────────────────────────────────────────────
  const { permitido } = await checkRateLimit(user.id)
  if (!permitido) {
    return NextResponse.json(
      { error: 'Demasiados intentos de pago. Espera unos minutos e intenta de nuevo.' },
      {
        status: 429,
        headers: { 'Retry-After': String(WINDOW_SEC) },
      }
    )
  }

  const { cuotaId } = await request.json()
  if (!cuotaId) {
    return NextResponse.json({ error: 'cuotaId requerido' }, { status: 400 })
  }

  // Obtener cuota y verificar que pertenezca al usuario
  const { data: cuota, error: cuotaErr } = await supabase
    .from('cuota')
    .select(`
      id_cuota,
      numero_cuota,
      monto_total_cuota,
      monto_capital,
      monto_interes,
      estado_cuota,
      fecha_vencimiento,
      plan_pago (
        id_plan_pago,
        id_credito,
        tasa_mora_diaria
      )
    `)
    .eq('id_cuota', cuotaId)
    .single()

  if (cuotaErr || !cuota) {
    return NextResponse.json({ error: 'Cuota no encontrada' }, { status: 404 })
  }

  // Verificar que el crédito pertenezca al cliente del usuario autenticado
  const { data: clienteRow } = await supabase
    .from('cliente')
    .select('id_cliente, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, telefono, dni, email')
    .eq('id_usuario_cuenta', user.id)
    .single()

  if (!clienteRow) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  // Verificar que la cuota pertenece al cliente autenticado (protección IDOR)
  const { data: creditoRow } = await supabase
    .from('credito')
    .select('id_cliente')
    .eq('id_credito', cuota.plan_pago.id_credito)
    .single()

  if (!creditoRow || creditoRow.id_cliente !== clienteRow.id_cliente) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  if (!['PENDIENTE', 'VENCIDA'].includes(cuota.estado_cuota)) {
    return NextResponse.json({ error: 'Esta cuota no está disponible para pago' }, { status: 400 })
  }

  // ── Monto total: cuota + mora (si está vencida) ─────────────
  const montoMora  = calcularMora(cuota, cuota.plan_pago)
  const montoBase  = Number(cuota.monto_total_cuota)
  const montoTotal = Math.round((montoBase + montoMora) * 100) / 100

  if (montoTotal <= 0) {
    return NextResponse.json({ error: 'Monto de pago inválido' }, { status: 400 })
  }

  // ── Pre-registrar el pago (con reintento si la referencia colisiona) ─────
  const service   = createServiceClient()
  const montoEnCentavos = Math.round(montoTotal * 100)
  let referencia  = `PLR-${cuotaId.slice(0, 8).toUpperCase()}-${Date.now()}`
  let idRecibo    = null

  for (let intento = 0; intento < 3; intento++) {
    const res = await preRegistrarPago(service, {
      id_cuota:           cuota.id_cuota,
      id_credito:         cuota.plan_pago.id_credito,
      monto_pagado:       montoTotal,
      monto_capital:      cuota.monto_capital,
      monto_interes:      cuota.monto_interes,
      monto_mora:         montoMora,
      metodo_pago:        'WOMPI',
      referencia_externa: referencia,
      estado:             'PROCESANDO',
    })

    if (res.reintentar) {
      referencia = `PLR-${cuotaId.slice(0, 8).toUpperCase()}-${Date.now() + intento + 1}`
      continue
    }
    if (res.error) {
      console.error('[Pagos] Error pre-registrando pago:', res.error.message)
      return NextResponse.json({ error: 'No se pudo iniciar el pago. Intenta más tarde.' }, { status: 500 })
    }
    idRecibo = res.data.id_recibo
    break
  }

  if (!idRecibo) {
    return NextResponse.json({ error: 'No se pudo iniciar el pago. Intenta más tarde.' }, { status: 500 })
  }

  // ── Generar firma de integridad del widget ──────────────────
  const moneda          = 'COP'
  const integritySecret = process.env.WOMPI_INTEGRITY_SECRET || ''

  // SHA256(referencia + montoEnCentavos + moneda + integritySecret)
  const cadena = `${referencia}${montoEnCentavos}${moneda}${integritySecret}`
  const hash   = createHash('sha256').update(cadena).digest('hex')

  const appUrl      = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const redirectUrl = `${appUrl}/dashboard/cuotas/confirmacion?referencia=${referencia}`

  return NextResponse.json({
    publicKey:       process.env.NEXT_PUBLIC_WOMPI_PUBLIC_KEY || '',
    referencia,
    montoEnCentavos,
    hash,
    redirectUrl,
    idRecibo,
    montoBase,
    montoMora,
    montoTotal,
    // Datos del pagador (pre-fill)
    email:    user.email,
    nombre:   formatNombre(clienteRow),
    telefono: clienteRow.telefono,
    dni:      clienteRow.dni,
  })
}