/* ==========================================================================
 * ARCHIVO: route.js
 * RUTA: apps/web/app/auth/callback/route.js
 * DESCRIPCIÓN: Archivo principal de la aplicación frontend.
 * FUNCIONALIDAD: Este archivo define la lógica y estructura para su respectivo módulo.
 * ========================================================================== */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Ruta callback para OAuth / magic link de Supabase.
// Recibe código en query, intercambia por sesión y redirige.
export async function GET(request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard/inicio'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // En caso de error, volver al login.
  return NextResponse.redirect(`${origin}/login`)
}
