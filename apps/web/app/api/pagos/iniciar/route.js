/* ==========================================================================
 * ARCHIVO: route.js
 * RUTA: apps/web/app/api/pagos/iniciar/route.js
 * DESCRIPCIÓN: Endpoint de API (Backend) para manejar la lógica de iniciar
 * FUNCIONALIDAD: Este archivo define la lógica y estructura para su respectivo módulo.
 * ========================================================================== */
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { formatNombre } from '@/lib/nombre'
import { calcularMora, diasMoraDesde } from '@/lib/calculadora'

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

export async function POST(request) {
  const supabase = await createClient()

  // Verificar sesión
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  // ── Rate limiting ────────────────────────────────────────────
  const { permitido, restantes } = await checkRateLimit(user.id)
  if (!permitido) {
    return NextResponse.json(
      { error: `Demasiados intentos de pago. Espera unos minutos e intenta de nuevo.` },
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
      monto_capital,
      monto_interes,
      monto_total_cuota,
      estado_cuota,
      fecha_vencimiento,
      plan_pago (
        id_plan_pago,
        id_credito,
        tasa_mora_diaria,
        credito ( id_cliente )
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

  if (!clienteRow || cuota.plan_pago.credito.id_cliente !== clienteRow.id_cliente) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  if (!['PENDIENTE', 'VENCIDA'].includes(cuota.estado_cuota)) {
    return NextResponse.json({ error: 'Esta cuota no está disponible para pago' }, { status: 400 })
  }

  // ── Calcular mora si la cuota está vencida ───────────────────
  // Interés moratorio = capital × tasa_mora_diaria × días de mora.
  const diasMora = cuota.estado_cuota === 'VENCIDA'
    ? diasMoraDesde(cuota.fecha_vencimiento)
    : 0

  const montoMora = calcularMora({
    capitalBase:    Number(cuota.monto_capital),
    tasaMoraDiaria: Number(cuota.plan_pago.tasa_mora_diaria) || 0,
    diasMora,
  })

  const montoCapital  = Number(cuota.monto_capital)
  const montoInteres  = Number(cuota.monto_interes)
  const montoTotal    = Number(cuota.monto_total_cuota) + montoMora

  // ── Generar datos para Wompi ─────────────────────────────────
  const referencia      = `PLR-${cuotaId.slice(0, 8).toUpperCase()}-${Date.now()}`
  const montoEnCentavos = Math.round(montoTotal * 100)
  const moneda          = 'COP'
  const integritySecret = process.env.WOMPI_INTEGRITY_SECRET || ''

  // SHA256(referencia + montoEnCentavos + moneda + integritySecret)
  const cadena = `${referencia}${montoEnCentavos}${moneda}${integritySecret}`
  const hash   = createHash('sha256').update(cadena).digest('hex')

  const appUrl     = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const redirectUrl = `${appUrl}/dashboard/cuotas/confirmacion?referencia=${referencia}`

  // ── Pre-registrar el pago (estado PENDIENTE) ─────────────────
  // Guarda el mapeo referencia → cuota/crédito y el desglose (incl. mora)
  // para que el webhook actualice este registro de forma fiable e idempotente,
  // sin depender de coincidencias por prefijo de UUID.
  // Usamos el service client porque la tabla 'pago' está protegida por RLS.
  const service = createServiceClient()
  const { error: preErr } = await service.from('pago').insert({
    id_cuota:           cuota.id_cuota,
    id_credito:         cuota.plan_pago.id_credito,
    monto_pagado:       montoTotal,
    monto_capital:      montoCapital,
    monto_interes:      montoInteres,
    monto_mora:         montoMora,
    metodo_pago:        'WOMPI',
    referencia_externa: referencia,
    estado:             'PENDIENTE',
  })

  if (preErr) {
    console.error('[pagos/iniciar] No se pudo pre-registrar el pago:', preErr.message)
    return NextResponse.json(
      { error: 'No se pudo inicializar el pago. Intenta de nuevo.' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    publicKey:       process.env.NEXT_PUBLIC_WOMPI_PUBLIC_KEY || '',
    referencia,
    montoEnCentavos,
    hash,
    redirectUrl,
    // Desglose para mostrar en la UI de pago
    montoTotal,
    montoCapital,
    montoInteres,
    montoMora,
    diasMora,
    // Datos del pagador (pre-fill)
    email:    user.email,
    nombre:   formatNombre(clienteRow),
    telefono: clienteRow.telefono,
    dni:      clienteRow.dni,
  })
}
