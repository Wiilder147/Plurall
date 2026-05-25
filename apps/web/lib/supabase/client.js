/* ==========================================================================
 * ARCHIVO: client.js
 * RUTA: apps/web/lib/supabase/client.js
 * DESCRIPCIÓN: Módulo de utilidades y funciones compartidas.
 * FUNCIONALIDAD: Este archivo define la lógica y estructura para su respectivo módulo.
 * ========================================================================== */
import { createBrowserClient } from '@supabase/ssr'

// Crea cliente Supabase en el navegador (front-end) usando envs públicas.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
}
