/* ==========================================================================
 * ARCHIVO: route.js
 * RUTA: apps/web/app/api/pagos/cotizar/route.js
 * DESCRIPCIÓN: Cotiza (previsualiza) el pago SIN escribir en BD.
 * FUNCIONALIDAD: Devuelve el desglose de cuotas cubiertas, montos, saldo a
 *                favor usado/nuevo y el total a cobrar, tanto para el modo
 *                'cuotas' (N cuotas) como 'libre' (monto libre). Alimenta el
 *                selector/entrada de la pantalla de pago en vivo. No pre-registra
 *                el pago ni consume el rate limit: eso ocurre solo en /iniciar.
 * ========================================================================== */
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { resolverPago } from '@/lib/pagos'

export async function POST(request) {
  const supabase = await createClient()

  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { cuotaId, modo, numCuotas, montoLibre } = await request.json()

  const res = await resolverPago(supabase, { user, cuotaId, modo, numCuotas, montoLibre })
  if (res.error) {
    return NextResponse.json({ error: res.error }, { status: res.status })
  }

  return NextResponse.json({
    maxCuotas:       res.maxCuotas,
    cuotasCubiertas: res.cuotasCubiertas,
    montoBase:       res.montoBase,
    montoMora:       res.montoMora,
    montoACobrar:    res.montoACobrar,
    saldoPrevio:     res.saldoPrevio,
    saldoAplicado:   res.saldoAplicado,
    saldoNuevo:      res.saldoNuevo,
  })
}
