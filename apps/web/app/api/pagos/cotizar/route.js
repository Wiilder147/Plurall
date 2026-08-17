/* ==========================================================================
 * ARCHIVO: route.js
 * RUTA: apps/web/app/api/pagos/cotizar/route.js
 * DESCRIPCIÓN: Cotiza (previsualiza) el pago de N cuotas SIN escribir en BD.
 * FUNCIONALIDAD: Devuelve el desglose de las cuotas cubiertas, el máximo de
 *                cuotas pagables y los montos (base, mora, total) para alimentar
 *                el selector de la pantalla de pago en vivo. No pre-registra el
 *                pago ni consume el rate limit: eso ocurre solo en /iniciar.
 * ========================================================================== */
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { resolverCuotasCubiertas } from '@/lib/pagos'

export async function POST(request) {
  const supabase = await createClient()

  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { cuotaId, numCuotas } = await request.json()

  const res = await resolverCuotasCubiertas(supabase, { user, cuotaId, numCuotas })
  if (res.error) {
    return NextResponse.json({ error: res.error }, { status: res.status })
  }

  return NextResponse.json({
    maxCuotas:       res.maxCuotas,
    cuotasCubiertas: res.cuotasCubiertas,
    montoBase:       res.montoBase,
    montoMora:       res.montoMora,
    montoTotal:      res.montoTotal,
  })
}
