/* ==========================================================================
 * ARCHIVO: route.js
 * RUTA: apps/web/app/api/cron/mora/route.js
 * DESCRIPCIÓN: Endpoint de API (Backend) para manejar la lógica de mora
 * FUNCIONALIDAD: Este archivo define la lógica y estructura para su respectivo módulo.
 * ========================================================================== */
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { notificarAsesorCliente } from '@/lib/notificacionesInApp'

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

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const supabase = getServiceClient()
  const hoy      = new Date().toISOString().split('T')[0] // YYYY-MM-DD

  const resumen = {
    fecha:              hoy,
    cuotasVencidas:     0,
    creditosEnMora:     0,
    creditosRecuperados:0,
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

    // ── PASO 2: Marcar créditos ACTIVO como EN_MORA si tienen cuotas VENCIDAS
    //    Obtenemos los id_credito afectados a través de plan_pago
    if (resumen.cuotasVencidas > 0) {
      // Obtener los plan_pago únicos de las cuotas recién vencidas
      const planIds = [...new Set((cuotasActualizadas ?? []).map(c => c.id_plan_pago))]

      if (planIds.length > 0) {
        // Obtener los id_credito de esos planes
        const { data: planes } = await supabase
          .from('plan_pago')
          .select('id_credito')
          .in('id_plan_pago', planIds)

        const creditoIds = [...new Set((planes ?? []).map(p => p.id_credito))]

        if (creditoIds.length > 0) {
          // Actualizar créditos ACTIVO → EN_MORA y recalcular cuotas_en_mora
          for (const creditoId of creditoIds) {
            // Contar cuotas VENCIDAS de este crédito
            const { count: totalVencidas } = await supabase
              .from('cuota')
              .select('id_cuota', { count: 'exact', head: true })
              .eq('id_plan_pago',
                (await supabase
                  .from('plan_pago')
                  .select('id_plan_pago')
                  .eq('id_credito', creditoId)
                  .single()
                ).data?.id_plan_pago
              )
              .eq('estado_cuota', 'VENCIDA')

            // Calcular días de mora máximos
            const { data: cuotaMasAntigua } = await supabase
              .from('cuota')
              .select('fecha_vencimiento')
              .eq('estado_cuota', 'VENCIDA')
              .eq('id_plan_pago',
                (await supabase
                  .from('plan_pago')
                  .select('id_plan_pago')
                  .eq('id_credito', creditoId)
                  .single()
                ).data?.id_plan_pago
              )
              .order('fecha_vencimiento', { ascending: true })
              .limit(1)
              .single()

            const diasMora = cuotaMasAntigua?.fecha_vencimiento
              ? Math.floor((new Date(hoy) - new Date(cuotaMasAntigua.fecha_vencimiento)) / 86400000)
              : 0

            const { error: errMora } = await supabase
              .from('credito')
              .update({
                estado_credito:   'EN_MORA',
                cuotas_en_mora:   totalVencidas ?? 0,
                dias_mora_maximo: diasMora,
                updated_at:       new Date().toISOString(),
              })
              .eq('id_credito', creditoId)
              .eq('estado_credito', 'ACTIVO') // solo si estaba ACTIVO

            if (!errMora) {
              resumen.creditosEnMora++
              const { data: cr } = await supabase.from('credito').select('id_cliente').eq('id_credito', creditoId).single()
              if (cr?.id_cliente) {
                await notificarAsesorCliente(cr.id_cliente, {
                  codigoTipo: 'MORA_ASESOR',
                  titulo: 'Cliente entró en mora',
                  mensaje: `Crédito ${creditoId.slice(-8).toUpperCase()} — ${diasMora} días de mora.`,
                  metadata: { id_credito: creditoId, dias_mora: diasMora },
                })
              }
            }
          }
        }
      }
    }

    // ── PASO 3: Recuperar créditos EN_MORA que ya no tienen cuotas VENCIDAS
    //    (el cliente pagó todas las cuotas vencidas)
    const { data: creditosEnMora } = await supabase
      .from('credito')
      .select('id_credito')
      .eq('estado_credito', 'EN_MORA')

    for (const { id_credito } of creditosEnMora ?? []) {
      const { data: plan } = await supabase
        .from('plan_pago')
        .select('id_plan_pago')
        .eq('id_credito', id_credito)
        .single()

      if (!plan) continue

      const { count: vencidasRestantes } = await supabase
        .from('cuota')
        .select('id_cuota', { count: 'exact', head: true })
        .eq('id_plan_pago', plan.id_plan_pago)
        .eq('estado_cuota', 'VENCIDA')

      if (vencidasRestantes === 0) {
        await supabase
          .from('credito')
          .update({
            estado_credito: 'ACTIVO',
            cuotas_en_mora: 0,
            updated_at:     new Date().toISOString(),
          })
          .eq('id_credito', id_credito)

        resumen.creditosRecuperados++
      }
    }

    console.log('[CRON mora]', resumen)
    return NextResponse.json({ ok: true, resumen })

  } catch (err) {
    console.error('[CRON mora] Error inesperado:', err)
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}
