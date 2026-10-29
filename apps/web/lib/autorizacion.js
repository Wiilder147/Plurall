/* ==========================================================================
 * ARCHIVO: autorizacion.js
 * RUTA: apps/web/lib/autorizacion.js
 * DESCRIPCIÓN: Verificación de sesión y rol para route handlers.
 * FUNCIONALIDAD: Debe ejecutarse ANTES de cualquier consulta con service-role.
 * ========================================================================== */
import { NextResponse } from 'next/server'

/**
 * Exige sesión y uno de los roles indicados.
 * @param {object}   supabase - cliente de sesión (lib/supabase/server)
 * @param {string[]} roles    - roles permitidos en mayúsculas
 * @returns {Promise<{ user: object, rol: string } | { respuesta: NextResponse }>}
 */
export async function exigirRol(supabase, roles) {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    return { respuesta: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) }
  }
  const { data: perfil } = await supabase
    .from('perfil_usuario').select('rol ( nombre_rol )').eq('id', user.id).single()
  const rol = perfil?.rol?.nombre_rol?.toUpperCase()
  if (!roles.includes(rol)) {
    return { respuesta: NextResponse.json({ error: 'Acceso denegado' }, { status: 403 }) }
  }
  return { user, rol }
}
