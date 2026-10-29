/* ==========================================================================
 * ARCHIVO: kyc.js
 * RUTA: apps/web/lib/kyc.js
 * DESCRIPCIÓN: Regla de KYC sobre las solicitudes de crédito (server, service-role).
 * FUNCIONALIDAD: M-01 (decisión de negocio 29-oct-2026): un documento KYC
 *                rechazado rechaza la solicitud activa y bloquea aprobar,
 *                pre-aprobar y desembolsar.
 * ========================================================================== */

// Estados de solicitud que aún no tienen crédito desembolsado.
const ESTADOS_ACTIVOS = ['PENDIENTE', 'EN_ESTUDIO', 'APROBADA']

export const MENSAJE_KYC_RECHAZADO =
  'El cliente tiene un documento de identidad rechazado: no se puede continuar con la solicitud.'

/** ¿El cliente tiene algún documento KYC activo en estado RECHAZADO? */
export async function tieneKycRechazado(db, idCliente) {
  const { data } = await db
    .from('documento_cliente')
    .select('id_documento, estado_verificacion, activo')
    .eq('id_cliente', idCliente)
  return (data ?? []).some(d => d.activo !== false && String(d.estado_verificacion).toUpperCase() === 'RECHAZADO')
}

/**
 * Rechaza las solicitudes activas del cliente por KYC rechazado, dejando una
 * decision_solicitud para trazabilidad. Devuelve cuántas se rechazaron.
 */
export async function rechazarSolicitudesPorKyc(db, { idCliente, idUsuario, motivo }) {
  const { data: estados } = await db.from('estado_solicitud').select('id_estado_solicitud, nombre')
  const idPorNombre = Object.fromEntries((estados ?? []).map(e => [String(e.nombre).toUpperCase(), e.id_estado_solicitud]))
  const idRechazada = idPorNombre.RECHAZADA
  const activos = ESTADOS_ACTIVOS.map(n => idPorNombre[n]).filter(Boolean)
  if (!idRechazada || !activos.length) return 0

  const ahora = new Date().toISOString()
  const { data: rechazadas } = await db
    .from('solicitud_credito')
    .update({
      id_estado_solicitud:  idRechazada,
      id_usuario_evaluador: idUsuario,
      fecha_decision:       ahora,
      comentarios_analista: `Rechazo automático por documento KYC rechazado: ${motivo}`,
      updated_at:           ahora,
    })
    .eq('id_cliente', idCliente)
    .in('id_estado_solicitud', activos)
    .select('id_solicitud')

  for (const s of rechazadas ?? []) {
    await db.from('decision_solicitud').insert({
      id_solicitud:         s.id_solicitud,
      id_analista:          idUsuario,
      resultado:            'RECHAZADO',
      comentarios_cliente:  'Tu solicitud fue rechazada porque uno de tus documentos de identidad no pudo ser verificado.',
      comentarios_tecnicos: `Documento KYC rechazado: ${motivo}`,
      fecha_decision:       ahora,
    })
  }
  return rechazadas?.length ?? 0
}
