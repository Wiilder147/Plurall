/* ==========================================================================
 * ARCHIVO: route.js
 * RUTA: apps/web/app/api/auth/login/route.js
 * DESCRIPCIÓN: Inicio de sesión en el servidor con bloqueo por intentos (RN-02).
 * FUNCIONALIDAD: Antes el navegador llamaba directo a Supabase Auth y el
 *                bloqueo era solo informativo (H3). Aquí el servidor verifica el
 *                bloqueo ANTES de autenticar, cuenta fallos de forma atómica y
 *                deja la sesión en cookies (@supabase/ssr).
 * ========================================================================== */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { rateLimit, getClientIp } from '@/lib/rateLimit'

const LIMITE_INTENTOS = 3   // RN-02
const MINUTOS_BLOQUEO = 30

const minutosHasta = (iso) => Math.max(1, Math.ceil((new Date(iso) - Date.now()) / 60000))
const bloqueado = (minutos) => NextResponse.json(
  { error: `Cuenta bloqueada por intentos fallidos. Intenta en ${minutos} minuto${minutos > 1 ? 's' : ''}.`, bloqueado: true, minutosRestantes: minutos },
  { status: 423 }
)

export async function POST(request) {
  const { celular: raw, password } = await request.json().catch(() => ({}))
  const celular = String(raw ?? '').replace(/\D/g, '')
  if (celular.length !== 10 || !password) {
    return NextResponse.json({ error: 'Ingresa un celular de 10 dígitos y tu contraseña.' }, { status: 400 })
  }

  // Freno adicional por IP y por celular (independiente del bloqueo de cuenta)
  const porIp  = await rateLimit(`login:ip:${getClientIp(request)}`, { limit: 30, windowSec: 15 * 60 })
  const porCel = await rateLimit(`login:cel:${celular}`, { limit: 10, windowSec: 15 * 60 })
  if (!porIp.success || !porCel.success) {
    return NextResponse.json({ error: 'Demasiados intentos. Espera unos minutos.' }, { status: 429 })
  }

  const service = createServiceClient()
  const { data: uid } = await service.rpc('id_usuario_por_celular', { cel: celular })
  if (!uid) {
    return NextResponse.json({ error: 'Este número no está registrado. Verifica el número o crea una cuenta.', noRegistrado: true }, { status: 404 })
  }

  const { data: perfil } = await service
    .from('perfil_usuario').select('intentos_fallidos, bloqueado_hasta').eq('id', uid).maybeSingle()
  if (perfil?.bloqueado_hasta && new Date(perfil.bloqueado_hasta) > new Date()) {
    return bloqueado(minutosHasta(perfil.bloqueado_hasta))
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email: `${celular}@plurall.app`, password })

  if (error) {
    const credencialesInvalidas = error.code === 'invalid_credentials' || /invalid login credentials/i.test(error.message ?? '')
    if (!credencialesInvalidas) {
      console.error('[auth/login] Error de autenticación:', error.code ?? error.message)
      return NextResponse.json({ error: 'No pudimos iniciar sesión. Intenta de nuevo.' }, { status: 400 })
    }
    const { data: filas } = await service.rpc('registrar_intento_login_fallido', {
      uid, limite: LIMITE_INTENTOS, minutos: MINUTOS_BLOQUEO,
    })
    const fila = Array.isArray(filas) ? filas[0] : filas
    if (fila?.bloqueado_hasta && new Date(fila.bloqueado_hasta) > new Date()) {
      return bloqueado(minutosHasta(fila.bloqueado_hasta))
    }
    const restantes = Math.max(0, LIMITE_INTENTOS - Number(fila?.intentos ?? 0))
    return NextResponse.json(
      { error: `Contraseña incorrecta.${restantes > 0 ? ` Intentos restantes: ${restantes}.` : ''}`, intentosRestantes: restantes },
      { status: 401 }
    )
  }

  await service
    .from('perfil_usuario')
    .update({ intentos_fallidos: 0, bloqueado_hasta: null, ultimo_login: new Date().toISOString() })
    .eq('id', uid)

  return NextResponse.json({ ok: true })
}
