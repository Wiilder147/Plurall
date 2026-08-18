/* ==========================================================================
 * ARCHIVO: metricas.js
 * RUTA: apps/web/lib/metricas.js
 * DESCRIPCIÓN: Definiciones canónicas de los indicadores de negocio.
 * FUNCIONALIDAD: Centraliza el cálculo de los KPIs que se muestran en los
 *                paneles de admin y supervisor, para que TODOS los paneles
 *                arrojen exactamente los mismos números (no que uno diga 39 y
 *                otro 2). Reciben un cliente Supabase (con sesión o service).
 * ========================================================================== */

// Un crédito "vigente/activo" es el que sigue en curso: ACTIVO o EN_MORA.
// Un crédito EN_MORA sigue vigente (no está pagado ni cancelado).
export const ESTADOS_CREDITO_VIGENTE = ['ACTIVO', 'EN_MORA']

// Una solicitud "pendiente de gestión" está PENDIENTE o EN_ESTUDIO.
export const ESTADOS_SOLICITUD_PENDIENTE = ['PENDIENTE', 'EN_ESTUDIO']

/** Créditos vigentes (ACTIVO + EN_MORA). */
export async function contarCreditosVigentes(db) {
  const { count } = await db
    .from('credito')
    .select('*', { count: 'exact', head: true })
    .in('estado_credito', ESTADOS_CREDITO_VIGENTE)
  return count ?? 0
}

/** Créditos EN_MORA (subconjunto de los vigentes). */
export async function contarCreditosEnMora(db) {
  const { count } = await db
    .from('credito')
    .select('*', { count: 'exact', head: true })
    .eq('estado_credito', 'EN_MORA')
  return count ?? 0
}

/**
 * Solicitudes pendientes de gestión. Se resuelven primero los ids de estado y
 * se cuenta por id — el filtro embebido `.in('estado_solicitud.nombre', …)` de
 * PostgREST NO filtra el count y devuelve números incorrectos.
 */
export async function contarSolicitudesPendientes(db) {
  const { data: estados } = await db
    .from('estado_solicitud')
    .select('id_estado_solicitud, nombre')
    .in('nombre', ESTADOS_SOLICITUD_PENDIENTE)
  const ids = (estados ?? []).map(e => e.id_estado_solicitud)
  if (!ids.length) return 0
  const { count } = await db
    .from('solicitud_credito')
    .select('*', { count: 'exact', head: true })
    .in('id_estado_solicitud', ids)
  return count ?? 0
}

/** Total de solicitudes registradas. */
export async function contarSolicitudesTotales(db) {
  const { count } = await db
    .from('solicitud_credito')
    .select('*', { count: 'exact', head: true })
  return count ?? 0
}
