/* ==========================================================================
 * ARCHIVO: page.js
 * RUTA: apps/web/app/asesor/documentos/page.js
 * DESCRIPCIÓN: Módulo "Documentación" (ASESOR).
 * FUNCIONALIDAD: Lista los documentos cargados por los clientes con su estado
 *                de verificación; permite abrir cada archivo.
 * ========================================================================== */
import { createClient } from '@/lib/supabase/server'
import { urlPublicaDocumento } from '@/lib/documentos'
import { FileText, CheckCircle2, XCircle, Clock, ExternalLink } from 'lucide-react'

export const dynamic = 'force-dynamic'

const ESTADO = {
  VERIFICADO: { label: 'Verificado', cls: 'bg-emerald-500/10 text-emerald-400', Icon: CheckCircle2 },
  PENDIENTE:  { label: 'Pendiente',  cls: 'bg-yellow-500/10 text-yellow-400',   Icon: Clock },
  RECHAZADO:  { label: 'Rechazado',  cls: 'bg-red-500/10 text-red-400',         Icon: XCircle },
}

export default async function DocumentosAsesorPage() {
  const supabase = await createClient()

  const { data: docs } = await supabase
    .from('documento_cliente')
    .select(`
      id_documento, tipo_documento, url_archivo, estado_verificacion, created_at,
      cliente ( nombre_completo, dni )
    `)
    .eq('activo', true)
    .order('created_at', { ascending: false })
    .limit(150)

  const lista = docs ?? []

  return (
    <div className="flex flex-col gap-6 pb-10">
      <header>
        <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
          <FileText className="w-7 h-7 text-teal-400" /> Documentación
        </h1>
        <p className="text-slate-400 mt-1">Documentos de tus clientes y su estado de verificación.</p>
      </header>

      {lista.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <FileText className="w-12 h-12 text-slate-600 mb-4" />
          <p className="text-slate-400 font-medium">No hay documentos cargados.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {lista.map((d) => {
            const est = ESTADO[d.estado_verificacion?.toUpperCase()] || ESTADO.PENDIENTE
            const fecha = new Date(d.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
            return (
              <div key={d.id_documento} className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex items-center gap-3">
                <div className="w-9 h-9 bg-teal-500/20 rounded-lg flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4 text-teal-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-slate-200 text-sm">{d.tipo_documento || 'Documento'}</p>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${est.cls}`}>
                      <est.Icon className="w-3 h-3" /> {est.label}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-slate-500">
                    <span>{d.cliente?.nombre_completo ?? '—'}</span>
                    <span>CC {d.cliente?.dni ?? '—'}</span>
                    <span>{fecha}</span>
                  </div>
                </div>
                {d.url_archivo && (
                  <a href={urlPublicaDocumento(d.url_archivo)} target="_blank" rel="noopener noreferrer"
                    className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-teal-400 hover:text-teal-300 bg-teal-500/10 px-3 py-1.5 rounded-lg">
                    Ver / Descargar <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
