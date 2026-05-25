/* ==========================================================================
 * ARCHIVO: route.js
 * RUTA: apps/web/app/api/creditos/solicitar/route.js
 * DESCRIPCIÓN: Endpoint de API (Backend) para manejar la lógica de solicitar
 * FUNCIONALIDAD: Este archivo define la lógica y estructura para su respectivo módulo.
 * ========================================================================== */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { notificarSolicitudRecibida } from '@/lib/notificaciones'

/**
 * Motor de scoring interno de PLURALL.
 *
 * Calcula el puntaje sumando los `valor_puntos` de las respuestas del cliente
 * contra las opciones de la tabla `opcion_pregunta`.
 *
 * Si no hay respuestas registradas (flujo sin cuestionario), usa el fallback
 * pseudo-aleatorio basado en DNI para mantener compatibilidad con el MVP.
 *
 * Umbrales:
 *   puntaje >= 600  → PRE_APROBADO
 *   puntaje >= 400  → REVISION_MANUAL
 *   puntaje <  400  → RECHAZAR
 */
async function calcularScoreInterno(supabase, idCliente, idSolicitud) {
  // 1. Obtener respuestas del cliente para esta solicitud
  const { data: respuestas } = await supabase
    .from('respuesta_cliente')
    .select('id_opcion, respuesta_texto')
    .eq('id_solicitud', idSolicitud)

  // Si no hay respuestas, retornar null para usar el fallback
  if (!respuestas || respuestas.length === 0) return null

  // 2. Sumar puntos de las opciones seleccionadas
  const idsOpciones = respuestas
    .map(r => r.id_opcion)
    .filter(Boolean)

  let puntajeTotal = 0

  if (idsOpciones.length > 0) {
    const { data: opciones } = await supabase
      .from('opcion_pregunta')
      .select('id_opcion, valor_puntos')
      .in('id_opcion', idsOpciones)

    puntajeTotal = (opciones ?? []).reduce((sum, o) => sum + (o.valor_puntos ?? 0), 0)
  }

  // 3. Obtener el modelo de score activo
  const { data: modelo } = await supabase
    .from('modelo_score')
    .select('id_modelo_score, puntaje_minimo, puntaje_maximo')
    .eq('activo', true)
    .order('vigente_desde', { ascending: false })
    .limit(1)
    .single()

  const puntajeMax = modelo?.puntaje_maximo ?? 1000
  const puntajeMin = modelo?.puntaje_minimo ?? 600
  const porcentaje = Math.round((puntajeTotal / puntajeMax) * 100)

  // 4. Determinar recomendación
  let recomendacion
  if (puntajeTotal >= puntajeMin)       recomendacion = 'APROBAR'
  else if (puntajeTotal >= puntajeMin * 0.67) recomendacion = 'REVISAR_MANUAL'
  else                                   recomendacion = 'RECHAZAR'

  // 5. Guardar resultado en tabla score
  await supabase.from('score').insert({
    id_solicitud:          idSolicitud,
    id_modelo_score:       modelo?.id_modelo_score,
    puntaje_total:         puntajeTotal,
    puntaje_maximo_posible: puntajeMax,
    porcentaje,
    recomendacion,
  })

  return { puntajeTotal, porcentaje, recomendacion }
}

/**
 * Fallback: scoring pseudo-aleatorio basado en DNI.
 * Se usa cuando el cliente no completó el cuestionario.
 * Mantiene resultados consistentes para demos.
 */
function scoringFallbackDNI(dni) {
  const factor = Number(dni.substring(dni.length - 2) || '50')
  if (factor < 20) {
    return { score: 450, dictamen: 'RECHAZAR',        motivo: 'Historial crediticio negativo en Datacrédito' }
  } else if (factor < 60) {
    return { score: 650, dictamen: 'REVISION_MANUAL', motivo: 'Capacidad de endeudamiento al límite' }
  } else {
    return { score: 850, dictamen: 'PRE_APROBADO',    motivo: 'Excelente historial crediticio' }
  }
}

export async function POST(request) {
  try {
    // Capturar IP del solicitante (compatible con proxies y CDN)
    const ip = (
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip') ??
      request.headers.get('cf-connecting-ip') ??
      null
    )

    const body = await request.json()
    // respuestas: [{ id_pregunta, id_opcion?, respuesta_texto? }]
    const { monto, plazo, frontUrl, backUrl, respuestas = [] } = body

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // 1. OBTENER DATOS DEL CLIENTE
    const { data: cliente, error: cliErr } = await supabase
      .from('cliente')
      .select('id_cliente, dni, nombre_completo, email')
      .eq('id_usuario_cuenta', user.id)
      .single()

    if (cliErr || !cliente) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
    }

    // 2.A VALIDAR CRÉDITO ÚNICO ACTIVO
    const { data: creditoVigente } = await supabase
      .from('credito')
      .select('id_credito')
      .eq('id_cliente', cliente.id_cliente)
      .gt('saldo_pendiente', 0)
      .limit(1)
      .single()

    if (creditoVigente) {
      return NextResponse.json({
        error:   'CREDITO_ACTIVO',
        message: 'No puedes solicitar un nuevo crédito mientras mantengas saldo pendiente en un crédito activo.',
      }, { status: 403 })
    }

    // 2.B VALIDAR REGLA TRIMESTRAL (backend fallback)
    const { data: lastRequest } = await supabase
      .from('solicitud_credito')
      .select('fecha_solicitud')
      .eq('id_cliente', cliente.id_cliente)
      .order('fecha_solicitud', { ascending: false })
      .limit(1)
      .single()

    if (lastRequest) {
      const diffDias = (Date.now() - new Date(lastRequest.fecha_solicitud)) / 86400000
      if (diffDias < 90) {
        return NextResponse.json({
          error:   'BLOQUEO_TRIMESTRAL',
          message: `Debes esperar ${Math.ceil(90 - diffDias)} días antes de volver a solicitar.`,
        }, { status: 403 })
      }
    }

    // 3. CREAR LA SOLICITUD (estado PENDIENTE por defecto)
    const { data: estadoPendiente } = await supabase
      .from('estado_solicitud')
      .select('id_estado_solicitud')
      .eq('nombre', 'PENDIENTE')
      .single()

    const { data: newSolicitud, error: insErr } = await supabase
      .from('solicitud_credito')
      .insert({
        id_cliente:          cliente.id_cliente,
        id_estado_solicitud: estadoPendiente?.id_estado_solicitud,
        monto_solicitado:    monto,
        plazo_meses:         plazo,
        canal_solicitud:     'WEB',
        ip_solicitud:        ip,
      })
      .select()
      .single()

    if (insErr) throw insErr

    // 4. GUARDAR RESPUESTAS DEL CUESTIONARIO (si las hay)
    if (respuestas.length > 0) {
      const respuestasInsert = respuestas.map(r => ({
        id_solicitud:   newSolicitud.id_solicitud,
        id_pregunta:    r.id_pregunta,
        id_opcion:      r.id_opcion   || null,
        respuesta_texto: r.respuesta_texto || null,
      }))
      await supabase.from('respuesta_cliente').insert(respuestasInsert)
    }

    // 5. CALCULAR SCORE
    let dictamen = 'REVISION_MANUAL'
    let scoreNum  = 650
    let propositoTexto = ''

    const scoreInterno = await calcularScoreInterno(
      supabase,
      cliente.id_cliente,
      newSolicitud.id_solicitud,
    )

    if (scoreInterno) {
      // Scoring real con respuestas del cuestionario
      scoreNum  = scoreInterno.puntajeTotal
      dictamen  = scoreInterno.recomendacion === 'APROBAR'        ? 'PRE_APROBADO'
                : scoreInterno.recomendacion === 'REVISAR_MANUAL' ? 'REVISION_MANUAL'
                : 'RECHAZAR'
      propositoTexto = `Score interno: ${scoreNum} pts (${scoreInterno.porcentaje}%)`
    } else {
      // Fallback por DNI cuando no hay cuestionario
      const fallback = scoringFallbackDNI(cliente.dni)
      scoreNum       = fallback.score
      dictamen       = fallback.dictamen
      propositoTexto = `Score Experian (mock): ${scoreNum} pts`
    }

    // 6. ACTUALIZAR SOLICITUD con propósito y estado final
    let estadoFinal = 'PENDIENTE'
    let idMotivo    = null

    if (dictamen === 'RECHAZAR') {
      estadoFinal = 'RECHAZADA'
      const { data: motQ } = await supabase
        .from('motivo_rechazo')
        .select('id_motivo')
        .ilike('descripcion_motivo', '%Historial%')
        .limit(1)
        .single()
      idMotivo = motQ?.id_motivo || null
    }

    const { data: estadoRow } = await supabase
      .from('estado_solicitud')
      .select('id_estado_solicitud')
      .eq('nombre', estadoFinal)
      .single()

    await supabase
      .from('solicitud_credito')
      .update({
        id_estado_solicitud: estadoRow?.id_estado_solicitud,
        id_motivo_rechazo:   idMotivo,
        proposito:           propositoTexto,
        updated_at:          new Date().toISOString(),
      })
      .eq('id_solicitud', newSolicitud.id_solicitud)

    // 7. GUARDAR DOCUMENTOS KYC
    if (frontUrl || backUrl) {
      const docs = []
      if (frontUrl) docs.push({ id_cliente: cliente.id_cliente, tipo_documento: 'CEDULA_FRONTAL', url_archivo: frontUrl })
      if (backUrl)  docs.push({ id_cliente: cliente.id_cliente, tipo_documento: 'CEDULA_TRASERA', url_archivo: backUrl })
      await supabase.from('documento_cliente').upsert(docs)
    }

    // 8. NOTIFICACIÓN EMAIL (solo si no fue rechazado)
    if (estadoFinal !== 'RECHAZADA' && cliente.email) {
      notificarSolicitudRecibida({
        email:       cliente.email,
        nombre:      cliente.nombre_completo,
        solicitudId: newSolicitud.id_solicitud,
        monto,
        plazo,
      }).catch(err => console.error('[Notif] Error email solicitud:', err))
    }

    return NextResponse.json({
      success:        true,
      resultado_buro: dictamen,
      score:          scoreNum,
      solicitudId:    newSolicitud.id_solicitud,
    })

  } catch (error) {
    console.error('[API solicitar] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
