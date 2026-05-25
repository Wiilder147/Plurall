/* ==========================================================================
 * ARCHIVO: service.js
 * RUTA: apps/web/lib/supabase/service.js
 * DESCRIPCIÓN: Módulo de utilidades y funciones compartidas.
 * FUNCIONALIDAD: Este archivo define la lógica y estructura para su respectivo módulo.
 * ========================================================================== */
import { createClient } from '@supabase/supabase-js'

/**
 * Cliente Supabase con SERVICE_ROLE_KEY.
 * Bypasea RLS completamente — usar SOLO en Server Components y API Routes.
 * NUNCA importar en archivos 'use client'.
 */
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
