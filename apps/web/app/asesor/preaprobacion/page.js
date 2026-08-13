/* ==========================================================================
 * ARCHIVO: page.js
 * RUTA: apps/web/app/asesor/preaprobacion/page.js
 * DESCRIPCIÓN: Módulo "Preaprobación de crédito" (ASESOR).
 * FUNCIONALIDAD: Lista las solicitudes PENDIENTES y permite al asesor
 *                preaprobarlas (botón check) para enviarlas al supervisor, o
 *                rechazarlas. Reutiliza el flujo de /api/asesor/solicitudes.
 * ========================================================================== */
import { createClient } from '@/lib/supabase/server'
import { formatCOP } from '@/lib/calculadora'
import { CheckCircle2, User, Phone, TrendingUp, Calendar } from 'lucide-react'
import AccionesSolicitud from '../solicitudes/AccionesSolicitud'
import { formatNombre } from '@/lib/nombre'

export const dynamic = 'force-dynamic'

export default async function PreaprobacionPage() {
  const supabase = await createClient()

  const { data: todas } = await supabase
    .from('solicitud_credito')
    .select(`
      id_solicitud, monto_solicitado, plazo_meses, proposito, fecha_solicitud,
      estado_solicitud ( nombre ),
      cliente ( primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, dni, telefono ),
      score ( recomendacion )
    `)
    .order('fecha_solicitud', { ascending: false })

  const pendientes = (todas ?? []).filter(s => s.estado_solicitud?.nombre?.toUpperCase() === 'PENDIENTE')

  return (
    <div className="flex flex-col gap-6 pb-10">
      <header>
        <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
          <CheckCircle2 className="w-7 h-7 text-teal-400" /> Preaprobación de crédito
        </h1>
        <p className="text-slate-400 mt-1">
          Verifica los datos del cliente y preaprueba la solicitud para enviarla al supervisor.
        </p>
      </header>

      {pendientes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <CheckCircle2 className="w-12 h-12 text-slate-600 mb-4" />
          <p className="text-slate-400 font-medium">No hay solicitudes pendientes de preaprobación.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {pendientes.map((sol) => {
            const score = Array.isArray(sol.score) ? sol.score[0] : sol.score
            const fecha = new Date(sol.fecha_solicitud).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
            return (
              <div key={sol.id_solicitud} className="bg-slate-800 border border-yellow-500/30 rounded-2xl p-5">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div className="w-10 h-10 bg-teal-500/20 rounded-xl flex items-center justify-center shrink-0">
                      <User className="w-5 h-5 text-teal-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-slate-200 text-sm">{formatNombre(sol.cliente)}</p>
                        {score?.recomendacion && (
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            score.recomendacion === 'APROBAR' ? 'bg-emerald-500/10 text-emerald-400' :
                            score.recomendacion === 'REVISAR_MANUAL' ? 'bg-blue-500/10 text-blue-400' :
                            'bg-red-500/10 text-red-400'
                          }`}>
                            Motor: {score.recomendacion === 'APROBAR' ? 'Recomendado' : score.recomendacion === 'REVISAR_MANUAL' ? 'Revisar' : 'No recomendado'}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-slate-500">
                        <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {sol.cliente?.telefono}</span>
                        <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" /> {formatCOP(sol.monto_solicitado)} — {sol.plazo_meses} meses</span>
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {fecha}</span>
                      </div>
                      {sol.proposito && <p className="text-slate-500 text-xs mt-1.5 italic line-clamp-1">{sol.proposito}</p>}
                    </div>
                  </div>
                  <div className="shrink-0 pl-14 sm:pl-0">
                    <AccionesSolicitud solicitudId={sol.id_solicitud} nombreCliente={formatNombre(sol.cliente) || 'el cliente'} />
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
