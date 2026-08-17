import { createClient } from '@/lib/supabase/server'
import { formatCOP } from '@/lib/calculadora'
import { FileCheck, Clock, Phone, User, Calendar, TrendingUp, CheckCircle2, XCircle } from 'lucide-react'
import AccionesSolicitud from './AccionesSolicitud'
import { formatNombre } from '@/lib/nombre'

export const dynamic = 'force-dynamic'

const BADGE = {
  PENDIENTE:    { label: 'Pendiente',    cls: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
  EN_ESTUDIO:   { label: 'Pre-aprobada', cls: 'bg-teal-500/10 text-teal-400 border-teal-500/20'    },
  APROBADA:     { label: 'Aprobada',     cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  RECHAZADA:    { label: 'Rechazada',    cls: 'bg-red-500/10 text-red-400 border-red-500/20'       },
  DESEMBOLSADA: { label: 'Desembolsada', cls: 'bg-green-500/10 text-green-400 border-green-500/20' },
}

export default async function AsesorSolicitudesPage({ searchParams }) {
  const supabase = await createClient()
  const params   = await searchParams
  const tab      = params?.tab?.toUpperCase() || 'PENDIENTE'

  // Traer todas las solicitudes junto con sus scores
  const { data: todas } = await supabase
    .from('solicitud_credito')
    .select(`
      id_solicitud,
      monto_solicitado,
      plazo_meses,
      proposito,
      fecha_solicitud,
      comentarios_analista,
      estado_solicitud ( nombre ),
      cliente ( primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, dni, telefono ),
      score ( recomendacion, puntaje_total, porcentaje )
    `)
    .order('fecha_solicitud', { ascending: false })

  const pendientes    = (todas ?? []).filter(s => s.estado_solicitud?.nombre?.toUpperCase() === 'PENDIENTE')
  const preAprobadas  = (todas ?? []).filter(s => s.estado_solicitud?.nombre?.toUpperCase() === 'EN_ESTUDIO')
  const rechazadas    = (todas ?? []).filter(s => s.estado_solicitud?.nombre?.toUpperCase() === 'RECHAZADA')

  const solicitudesFiltradas = tab === 'PENDIENTE'   ? pendientes
    : tab === 'EN_ESTUDIO' ? preAprobadas
    : tab === 'RECHAZADA'  ? rechazadas
    : (todas ?? [])

  const tabs = [
    { key: 'PENDIENTE',   label: 'Por revisar',    count: pendientes.length   },
    { key: 'EN_ESTUDIO',  label: 'Pre-aprobadas',  count: preAprobadas.length },
    { key: 'RECHAZADA',   label: 'Rechazadas',     count: rechazadas.length   },
    { key: 'TODAS',       label: 'Todas',          count: todas?.length ?? 0  },
  ]

  return (
    <div className="flex flex-col gap-6 pb-10">
      <header>
        <h1 className="text-3xl font-bold text-white tracking-tight">Solicitudes de Crédito</h1>
        <p className="text-slate-400 mt-1">
          Revisa las solicitudes pendientes, llama al cliente para verificar datos y pre-aprueba o rechaza.
        </p>
      </header>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map(({ key, label, count }) => (
          <a
            key={key}
            href={`/asesor/solicitudes${key === 'TODAS' ? '?tab=todas' : `?tab=${key.toLowerCase()}`}`}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              tab === key
                ? 'bg-teal-500 text-white shadow-md shadow-teal-500/20'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
            }`}
          >
            {label}
            {count > 0 && (
              <span className="ml-2 bg-slate-900/40 text-xs px-1.5 py-0.5 rounded-full">{count}</span>
            )}
          </a>
        ))}
      </div>

      {/* Aviso contextual para la tab activa */}
      {tab === 'PENDIENTE' && pendientes.length > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 text-yellow-300 text-sm flex items-start gap-3">
          <Clock className="w-5 h-5 shrink-0 mt-0.5" />
          <p>
            Tienes <strong>{pendientes.length}</strong> solicitud{pendientes.length !== 1 ? 'es' : ''} esperando revisión.
            Llama al cliente, verifica la información y regístra tu decisión con notas.
          </p>
        </div>
      )}

      {/* Lista */}
      {solicitudesFiltradas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <FileCheck className="w-12 h-12 text-slate-600 mb-4" />
          <p className="text-slate-400 font-medium">No hay solicitudes en esta categoría.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {solicitudesFiltradas.map((sol) => {
            const estado    = sol.estado_solicitud?.nombre?.toUpperCase() || 'PENDIENTE'
            const badge     = BADGE[estado] || BADGE.PENDIENTE
            const isPending = estado === 'PENDIENTE'
            const score     = Array.isArray(sol.score) ? sol.score[0] : sol.score
            const recomendacion = score?.recomendacion
            const fecha = new Date(sol.fecha_solicitud).toLocaleDateString('es-CO', {
              day: '2-digit', month: 'short', year: 'numeric',
            })

            return (
              <div
                key={sol.id_solicitud}
                className={`bg-slate-800 border rounded-2xl p-5 transition-colors ${
                  isPending ? 'border-yellow-500/30 hover:border-yellow-500/50' : 'border-slate-700'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">

                  {/* Info del cliente */}
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div className="w-10 h-10 bg-teal-500/20 rounded-xl flex items-center justify-center shrink-0">
                      <User className="w-5 h-5 text-teal-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-slate-200 text-sm">{formatNombre(sol.cliente)}</p>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${badge.cls}`}>
                          {badge.label}
                        </span>
                        {recomendacion && (
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            recomendacion === 'APROBAR'       ? 'bg-emerald-500/10 text-emerald-400' :
                            recomendacion === 'REVISAR_MANUAL'? 'bg-blue-500/10 text-blue-400'       :
                            'bg-red-500/10 text-red-400'
                          }`}>
                            Motor: {recomendacion === 'APROBAR' ? 'Recomendado' : recomendacion === 'REVISAR_MANUAL' ? 'Revisar' : 'No recomendado'}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3" /> {sol.cliente?.telefono}
                        </span>
                        <span className="flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" /> {formatCOP(sol.monto_solicitado)} — {sol.plazo_meses} meses
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> {fecha}
                        </span>
                      </div>

                      {sol.proposito && (
                        <p className="text-slate-500 text-xs mt-1.5 italic line-clamp-1">{sol.proposito}</p>
                      )}

                      {sol.comentarios_analista && (
                        <div className="mt-2 bg-slate-900/60 rounded-lg px-3 py-2">
                          <p className="text-slate-400 text-xs">
                            <strong className="text-slate-300">Notas:</strong> {sol.comentarios_analista}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Acciones */}
                  <div className="flex items-center gap-2 shrink-0 pl-14 sm:pl-0">
                    {isPending ? (
                      <AccionesSolicitud
                        solicitudId={sol.id_solicitud}
                        nombreCliente={formatNombre(sol.cliente) || 'el cliente'}
                      />
                    ) : (
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        {estado === 'EN_ESTUDIO' && <CheckCircle2 className="w-4 h-4 text-teal-400" />}
                        {estado === 'RECHAZADA'  && <XCircle      className="w-4 h-4 text-red-400"  />}
                        <span>{estado === 'EN_ESTUDIO' ? 'Enviada al supervisor' : 'Procesada'}</span>
                      </div>
                    )}
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
