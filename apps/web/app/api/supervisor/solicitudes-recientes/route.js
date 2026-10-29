/* ==========================================================================
 * ARCHIVO: route.js
 * RUTA: apps/web/app/api/supervisor/solicitudes-recientes/route.js
 * DESCRIPCIÓN: Endpoint de API (Backend) para manejar la lógica de solicitudes-recientes
 * FUNCIONALIDAD: Este archivo define la lógica y estructura para su respectivo módulo.
 * ========================================================================== */
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'
import { exigirRol } from '@/lib/autorizacion'
import { formatNombre } from '@/lib/nombre'

export async function GET() {
  const supabase = await createClient()
  // S-C1: datos de toda la cartera vía service-role → solo ADMIN/SUPERVISOR
  const auth = await exigirRol(supabase, ['ADMIN', 'SUPERVISOR'])
  if (auth.respuesta) return auth.respuesta

  const db = createServiceClient()
  const { data } = await db
    .from('solicitud_credito')
    .select('id_solicitud, monto_solicitado, plazo_meses, estado_solicitud(nombre), cliente(primer_nombre, segundo_nombre, primer_apellido, segundo_apellido)')
    .order('fecha_solicitud', { ascending: false })
    .limit(6)

  const items = (data ?? []).map(s => ({
    id:     s.id_solicitud,
    nombre: formatNombre(s.cliente),
    monto:  s.monto_solicitado,
    plazo:  s.plazo_meses,
    estado: s.estado_solicitud?.nombre,
  }))

  return NextResponse.json({ items })
}
