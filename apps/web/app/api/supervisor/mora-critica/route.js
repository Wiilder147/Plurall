/* ==========================================================================
 * ARCHIVO: route.js
 * RUTA: apps/web/app/api/supervisor/mora-critica/route.js
 * DESCRIPCIÓN: Endpoint de API (Backend) para manejar la lógica de mora-critica
 * FUNCIONALIDAD: Este archivo define la lógica y estructura para su respectivo módulo.
 * ========================================================================== */
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'
import { formatNombre } from '@/lib/nombre'

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const db = createServiceClient()
  const { data } = await db
    .from('credito')
    .select('id_credito, saldo_pendiente, dias_mora_maximo, cuotas_en_mora, cliente ( primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, telefono)')
    .eq('estado_credito', 'EN_MORA')
    .order('dias_mora_maximo', { ascending: false })
    .limit(5)

  const items = (data ?? []).map(c => ({
    id:      c.id_credito,
    nombre:  formatNombre(c.cliente),
    telefono:c.cliente?.telefono,
    saldo:   c.saldo_pendiente,
    dias:    c.dias_mora_maximo,
    cuotas:  c.cuotas_en_mora,
  }))

  return NextResponse.json({ items })
}
