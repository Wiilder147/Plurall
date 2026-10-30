/* ==========================================================================
 * ARCHIVO: middleware.js
 * RUTA: apps/web/middleware.js
 * DESCRIPCIÓN: Archivo principal de la aplicación frontend.
 * FUNCIONALIDAD: Este archivo define la lógica y estructura para su respectivo módulo.
 * ========================================================================== */
import { updateSession } from '@/lib/supabase/middleware'

export async function proxy(request) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    // Se excluye la carpeta /legal (documentos públicos: política de datos, etc.)
    // y la extensión .pdf para que el middleware de auth no los redirija a /login.
    '/((?!_next/static|_next/image|favicon.ico|legal/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|pdf)$).*)',
  ],
}
