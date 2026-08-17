/* ==========================================================================
 * ARCHIVO: route.js
 * RUTA: apps/web/app/api/auth/existe/route.js
 * DESCRIPCIÓN: Verifica si un celular corresponde a un usuario registrado.
 * FUNCIONALIDAD: Lo usa el login (y la recuperación) para diferenciar
 *                "número no registrado" de "contraseña incorrecta" y no
 *                iniciar el contador de bloqueo con números inexistentes.
 *                Usa una función SECURITY DEFINER (migración 32) porque el
 *                cliente no puede consultar auth.users.
 * ========================================================================== */
import { NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const celular = searchParams.get('celular')?.replace(/\D/g, '')

  // Sin un celular válido no afirmamos nada (no bloquea el flujo del login).
  if (!celular || celular.length !== 10) {
    return NextResponse.json({ existe: null })
  }

  try {
    const service = getServiceClient()
    const { data, error } = await service.rpc('usuario_existe_por_celular', { cel: celular })
    if (error) throw error
    return NextResponse.json({ existe: Boolean(data) })
  } catch (e) {
    console.error('[auth/existe] Error verificando celular:', e.message)
    // Ante un fallo, no afirmamos: el login sigue su curso normal.
    return NextResponse.json({ existe: null })
  }
}
