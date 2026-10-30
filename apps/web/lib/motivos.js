/* ==========================================================================
 * ARCHIVO: motivos.js
 * RUTA: apps/web/lib/motivos.js
 * DESCRIPCIÓN: Motivos de rechazo del catálogo (M-08/M-09).
 * FUNCIONALIDAD: Los rechazos deben usar un motivo ACTIVO del catálogo
 *                (motivo_rechazo); el cliente solo ve su texto si
 *                visible_cliente = true.
 * ========================================================================== */

/** @returns {Promise<{ motivo?: object, error?: string }>} */
export async function resolverMotivoRechazo(db, idMotivo) {
  if (!idMotivo) return { error: 'Selecciona un motivo de rechazo del catálogo.' }
  const { data } = await db
    .from('motivo_rechazo')
    .select('id_motivo, descripcion_motivo, visible_cliente, activo')
    .eq('id_motivo', idMotivo)
    .maybeSingle()
  if (!data || !data.activo) return { error: 'El motivo seleccionado no existe o está inactivo.' }
  return { motivo: data }
}

/** Texto del motivo que puede ver el cliente (null si es interno). */
export const textoMotivoCliente = (motivo) => (motivo?.visible_cliente ? motivo.descripcion_motivo : null)
