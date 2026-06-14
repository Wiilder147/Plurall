/* ==========================================================================
 * ARCHIVO: page.js
 * RUTA: apps/web/app/asesor/pqr/page.js
 * DESCRIPCIÓN: Módulo "PQR" (ASESOR).
 * FUNCIONALIDAD: Lista las PQR de los clientes y permite responderlas y cambiar
 *                su estado.
 * ========================================================================== */
import { createClient } from '@/lib/supabase/server'
import { MessageSquare, User } from 'lucide-react'
import ResponderPqr from '@/components/ResponderPqr'

export const dynamic = 'force-dynamic'

const ESTADO = {
  ABIERTO:    'bg-yellow-500/10 text-yellow-400',
  EN_PROCESO: 'bg-blue-500/10 text-blue-400',
  RESUELTO:   'bg-emerald-500/10 text-emerald-400',
  CERRADO:    'bg-slate-500/10 text-slate-400',
}

export default async function PqrAsesorPage() {
  const supabase = await createClient()

  const { data: pqrs } = await supabase
    .from('pqr')
    .select('id_pqr, tipo, asunto, descripcion, estado, respuesta, created_at, cliente ( nombre_completo, dni )')
    .order('created_at', { ascending: false })

  const lista = pqrs ?? []

  return (
    <div className="flex flex-col gap-6 pb-10">
      <header>
        <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
          <MessageSquare className="w-7 h-7 text-teal-400" /> PQR
        </h1>
        <p className="text-slate-400 mt-1">Peticiones, quejas y reclamos de tus clientes.</p>
      </header>

      {lista.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <MessageSquare className="w-12 h-12 text-slate-600 mb-4" />
          <p className="text-slate-400 font-medium">No hay PQR registradas.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {lista.map((p) => {
            const fecha = new Date(p.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
            return (
              <div key={p.id_pqr} className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="flex items-start gap-4 min-w-0">
                    <div className="w-10 h-10 bg-teal-500/20 rounded-xl flex items-center justify-center shrink-0">
                      <User className="w-5 h-5 text-teal-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-slate-200 text-sm">{p.cliente?.nombre_completo ?? '—'}</p>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-300 capitalize">{p.tipo.toLowerCase()}</span>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ESTADO[p.estado] || ESTADO.ABIERTO}`}>{p.estado.replace('_', ' ')}</span>
                      </div>
                      <p className="font-medium text-slate-200 text-sm mt-1.5">{p.asunto}</p>
                      <p className="text-slate-500 text-xs mt-1">{p.descripcion}</p>
                      <p className="text-slate-600 text-xs mt-1">CC {p.cliente?.dni ?? '—'} · {fecha}</p>
                      {p.respuesta && (
                        <div className="mt-2 bg-slate-900/60 rounded-lg px-3 py-2">
                          <p className="text-slate-400 text-xs"><strong className="text-emerald-400">Respuesta:</strong> {p.respuesta}</p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 pl-14 sm:pl-0">
                    <ResponderPqr pqr={p} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
