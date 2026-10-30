/* ==========================================================================
 * ARCHIVO: route.js
 * RUTA: apps/web/app/api/cron/mora/route.js
 * DESCRIPCIÓN: Endpoint de API (Backend) para manejar la lógica de mora
 * FUNCIONALIDAD: Este archivo define la lógica y estructura para su respectivo módulo.
 * ========================================================================== */
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { notificarAsesorCliente } from '@/lib/notificacionesInApp'
import { hoyColombia, resumenVencidasPorCredito } from '@/lib/credito'

/**
 * GET /api/cron/mora
 *
 * Detecta cuotas vencidas y actualiza el estado de créditos a EN_MORA.
 * Se invoca de dos formas:
 *   1. Vercel Cron (vercel.json) — diariamente a las 11:55 PM Colombia
 *   2. Supabase pg_cron — como fallback si no hay Vercel
 *
 * Seguridad: valida el header CRON_SECRET para evitar ejecuciones no autorizadas.
 */

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function GET(request) {
  // ── Verificar que la llamada viene de Vercel Cron o de un proceso autorizado
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  // M5: sin CRON_SECRET se rechaza (antes el endpoint quedaba abierto)
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const supabase = getServiceClient()
  const hoy      = hoyColombia() // YYYY-MM-DD en Colombia (J-04: antes UTC)

  const resumen = {
    fecha:              hoy,
    cuotasVencidas:     0,
    creditosEnMora:     0,
    creditosRecuperados:0,
    creditosActualizados:0,
    errores:            [],
  }

  try {
    // ── PASO 1: Marcar cuotas PENDIENTE cuya fecha_vencimiento < hoy como VENCIDA
    const { data: cuotasActualizadas, error: errCuotas } = await supabase
      .from('cuota')
      .update({ estado_cuota: 'VENCIDA', updated_at: new Date().toISOString() })
      .lt('fecha_vencimiento', hoy)
      .eq('estado_cuota', 'PENDIENTE')
      .select('id_cuota, id_plan_pago')

    if (errCuotas) {
      resumen.errores.push(`Error marcando cuotas vencidas: ${errCuotas.message}`)
    } else {
      resumen.cuotasVencidas = cuotasActualizadas?.length ?? 0
    }

    // ── PASO 2: Refrescar TODOS los créditos con cuotas VENCIDAS (J-04/M-04)
    //    Antes solo se tocaban créditos ACTIVO con cuotas recién vencidas: los
    //    que ya estaban EN_MORA nunca actualizaban cuotas_en_mora ni días.
    const { data: vencidas, error: errVenc } = await supabase
      .from('cuota')
      .select('fecha_vencimiento, plan_pago!inner ( id_credito )')
      .eq('estado_cuota', 'VENCIDA')
    if (errVenc) throw errVenc

    const porCredito = resumenVencidasPorCredito(vencidas, hoy)
    const conVencidas = Object.keys(porCredito)
    const ahora = new Date().toISOString()

    if (conVencidas.length > 0) {
      const { data: creditos } = await supabase
        .from('credito')
        .select('id_credito, id_cliente, estado_credito, dias_mora_maximo')
        .in('id_credito', conVencidas)
        .in('estado_credito', ['ACTIVO', 'EN_MORA'])

      for (const cr of creditos ?? []) {
        const r = porCredito[cr.id_credito]
        // "máximo": nunca baja respecto al histórico guardado
        const diasMax = Math.max(Number(cr.dias_mora_maximo ?? 0), r.diasMora)
        const { data: filas, error: errMora } = await supabase
          .from('credito')
          .update({
            estado_credito:   'EN_MORA',
            cuotas_en_mora:   r.vencidas,
            dias_mora_maximo: diasMax,
            updated_at:       ahora,
          })
          .eq('id_credito', cr.id_credito)
          .eq('estado_credito', cr.estado_credito) // condicional: detecta la transición real
          .select('id_credito')

        if (errMora) { resumen.errores.push(`Crédito ${cr.id_credito}: ${errMora.message}`); continue }
        if (!filas?.length) continue

        if (cr.estado_credito === 'ACTIVO') {
          // Solo una entrada nueva en mora genera aviso (antes se repetía cada noche)
          resumen.creditosEnMora++
          await notificarAsesorCliente(cr.id_cliente, {
            codigoTipo: 'MORA_ASESOR',
            titulo: 'Cliente entró en mora',
            mensaje: `Crédito ${cr.id_credito.slice(-8).toUpperCase()} — ${r.diasMora} días de mora.`,
            metadata: { id_credito: cr.id_credito, dias_mora: r.diasMora },
          })
        } else {
          resumen.creditosActualizados++
        }
      }
    }

    // ── PASO 3: Recuperar créditos EN_MORA que ya no tienen cuotas VENCIDAS
    //    (el cliente pagó todas las cuotas vencidas). Se conserva el histórico
    //    de dias_mora_maximo.
    const { data: creditosEnMora } = await supabase
      .from('credito')
      .select('id_credito')
      .eq('estado_credito', 'EN_MORA')

    for (const { id_credito } of creditosEnMora ?? []) {
      if (porCredito[id_credito]) continue
      const { data: filas } = await supabase
        .from('credito')
        .update({ estado_credito: 'ACTIVO', cuotas_en_mora: 0, updated_at: ahora })
        .eq('id_credito', id_credito)
        .eq('estado_credito', 'EN_MORA')
        .select('id_credito')
      if (filas?.length) resumen.creditosRecuperados++
    }

    console.log('[CRON mora]', resumen)
    return NextResponse.json({ ok: true, resumen })

  } catch (err) {
    console.error('[CRON mora] Error inesperado:', err)
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}
