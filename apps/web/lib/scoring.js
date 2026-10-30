/* ==========================================================================
 * ARCHIVO: scoring.js
 * RUTA: apps/web/lib/scoring.js
 * DESCRIPCIÓN: Lógica pura del motor de scoring, espejo en JavaScript de la
 *              implementación oficial en Postgres (fn_crear_solicitud_completa,
 *              db/13_rpc_solicitud_atomica.sql). Se usa para tests y para
 *              cualquier cálculo del lado cliente (simuladores, previews).
 *
 * Semántica de rango: un valor v aplica a un rango si
 *   v >= valor_min AND (valor_max es null O v < valor_max)
 * ========================================================================== */

/**
 * Suma los puntos de las respuestas numéricas según los rangos configurados.
 * @param {Array<{id_pregunta: string, respuesta_numerica: number|null}>} respuestas
 * @param {Array<{id_pregunta: string, valor_min: number, valor_max: number|null, puntos: number}>} rangos
 * @returns {number}
 */
export function puntosPorRangos(respuestas, rangos) {
  let total = 0
  for (const r of respuestas ?? []) {
    if (r?.respuesta_numerica == null) continue
    const valor = Number(r.respuesta_numerica)
    if (!Number.isFinite(valor)) continue
    const rango = (rangos ?? []).find(g =>
      g.id_pregunta === r.id_pregunta &&
      valor >= Number(g.valor_min) &&
      (g.valor_max == null || valor < Number(g.valor_max))
    )
    if (rango) total += rango.puntos
  }
  return total
}

/**
 * Suma los puntos de las opciones seleccionadas.
 * @param {Array<{id_opcion: string|null}>} respuestas
 * @param {Array<{id_opcion: string, valor_puntos: number}>} opciones
 * @returns {number}
 */
export function puntosPorOpciones(respuestas, opciones) {
  const porId = new Map((opciones ?? []).map(o => [o.id_opcion, o.valor_puntos ?? 0]))
  return (respuestas ?? []).reduce((sum, r) => sum + (porId.get(r?.id_opcion) ?? 0), 0)
}

/**
 * Clasifica un puntaje según el modelo de score.
 * Misma regla que la RPC: >= mínimo → PRE_APROBADO; >= 67% del mínimo →
 * REVISION_MANUAL; menor → RECHAZAR.
 * @param {number} puntaje
 * @param {{puntaje_minimo?: number}} modelo
 * @returns {'PRE_APROBADO'|'REVISION_MANUAL'|'RECHAZAR'}
 */
export function clasificarPuntaje(puntaje, modelo = {}) {
  // Escala 0–1000 (migración 44): 429 equivale al antiguo 600 sobre la suma cruda
  const minimo = modelo.puntaje_minimo ?? 429
  if (puntaje >= minimo)        return 'PRE_APROBADO'
  if (puntaje >= minimo * 0.67) return 'REVISION_MANUAL'
  return 'RECHAZAR'
}

// Color del score según la regla real del modelo (W-05): verde = pre-aprobable,
// amarillo = revisión manual, rojo = rechazo. Antes eran umbrales fijos 700/500.
export function colorScore(puntaje, modelo = {}) {
  if (puntaje == null) return 'text-slate-500'
  const dictamen = clasificarPuntaje(puntaje, modelo)
  return dictamen === 'PRE_APROBADO' ? 'text-emerald-400'
    : dictamen === 'REVISION_MANUAL' ? 'text-yellow-400'
    : 'text-red-400'
}
