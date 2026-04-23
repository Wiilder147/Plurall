import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatCOP } from '@/lib/calculadora'
import { ArrowRight, Clock, CheckCircle2, XCircle, Hourglass, TrendingUp, Search } from 'lucide-react'

export const dynamic = 'force-dynamic'

const ESTADO_UI = {
  PENDIENTE:    { label: 'Pendiente',   color: 'bg-yellow-500/10 text-yellow-400',   icon: Clock       },
  EN_ESTUDIO:   { label: 'En estudio',  color: 'bg-blue-500/10 text-blue-400',       icon: Hourglass   },
  APROBADA:     { label: 'Aprobada',    color: 'bg-emerald-500/10 text-emerald-400', icon: CheckCircle2},
  DESEMBOLSADA: { label: 'Activa',      color: 'bg-green-500/10 text-green-400',     icon: TrendingUp  },
  RECHAZADA:    { label: 'Rechazada',   color: 'bg-red-500/10 text-red-400',         icon: XCircle     },
  CANCELADA:    { label: 'Cancelada',   color: 'bg-slate-500/10 text-slate-400',     icon: XCircle     },
}

export default async function AdminSolicitudesPage({ searchParams }) {
  const supabase = await createClient()
  const params   = await searchParams
  const filtro   = params?.estado?.toUpperCase() || 'TODOS'

  let query = supabase
    .from('solicitud_credito')
    .select(`
      id_solicitud,
      monto_solicitado,
      plazo_meses,
      proposito,
      fecha_solicitud,
      estado_solicitud ( nombre ),
      cliente ( nombre_completo, dni, telefono )
    `)
    .order('fecha_solicitud', { ascending: false })

  if (filtro !== 'TODOS') {
    // Filtramos por nombre del estado (usando subquery implícito en Supabase no es directo)
    // Hacemos el filtro en memoria para el MVP
  }

  const { data: todas } = await query

  const solicitudes = filtro === 'TODOS'
    ? todas || []
    : (todas || []).filter((s) => s.estado_solicitud?.nombre?.toUpperCase() === filtro)

  const tabs = [
    { key: 'TODOS',      label: 'Todas',        count: todas?.length || 0 },
    { key: 'PENDIENTE',  label: 'Pendientes',   count: todas?.filter((s) => s.estado_solicitud?.nombre?.toUpperCase() === 'PENDIENTE').length || 0 },
    { key: 'EN_ESTUDIO', label: 'En estudio',   count: todas?.filter((s) => s.estado_solicitud?.nombre?.toUpperCase() === 'EN_ESTUDIO').length || 0 },
    { key: 'APROBADA',   label: 'Aprobadas',    count: todas?.filter((s) => s.estado_solicitud?.nombre?.toUpperCase() === 'APROBADA').length || 0 },
    { key: 'RECHAZADA',  label: 'Rechazadas',   count: todas?.filter((s) => s.estado_solicitud?.nombre?.toUpperCase() === 'RECHAZADA').length || 0 },
  ]

  return (
    <div className="flex flex-col gap-6 pb-10">
      <header>
        <h1 className="text-3xl font-bold text-white tracking-tight">Solicitudes de Crédito</h1>
        <p className="text-slate-400 mt-1">Revisa, aprueba o rechaza las solicitudes de los clientes.</p>
      </header>

      {/* Tabs de filtro */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map(({ key, label, count }) => (
          <Link
            key={key}
            href={`/admin/solicitudes${key === 'TODOS' ? '' : `?estado=${key.toLowerCase()}`}`}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              filtro === key
                ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
            }`}
          >
            {label}
            {count > 0 && (
              <span className="ml-2 bg-slate-900/40 text-xs px-1.5 py-0.5 rounded-full">{count}</span>
            )}
          </Link>
        ))}
      </div>

      {/* Lista */}
      {solicitudes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Search className="w-12 h-12 text-slate-600 mb-4" />
          <p className="text-slate-400">No hay solicitudes en esta categoría.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {solicitudes.map((sol) => {
            const estadoNombre = sol.estado_solicitud?.nombre?.toUpperCase() || 'PENDIENTE'
            const ui = ESTADO_UI[estadoNombre] || ESTADO_UI.PENDIENTE
            const IconEstado = ui.icon
            const fecha = new Date(sol.fecha_solicitud).toLocaleDateString('es-CO', {
              day: '2-digit', month: 'short', year: 'numeric',
            })

            return (
              <Link
                key={sol.id_solicitud}
                href={`/admin/solicitudes/${sol.id_solicitud}`}
                className="bg-slate-800 border border-slate-700 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 hover:border-slate-600 transition-colors"
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-slate-700 rounded-xl flex items-center justify-center text-slate-400 font-bold text-sm shrink-0">
                    {sol.cliente?.nombre_completo?.charAt(0)?.toUpperCase() || 'C'}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-200">{sol.cliente?.nombre_completo || 'Cliente'}</p>
                    <p className="text-slate-500 text-xs">CC {sol.cliente?.dni} — {sol.cliente?.telefono}</p>
                    <p className="text-slate-400 text-sm mt-1">{formatCOP(sol.monto_solicitado)} — {sol.plazo_meses} meses</p>
                    {sol.proposito && (
                      <p className="text-slate-500 text-xs mt-0.5 line-clamp-1">{sol.proposito}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${ui.color}`}>
                      <IconEstado className="w-3 h-3" />{ui.label}
                    </span>
                    <p className="text-slate-500 text-xs mt-1">{fecha}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-600" />
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
