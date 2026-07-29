/* ==========================================================================
 * ARCHIVO: route.js
 * RUTA: apps/web/app/api/creditos/elegibilidad/route.js
 * DESCRIPCIÓN: Consulta si el cliente puede iniciar una solicitud de crédito.
 *
 * Fuente única de verdad: la función Postgres `fn_verificar_elegibilidad`
 * (db/13_rpc_solicitud_atomica.sql), la misma que usa la RPC de creación.
 * Así el frontend y el backend nunca divergen en las reglas de
 * "crédito único activo" y "cooldown de 90 días".
 *
 * Respuesta: { elegible: boolean, codigo?, mensaje?, dias_restantes? }
 * ========================================================================== */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { data, error } = await supabase.rpc('fn_verificar_elegibilidad')
    if (error) throw error

    return NextResponse.json(data)
  } catch (error) {
    console.error('[API elegibilidad] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
