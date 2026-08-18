/* ==========================================================================
 * ARCHIVO: route.js
 * RUTA: apps/web/app/api/auth/portal/route.js
 * DESCRIPCIÓN: Portal correcto según el rol + registro del acceso.
 * FUNCIONALIDAD: Se llama tras el login exitoso. Devuelve la URL del portal del
 *                usuario y, de paso, registra el acceso en `auditoria` con la IP
 *                real del cliente (los triggers de BD no ven la IP HTTP, por eso
 *                se hace aquí, en el servidor).
 * ========================================================================== */
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getClientIp, getUserAgent } from '@/lib/ip'
import { NextResponse } from 'next/server'

export async function GET(request) {
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

  // Registrar el acceso con la IP real del cliente (fire-and-forget, no bloquea
  // la redirección). En local la IP suele ser null (sin proxy); en producción sí.
  try {
    const ip = getClientIp(request)
    await createServiceClient().from('auditoria').insert({
      id_usuario_responsable: user.id,
      tabla_afectada:         'auth.users',
      id_registro_afectado:   user.id,
      accion_realizada:       'LOGIN',
      ip_origen:              ip,
      user_agent:             getUserAgent(request),
    })
  } catch { /* no bloquear el login si la auditoría falla */ }

  return NextResponse.json({ portal, rol })
}
