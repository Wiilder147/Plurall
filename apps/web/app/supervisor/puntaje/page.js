/* ==========================================================================
 * ARCHIVO: page.js
 * RUTA: apps/web/app/supervisor/puntaje/page.js
 * DESCRIPCIÓN: Módulo "Puntaje crediticio" (SUPERVISOR).
 * FUNCIONALIDAD: Lista los scores calculados por el motor de evaluación para
 *                cada solicitud, con su recomendación y porcentaje.
 * ========================================================================== */
import { createClient } from '@/lib/supabase/server'
import { formatCOP } from '@/lib/calculadora'
import { Gauge, User, Calendar } from 'lucide-react'

export const dynamic = 'force-dynamic'

const RECO = {
  APROBAR:        { label: 'Recomendado',    cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  REVISAR_MANUAL: { label: 'Revisar manual', cls: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  RECHAZAR:       { label: 'No recomendado', cls: 'bg-red-500/10 text-red-400 border-red-500/20' },
}

export default async function PuntajePage() {
  const supabase = await createClient()

  const { data: scores } = await supabase
    .from('score')
    .select(`
      id_score, puntaje_total, puntaje_maximo_posible, porcentaje, recomendacion, fecha_evaluacion,
      modelo_score ( nombre_modelo ),
      solicitud_credito ( monto_solicitado, cliente ( nombre_completo, dni ) )
    `)
    .order('fecha_evaluacion', { ascending: false })

  const lista = scores ?? []

  return (
    <div className="flex flex-col gap-6 pb-10">
      <header>
        <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
          <Gauge className="w-7 h-7 text-indigo-400" /> Puntaje crediticio
        </h1>
        <p className="text-slate-400 mt-1">Resultados del motor de evaluación de riesgo por solicitud.</p>
      </header>

      {lista.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Gauge className="w-12 h-12 text-slate-600 mb-4" />
          <p className="text-slate-400 font-medium">Aún no hay evaluaciones de puntaje registradas.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {lista.map((s) => {
            const cliente = s.solicitud_credito?.cliente
            const reco = RECO[s.recomendacion?.toUpperCase()] || RECO.REVISAR_MANUAL
            const pct = Number(s.porcentaje ?? 0)
            const fecha = s.fecha_evaluacion
              ? new Date(s.fecha_evaluacion).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
              : '—'
            return (
              <div key={s.id_score} className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-start gap-4 min-w-0">
                    <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center shrink-0">
                      <User className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-slate-200 text-sm">{cliente?.nombre_completo ?? 'Sin cliente'}</p>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${reco.cls}`}>{reco.label}</span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-slate-500">
                        <span>CC {cliente?.dni ?? '—'}</span>
                        <span>{formatCOP(s.solicitud_credito?.monto_solicitado ?? 0)}</span>
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {fecha}</span>
                        <span>{s.modelo_score?.nombre_modelo ?? 'Modelo'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0 pl-14 sm:pl-0">
                    <p className="text-2xl font-bold text-white">{s.puntaje_total}<span className="text-sm text-slate-500">/{s.puntaje_maximo_posible}</span></p>
                    <div className="w-32 h-2 bg-slate-700 rounded-full mt-1 overflow-hidden">
                      <div className={`h-full rounded-full ${pct >= 70 ? 'bg-emerald-500' : pct >= 40 ? 'bg-blue-500' : 'bg-red-500'}`} style={{ width: `${Math.min(100, pct)}%` }} />
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{pct.toFixed(1)}%</p>
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
