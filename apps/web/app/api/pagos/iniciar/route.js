/* ==========================================================================
 * ARCHIVO: route.js
 * RUTA: apps/web/app/api/pagos/iniciar/route.js
 * DESCRIPCIÓN: Endpoint que inicializa el pago de una o varias cuotas con Wompi.
 * FUNCIONALIDAD: Valida propiedad de la(s) cuota(s), calcula mora si aplica,
 *                resuelve el conjunto de N cuotas cubiertas (pago adelantado),
 *                pre-registra el pago (estado PROCESANDO) para que el webhook
 *                pueda reconciliarlo por referencia, y genera la firma de
 *                integridad SHA-256 del widget.
 * ========================================================================== */
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { formatNombre } from '@/lib/nombre'
import { resolverCuotasCubiertas } from '@/lib/pagos'

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

// ── Pre-registro del pago (estado PROCESANDO) ───────────────────────────────
// Se usa service role porque la política RLS "staff_insertar_pago" solo
// permite insertar a staff con sesión; el cliente autenticado no puede.
// La referencia UNIQUE (migración 29) hace este paso idempotente.
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

  const { cuotaId, numCuotas } = await request.json()

  // ── Resolver las cuotas cubiertas (valida propiedad + calcula montos) ────
  const resuelto = await resolverCuotasCubiertas(supabase, { user, cuotaId, numCuotas })
  if (resuelto.error) {
    return NextResponse.json({ error: resuelto.error }, { status: resuelto.status })
  }

  const { cliente, idCredito, cuotasCubiertas, montoBase, montoMora, montoTotal } = resuelto

  if (montoTotal <= 0) {
    return NextResponse.json({ error: 'Monto de pago inválido' }, { status: 400 })
  }

  const primeraCuota = cuotasCubiertas[0]
  const sumaCapital  = cuotasCubiertas.reduce((s, c) => s + c.monto_capital, 0)
  const sumaInteres  = cuotasCubiertas.reduce((s, c) => s + c.monto_interes, 0)

  // ── Pre-registrar el pago (con reintento si la referencia colisiona) ─────
  const service         = createServiceClient()
  const montoEnCentavos = Math.round(montoTotal * 100)
  let referencia        = `PLR-${primeraCuota.id_cuota.slice(0, 8).toUpperCase()}-${Date.now()}`
  let idRecibo          = null

  for (let intento = 0; intento < 3; intento++) {
    const res = await preRegistrarPago(service, {
      id_cuota:           primeraCuota.id_cuota,
      id_credito:         idCredito,
      monto_pagado:       montoTotal,
      monto_capital:      Math.round(sumaCapital * 100) / 100,
      monto_interes:      Math.round(sumaInteres * 100) / 100,
      monto_mora:         montoMora,
      metodo_pago:        'WOMPI',
      referencia_externa: referencia,
      estado:             'PROCESANDO',
      cuotas_cubiertas:   cuotasCubiertas,
    })

    if (res.reintentar) {
      referencia = `PLR-${primeraCuota.id_cuota.slice(0, 8).toUpperCase()}-${Date.now() + intento + 1}`
      continue
    }
    if (res.error) {
      console.error('[Pagos] Error pre-registrando pago:', res.error.message, res.error.details ?? '')
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
    cuotasCubiertas,
    // Datos del pagador (pre-fill)
    email:    user.email,
    nombre:   formatNombre(cliente),
    telefono: cliente.telefono,
    dni:      cliente.dni,
  })
}
