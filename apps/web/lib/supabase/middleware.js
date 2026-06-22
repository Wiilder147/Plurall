/* ==========================================================================
 * ARCHIVO: middleware.js
 * RUTA: apps/web/lib/supabase/middleware.js
 * DESCRIPCIÓN: Módulo de utilidades y funciones compartidas.
 * FUNCIONALIDAD: Este archivo define la lógica y estructura para su respectivo módulo.
 * ========================================================================== */
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { getOrCreateCorrelationId, CORRELATION_HEADER } from '@/lib/correlationId'

export async function updateSession(request) {
  const correlationId = getOrCreateCorrelationId(request)
  let supabaseResponse = NextResponse.next({ request })
  supabaseResponse.headers.set(CORRELATION_HEADER, correlationId)

  // Si no hay credenciales de Supabase, dejar pasar sin proteger.
  // Esto permite trabajar en local cuando las variables de entorno no están configuradas.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return supabaseResponse
  }

  // Cliente de Supabase en server-side con manejo de cookies.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const path = request.nextUrl.pathname

  // OPTIMIZACIÓN: el middleware corre en CADA request y getUser() hace una
  // llamada de red a Supabase Auth (~0.5-1s). Lo saltamos donde no aporta:
  //   - Rutas públicas (no requieren sesión).
  //   - Rutas /api/* : cada endpoint valida su propia sesión con getUser(),
  //     así que validarla aquí duplica el round-trip de red.
  // En esos casos devolvemos la respuesta directamente (la sesión sigue
  // refrescándose dentro del propio endpoint cuando hace falta).
  const esPublica =
    path === '/' ||
    path.startsWith('/login') ||
    path.startsWith('/registro') ||
    path.startsWith('/recuperar') ||
    path.startsWith('/api/')

  if (esPublica) {
    return supabaseResponse
  }

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
