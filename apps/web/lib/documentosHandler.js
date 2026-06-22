import { formatCOP } from '@/lib/calculadora'
import { resolverAccesoCredito } from '@/lib/documentos'
import { ensureDocumentoLegal, verificarLimiteDescargaService, registrarDescargaService } from '@/lib/documentoLegal'
import { wrapDocumentHtml, docRef, fmtFechaDoc, boxDeudor, boxAcreedor, firmasDoc } from '@/lib/documentosLegal'
import { responderDocumento } from '@/lib/pdf'
import { getClientIp } from '@/lib/rateLimit'

export async function procesarDocumento(request, { creditoId, tipoSlug, titulo, buildCuerpo, extraValidate }) {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('No autorizado', { status: 401 })

  const acceso = await resolverAccesoCredito(supabase, creditoId)
  if (acceso.error) return new Response(acceso.error, { status: acceso.status })

  const { data: credito } = await supabase
    .from('credito')
    .select('*')
    .eq('id_credito', creditoId)
    .single()
  if (!credito) return new Response('Crédito no encontrado', { status: 404 })

  if (extraValidate) {
    const err = extraValidate(credito)
    if (err) return new Response(err, { status: 403 })
  }

  const ref = docRef(creditoId)
  const urlArchivo = `/api/documentos/${tipoSlug}/${creditoId}`
  const idDocLegal = await ensureDocumentoLegal({
    idCliente: acceso.idCliente,
    idCredito: creditoId,
    tipoSlug,
    urlArchivo,
  })

  const { data: perfil } = await supabase
    .from('perfil_usuario')
    .select('rol ( nombre_rol )')
    .eq('id', user.id)
    .single()
  const esStaff = ['ADMIN', 'SUPERVISOR', 'ASESOR'].includes(perfil?.rol?.nombre_rol?.toUpperCase())

  if (!esStaff && idDocLegal) {
    const limite = await verificarLimiteDescargaService(acceso.idCliente, idDocLegal)
    if (!limite.ok) return new Response(limite.error, { status: 429 })
  }

  const cuerpo = await buildCuerpo({ credito, titular: acceso.titular, supabase, ref })
  const html = wrapDocumentHtml({ titulo, tipoDoc: tipoSlug, ref, creditoId, cuerpo })

  if (idDocLegal) {
    await registrarDescargaService({
      idCliente: acceso.idCliente,
      idDocumentoLegal: idDocLegal,
      ip: getClientIp(request),
      userAgent: request.headers.get('user-agent'),
    })
  }

  return responderDocumento(request, html, {
    filename: `plurall-${tipoSlug}-${ref}.pdf`,
    creditoId,
  })
}

export { boxDeudor, boxAcreedor, firmasDoc, fmtFechaDoc, formatCOP }
