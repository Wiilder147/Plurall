/* ==========================================================================
 * ARCHIVO: route.js
 * RUTA: apps/web/app/api/auth/otp/verificar/route.js
 * DESCRIPCIÓN: Endpoint de API (Backend) para manejar la lógica de verificar
 * FUNCIONALIDAD: Este archivo define la lógica y estructura para su respectivo módulo.
 * ========================================================================== */
import { NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { timingSafeEqual } from 'node:crypto'
import { rateLimit, getClientIp } from '@/lib/rateLimit'

// S-C2: intentos de verificación permitidos por celular y por IP en la ventana.
const MAX_INTENTOS_CELULAR = 5
const MAX_INTENTOS_IP      = 20
const VENTANA_SEG          = 15 * 60

function codigoIgual(a, b) {
  const x = Buffer.from(String(a))
  const y = Buffer.from(String(b))
  return x.length === y.length && timingSafeEqual(x, y)
}

function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(request) {
  try {
    const { celular, otp, newPassword } = await request.json()

    if (!celular || !otp || !newPassword) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 })
    }

    const service = getServiceClient()

    // S-C2: frenar la fuerza bruta del código de 6 dígitos. Al agotar los
    // intentos se invalidan en BD los OTP activos del celular, de modo que el
    // bloqueo persiste aunque el contador se pierda (p. ej. fallback en memoria).
    const porCelular = await rateLimit(`otp-verificar:cel:${celular}`, { limit: MAX_INTENTOS_CELULAR, windowSec: VENTANA_SEG })
    const porIp      = await rateLimit(`otp-verificar:ip:${getClientIp(request)}`, { limit: MAX_INTENTOS_IP, windowSec: VENTANA_SEG })
    if (!porCelular.success || !porIp.success) {
      await service.from('otp_recuperacion').update({ usado: true }).eq('celular', celular).eq('usado', false)
      return NextResponse.json(
        { error: 'Demasiados intentos. Solicita un nuevo código en unos minutos.' },
        { status: 429 }
      )
    }

    // 1. Buscar el OTP válido más reciente
    const { data: otps, error: otpErr } = await service
      .from('otp_recuperacion')
      .select('*')
      .eq('celular', celular)
      .eq('usado', false)
      .gte('expiracion', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)

    if (otpErr) throw otpErr

    if (!otps || otps.length === 0 || !codigoIgual(otps[0].otp_code, otp)) {
      return NextResponse.json({ error: 'Código inválido o expirado' }, { status: 400 })
    }

    // 2. Marcar OTP como usado
    await service
      .from('otp_recuperacion')
      .update({ usado: true })
      .eq('id_otp', otps[0].id_otp)

    // 3. Buscar el user ID en la base de datos (mucho más escalable que usar listUsers)
    // Consultamos la tabla cliente para obtener el id de autenticación (id_usuario_cuenta) asociado a este celular.
    const { data: perfil, error: perfilErr } = await service
      .from('cliente')
      .select('id_usuario_cuenta')
      .eq('telefono', celular)
      .single()

    if (perfilErr || !perfil) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    const userId = perfil.id_usuario_cuenta

    // 4. Actualizar la contraseña usando Admin API
    const { error: updateErr } = await service.auth.admin.updateUserById(
      userId,
      { password: newPassword }
    )

    if (updateErr) throw updateErr

    // 5. Resetear intentos fallidos en perfil_usuario (RN-02)
    await service
      .from('perfil_usuario')
      .update({ intentos_fallidos: 0, bloqueado_hasta: null })
      .eq('id', userId)

    return NextResponse.json({ ok: true })

  } catch (error) {
    console.error('[OTP Verificar Error]:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
