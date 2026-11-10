/* ==========================================================================
 * ARCHIVO: route.js
 * RUTA: apps/web/app/api/auth/registro/route.js
 * DESCRIPCIÓN: Registro de clientes en el servidor (CA-01, WF-02).
 * FUNCIONALIDAD: Antes el navegador llamaba directo a supabase.auth.signUp: no
 *                había validación en el servidor (un alta sin cédula quedaba con
 *                el documento de relleno 'SN…') y un celular repetido podía
 *                terminar en un falso "¡Cuenta creada!". Aquí el servidor valida
 *                los datos, rechaza el celular ya registrado con un mensaje
 *                claro y, si el trigger de BD no pudo crear el cliente (p. ej.
 *                dos altas simultáneas con el mismo documento), revierte el
 *                usuario de Auth para no dejar cuentas sin perfil.
 * ========================================================================== */
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { rateLimit, getClientIp } from '@/lib/rateLimit'
import { esEmailValido, esCelularValido } from '@/lib/validacion'
import { esDniValido } from '@/lib/dni'

const MENSAJE_CELULAR_REGISTRADO = 'Este número de celular ya está registrado.'

const texto = (v) => String(v ?? '').trim()
const error = (mensaje, status, campo) => NextResponse.json({ error: mensaje, ...(campo && { campo }) }, { status })

export async function POST(request) {
  const body = await request.json().catch(() => ({}))
  if (body.website) return error('No se pudo completar el registro.', 400)   // honeypot anti-bot

  const primer_nombre    = texto(body.primer_nombre)
  const segundo_nombre   = texto(body.segundo_nombre) || null
  const primer_apellido  = texto(body.primer_apellido)
  const segundo_apellido = texto(body.segundo_apellido) || null
  const celular  = String(body.telefono ?? '').replace(/\D/g, '')
  const dni      = String(body.dni ?? '').replace(/\D/g, '')
  const email    = texto(body.email).toLowerCase()
  const password = String(body.password ?? '')

  // ── Validaciones (las mismas del formulario; aquí son obligatorias) ──
  if (!primer_nombre)   return error('El primer nombre es obligatorio.', 422, 'primer_nombre')
  if (!primer_apellido) return error('El primer apellido es obligatorio.', 422, 'primer_apellido')
  if ([primer_nombre, segundo_nombre, primer_apellido, segundo_apellido].some(n => n && /\d/.test(n))) {
    return error('Los nombres y apellidos no deben contener números.', 422, 'nombre')
  }
  if (!esCelularValido(celular)) return error('El celular debe tener 10 dígitos.', 422, 'telefono')
  if (!esDniValido(dni))         return error('El número de documento debe tener entre 5 y 12 dígitos.', 422, 'dni')
  if (!esEmailValido(email))     return error('Ingresa un correo completo y válido, por ejemplo: tucorreo@gmail.com', 422, 'email')
  if (body.aceptaTerminos !== true) return error('Acepta los términos y condiciones.', 422, 'aceptaTerminos')
  if (password.length < 8)       return error('La contraseña requiere al menos 8 caracteres.', 422, 'password')

  const rl = await rateLimit(`rl:registro:${getClientIp(request)}`, { limit: 5, windowSec: 600 })
  if (!rl.success) return error('Demasiados intentos de registro. Espera unos minutos.', 429)

  const service = createServiceClient()

  // El celular es la identidad de acceso: un número = una cuenta.
  const { data: uidExistente } = await service.rpc('id_usuario_por_celular', { cel: celular })
  if (uidExistente) return error(MENSAJE_CELULAR_REGISTRADO, 409, 'telefono')

  // Correo y documento son únicos en `cliente`.
  const { data: disp } = await service.rpc('fn_verificar_disponibilidad', { p_email: email, p_dni: dni })
  if (disp?.email_disponible === false) return error('Este correo ya está registrado. Inicia sesión o usa otro correo.', 409, 'email')
  if (disp?.dni_disponible === false)   return error('Este número de documento ya está registrado. Si es tuyo, inicia sesión.', 409, 'dni')

  // Login por celular: email sintético en Auth; el correo real va en metadata
  // y el trigger handle_new_user_registration crea el cliente.
  const { data: creado, error: createErr } = await service.auth.admin.createUser({
    email: `${celular}@plurall.app`,
    password,
    email_confirm: true,
    user_metadata: {
      primer_nombre, segundo_nombre, primer_apellido, segundo_apellido,
      telefono: celular, dni, email_real: email,
    },
  })
  if (createErr || !creado?.user) {
    // Dos altas simultáneas con el mismo celular: Auth rechaza la segunda.
    const msg = createErr?.message?.toLowerCase() ?? ''
    if (createErr?.code === 'email_exists' || msg.includes('already') || msg.includes('registered') || msg.includes('exists')) {
      return error(MENSAJE_CELULAR_REGISTRADO, 409, 'telefono')
    }
    console.error('[auth/registro] createUser:', createErr?.code ?? createErr?.message)
    return error('No se pudo crear la cuenta. Intenta de nuevo.', 500)
  }

  // El trigger registra en log_error_registro (sin abortar) si no pudo crear el
  // cliente: correo/documento/celular tomados entre la verificación y el alta.
  const { data: cliente } = await service
    .from('cliente').select('id_cliente').eq('id_usuario_cuenta', creado.user.id).maybeSingle()
  if (!cliente) {
    await service.auth.admin.deleteUser(creado.user.id).catch(() => null)
    return error('El celular, correo o documento ya está registrado. Si es tuyo, inicia sesión.', 409)
  }

  return NextResponse.json({ ok: true }, { status: 201 })
}
