/* ==========================================================================
 * ARCHIVO: kyc.js
 * RUTA: apps/web/lib/kyc.js
 * DESCRIPCIÓN: Regla de KYC sobre las solicitudes de crédito (server, service-role).
 * FUNCIONALIDAD: M-01 (decisión de negocio 29-oct-2026): un documento KYC
 *                rechazado rechaza la solicitud activa y bloquea aprobar,
 *                pre-aprobar y desembolsar. JM-01 (09-nov-2026): también
 *                bloquea si la cédula está pendiente o no se ha cargado.
 * ========================================================================== */

// Estados de solicitud que aún no tienen crédito desembolsado.
const ESTADOS_ACTIVOS = ['PENDIENTE', 'EN_ESTUDIO', 'APROBADA']

// Documentos de identidad obligatorios (JM-01, decisión 09-nov-2026: KYC
// rechazado o pendiente bloquea). Los soportes (recibo, extracto…) no son KYC.
export const DOCUMENTOS_KYC = ['CEDULA_FRONTAL', 'CEDULA_TRASERA']

export const MENSAJE_KYC_RECHAZADO =
  'El cliente tiene un documento de identidad rechazado: no se puede continuar con la solicitud.'

export const MENSAJE_KYC_INCOMPLETO =
  'La identidad del cliente no está verificada: la cédula (frontal y trasera) debe estar aprobada antes de continuar.'

const activos = (data) => (data ?? []).filter(d => d.activo !== false)
const estado = (d) => String(d.estado_verificacion).toUpperCase()

async function documentosDe(db, idCliente) {
  const { data } = await db
    .from('documento_cliente')
    .select('id_documento, tipo_documento, estado_verificacion, activo')
    .eq('id_cliente', idCliente)
  return activos(data)
}

/** ¿El cliente tiene algún documento KYC activo en estado RECHAZADO? */
export async function tieneKycRechazado(db, idCliente) {
  return (await documentosDe(db, idCliente)).some(d => estado(d) === 'RECHAZADO')
}

/**
 * Mensaje de bloqueo si el KYC del cliente no permite pre-aprobar, aprobar ni
 * desembolsar; null si está completo. Completo = ningún documento activo
 * RECHAZADO y cada documento de DOCUMENTOS_KYC con una versión activa APROBADA
 * (pendiente o faltante bloquea).
 */
export async function bloqueoKyc(db, idCliente) {
  const docs = await documentosDe(db, idCliente)
  if (docs.some(d => estado(d) === 'RECHAZADO')) return MENSAJE_KYC_RECHAZADO
  const aprobados = new Set(docs.filter(d => estado(d) === 'APROBADO').map(d => d.tipo_documento))
  return DOCUMENTOS_KYC.every(t => aprobados.has(t)) ? null : MENSAJE_KYC_INCOMPLETO
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
