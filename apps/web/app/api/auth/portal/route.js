/* ==========================================================================
 * ARCHIVO: route.js
 * RUTA: apps/web/app/api/auth/portal/route.js
 * DESCRIPCIÓN: Endpoint de API (Backend) para manejar la lógica de portal
 * FUNCIONALIDAD: Este archivo define la lógica y estructura para su respectivo módulo.
 * ========================================================================== */
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * GET /api/auth/portal
 * Devuelve la URL del portal correcto según el rol del usuario autenticado.
 * Se llama justo después del login exitoso para redirigir al portal correcto.
 */
export async function GET() {
  const supabase = await createClient()

  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    return NextResponse.json({ portal: '/login' })
  }

  const { data: perfil } = await supabase
    .from('perfil_usuario')
    .select('rol ( nombre_rol )')
    .eq('id', user.id)
    .single()

  const rol = perfil?.rol?.nombre_rol?.toUpperCase()

  const portales = {
    ADMIN:      '/admin',
    SUPERVISOR: '/supervisor',
    ASESOR:     '/asesor',
    CLIENTE:    '/dashboard/inicio',
  }

  const portal = portales[rol] ?? '/dashboard/inicio'
  return NextResponse.json({ portal, rol })
}
