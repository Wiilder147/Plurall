/* ==========================================================================
 * ARCHIVO: middleware.js
 * RUTA: apps/web/lib/supabase/middleware.js
 * DESCRIPCIÓN: Módulo de utilidades y funciones compartidas.
 * FUNCIONALIDAD: Este archivo define la lógica y estructura para su respectivo módulo.
 * ========================================================================== */
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

export async function updateSession(request) {
  let supabaseResponse = NextResponse.next({ request })

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

  // Obtener usuario actual y validar acceso a rutas privadas.
  const { data: { user } } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname

  if (
    !user &&
    !path.startsWith('/login') &&
    !path.startsWith('/registro') &&
    !path.startsWith('/recuperar') &&
    !path.startsWith('/api/auth/') &&
    !path.startsWith('/api/webhooks/') &&
    path !== '/'
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Proteger rutas de supervisor y asesor — redirigir al login si no hay sesión
  // La verificación de ROL se hace en el layout de cada sección
  if (user && (path.startsWith('/supervisor') || path.startsWith('/asesor'))) {
    // Sesión válida — el layout verificará el rol específico
  }

  return supabaseResponse
}
