/* ==========================================================================
 * ARCHIVO: server.js
 * RUTA: apps/web/lib/supabase/server.js
 * DESCRIPCIÓN: Módulo de utilidades y funciones compartidas.
 * FUNCIONALIDAD: Este archivo define la lógica y estructura para su respectivo módulo.
 * ========================================================================== */
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Crea cliente Supabase para server-side (Server Components), con manejo de cookies.
// Usa ANON_KEY + JWT del usuario → respeta RLS.
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Se ignora en Server Components — el middleware se encarga
          }
        },
      },
    }
  )
}
