import { createServiceClient } from '@/lib/supabase/service'

const TIPO_CODIGO = {
  contrato: 'CONTRATO',
  'plan-pagos': 'TABLA_AMORTIZACION',
  'estado-cuenta': 'ESTADO_CUENTA',
  'paz-y-salvo': 'PAZ_Y_SALVO',
}

export async function ensureDocumentoLegal({ idCliente, idCredito, tipoSlug, urlArchivo }) {
  const supabase = createServiceClient()
  const codigo = TIPO_CODIGO[tipoSlug] || tipoSlug.toUpperCase()

  let { data: tipoDoc } = await supabase
    .from('tipo_documento_legal')
    .select('id_tipo_doc_legal')
    .eq('codigo', codigo)
    .maybeSingle()

  if (!tipoDoc) {
    const { data: nuevo } = await supabase
      .from('tipo_documento_legal')
      .insert({ codigo, nombre: codigo.replace(/_/g, ' '), descripcion: codigo })
      .select('id_tipo_doc_legal')
      .single()
    tipoDoc = nuevo
  }

  const { data: existente } = await supabase
    .from('documento_legal')
    .select('id_documento_legal')
    .eq('id_credito', idCredito)
    .eq('id_tipo_doc_legal', tipoDoc.id_tipo_doc_legal)
    .eq('activo', true)
    .maybeSingle()

  if (existente) return existente.id_documento_legal

  const { data: creado } = await supabase
    .from('documento_legal')
    .insert({
      id_cliente: idCliente,
      id_credito: idCredito,
      id_tipo_doc_legal: tipoDoc.id_tipo_doc_legal,
      url_archivo: urlArchivo,
      mime_type: 'application/pdf',
    })
    .select('id_documento_legal')
    .single()

  return creado?.id_documento_legal
}

export async function verificarLimiteDescargaService(idCliente, idDocumentoLegal) {
  if (!idCliente || !idDocumentoLegal) return { ok: true }
  const supabase = createServiceClient()
  const hoy = new Date().toISOString().split('T')[0]
  const { count } = await supabase
    .from('log_descarga_documento')
    .select('*', { count: 'exact', head: true })
    .eq('id_cliente', idCliente)
    .eq('id_documento_legal', idDocumentoLegal)
    .gte('descargado_at', `${hoy}T00:00:00`)
  if ((count ?? 0) >= 2) {
    return { ok: false, error: 'Límite de 2 descargas diarias alcanzado para este documento.' }
  }
  return { ok: true }
}

export async function registrarDescargaService({ idCliente, idDocumentoLegal, ip, userAgent }) {
  const supabase = createServiceClient()
  await supabase.from('log_descarga_documento').insert({
    id_cliente: idCliente,
    id_documento_legal: idDocumentoLegal,
    ip_cliente: ip || null,
    user_agent: userAgent || null,
  })
}
