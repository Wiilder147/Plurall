/* ==========================================================================
 * ARCHIVO: route.js
 * RUTA: apps/web/app/api/supervisor/solicitudes-recientes/route.js
 * DESCRIPCIÓN: Endpoint de API (Backend) para manejar la lógica de solicitudes-recientes
 * FUNCIONALIDAD: Este archivo define la lógica y estructura para su respectivo módulo.
 * ========================================================================== */
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const db = createServiceClient()
  const { data } = await db
    .from('solicitud_credito')
    .select('id_solicitud, monto_solicitado, plazo_meses, estado_solicitud(nombre), cliente(nombre_completo)')
    .order('fecha_solicitud', { ascending: false })
    .limit(6)

  const items = (data ?? []).map(s => ({
    id:     s.id_solicitud,
    nombre: s.cliente?.nombre_completo,
    monto:  s.monto_solicitado,
    plazo:  s.plazo_meses,
    estado: s.estado_solicitud?.nombre,
  }))

  return NextResponse.json({ items })
}
