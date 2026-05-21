'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { formatCOP } from '@/lib/calculadora'
import {
  ClipboardList, ArrowRight, Clock, CheckCircle2,
  XCircle, Hourglass, TrendingUp, Send, Loader2,
  CheckSquare, Square, AlertCircle, X,
} from 'lucide-react'

const ESTADO_UI = {
  PENDIENTE:    { label: 'Pendiente',    color: 'bg-yellow-500/10 text-yellow-400',   icon: Clock        },
  EN_ESTUDIO:   { label: 'En estudio',   color: 'bg-blue-500/10 text-blue-400',       icon: Hourglass    },
  APROBADA:     { label: 'Aprobada',     color: 'bg-emerald-500/10 text-emerald-400', icon: CheckCircle2 },
  DESEMBOLSADA: { label: 'Desembolsada', color: 'bg-green-500/10 text-green-400',     icon: TrendingUp   },
  RECHAZADA:    { label: 'Rechazada',    color: 'bg-red-500/10 text-red-400',         icon: XCircle      },
}

const TABS = [
  { key: 'PENDIENTE',  label: 'Pendientes'  },
  { key: 'EN_ESTUDIO', label: 'En estudio'  },
  { key: 'APROBADA',   label: 'Aprobadas'   },
  { key: 'RECHAZADA',  label: 'Rechazadas'  },
  { key: 'TODOS',      label: 'Todas'       },
]

export default function SupervisorSolicitudesPage() {
  const supabase = createClient()

  const [todas,      setTodas]      = useState([])
  const [filtro,     setFiltro]     = useState('PENDIENTE')
  const [loading,    setLoading]    = useState(true)
  const [selected,   setSelected]   = useState(new Set())   // ids de solicitudes seleccionadas
  const [batch,      setBatch]      = useState({ loading: false, resultado: null })

  const cargar = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('solicitud_credito')
      .select(`
        id_solicitud, monto_solicitado, plazo_meses, fecha_solicitud, proposito,
        estado_solicitud ( nombre ),
        cliente ( nombre_completo, dni, telefono, score_credito ),
        score ( puntaje_total, porcentaje, recomendacion )
      `)
      .order('fecha_solicitud', { ascending: false })
    setTodas(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  // Limpiar selección al cambiar de tab
  useEffect(() => { setSelected(new Set()); setBatch({ loading: false, resultado: null }) }, [filtro])

  const solicitudes = filtro === 'TODOS'
    ? todas
    : todas.filter(s => s.estado_solicitud?.nombre?.toUpperCase() === filtro)

  const conteo = (estado) => todas.filter(s => s.estado_solicitud?.nombre?.toUpperCase() === estado).length
  const esModoAprobada = filtro === 'APROBADA'

  // ── Selección ──────────────────────────────────────────────────
  function toggleSeleccion(id) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleTodos() {
    if (selected.size === solicitudes.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(solicitudes.map(s => s.id_solicitud)))
    }
  }

  // ── Desembolso masivo ──────────────────────────────────────────
  async function handleDesembolsarLote() {
    if (selected.size === 0) return
    setBatch({ loading: true, resultado: null })
    try {
      const res = await fetch('/api/admin/desembolsar/batch', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ solicitudIds: Array.from(selected) }),
      })
      const data = await res.json()
      setBatch({ loading: false, resultado: data })
      setSelected(new Set())
      // Recargar lista
      await cargar()
    } catch {
      setBatch({ loading: false, resultado: { ok: false, resumen: 'Error de conexión' } })
    }
  }

  return (
    <div className="flex flex-col gap-6 pb-10">
      <header>
        <h1 className="text-3xl font-bold text-white tracking-tight">Solicitudes de Crédito</h1>
        <p className="text-slate-400 mt-1">Revisa, aprueba o rechaza solicitudes de los clientes.</p>
      </header>

      {/* TABS */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map(({ key, label }) => (
          <button key={key}
            onClick={() => setFiltro(key)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              filtro === key
                ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/20'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
            }`}>
            {label}
            {key !== 'TODOS' && conteo(key) > 0 && (
              <span className="ml-2 bg-slate-900/40 text-xs px-1.5 py-0.5 rounded-full">
                {conteo(key)}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* BANNER DE RESULTADO BATCH */}
      {batch.resultado && (
        <div className={`flex items-start gap-3 rounded-xl px-4 py-3 text-sm border ${
          batch.resultado.ok
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
            : 'bg-yellow-500/10 border-yellow-500/20 text-yellow-300'
        }`}>
          {batch.resultado.ok
            ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
          <div className="flex-1">
            <p className="font-semibold">{batch.resultado.resumen}</p>
            {batch.resultado.fallidos?.length > 0 && (
              <p className="text-xs mt-1 opacity-80">
                Fallidos: {batch.resultado.fallidos.map(f => f.razon).join(' · ')}
              </p>
            )}
          </div>
          <button onClick={() => setBatch({ loading: false, resultado: null })}>
            <X className="w-4 h-4 opacity-50 hover:opacity-100" />
          </button>
        </div>
      )}

      {/* BARRA DE ACCIÓN BATCH — solo en tab APROBADA con selección */}
      {esModoAprobada && solicitudes.length > 0 && (
        <div className="flex items-center justify-between gap-4 bg-slate-800 border border-slate-700 rounded-2xl px-5 py-3">
          <button
            onClick={toggleTodos}
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
          >
            {selected.size === solicitudes.length
              ? <CheckSquare className="w-4 h-4 text-indigo-400" />
              : <Square className="w-4 h-4" />}
            {selected.size === solicitudes.length ? 'Deseleccionar todo' : 'Seleccionar todo'}
          </button>

          {selected.size > 0 && (
            <button
              onClick={handleDesembolsarLote}
              disabled={batch.loading}
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold px-5 py-2 rounded-xl text-sm transition-all"
            >
              {batch.loading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Desembolsando…</>
                : <><Send className="w-4 h-4" /> Desembolsar {selected.size} seleccionada{selected.size !== 1 ? 's' : ''}</>
              }
            </button>
          )}

          {selected.size === 0 && (
            <span className="text-slate-500 text-xs">Selecciona solicitudes para desembolsar en lote</span>
          )}
        </div>
      )}

      {/* LISTADO */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      ) : solicitudes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <ClipboardList className="w-12 h-12 text-slate-600 mb-4" />
          <p className="text-slate-400">No hay solicitudes en esta categoría.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {solicitudes.map((sol) => {
            const estadoNombre = sol.estado_solicitud?.nombre?.toUpperCase() ?? 'PENDIENTE'
            const ui           = ESTADO_UI[estadoNombre] ?? ESTADO_UI.PENDIENTE
            const IconEstado   = ui.icon
            const score        = sol.score?.[0]
            const fecha        = new Date(sol.fecha_solicitud).toLocaleDateString('es-CO', {
              day: '2-digit', month: 'short', year: 'numeric',
            })
            const isChecked = selected.has(sol.id_solicitud)

            return (
              <div key={sol.id_solicitud} className={`flex items-center gap-3 bg-slate-800 border rounded-2xl p-5 transition-all ${
                esModoAprobada
                  ? isChecked
                    ? 'border-emerald-500/50 ring-1 ring-emerald-500/30'
                    : 'border-slate-700 hover:border-slate-600'
                  : 'border-slate-700'
              }`}>
                {/* Checkbox — solo en tab APROBADA */}
                {esModoAprobada && (
                  <button
                    onClick={() => toggleSeleccion(sol.id_solicitud)}
                    className="shrink-0 p-0.5 text-slate-500 hover:text-emerald-400 transition-colors"
                  >
                    {isChecked
                      ? <CheckSquare className="w-5 h-5 text-emerald-400" />
                      : <Square className="w-5 h-5" />}
                  </button>
                )}

                {/* Contenido — clic navega al detalle */}
                <Link
                  href={`/supervisor/solicitudes/${sol.id_solicitud}`}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 flex-1 min-w-0"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-slate-700 rounded-xl flex items-center justify-center text-slate-300 font-bold text-sm shrink-0">
                      {sol.cliente?.nombre_completo?.charAt(0)?.toUpperCase() ?? 'C'}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-200 truncate">{sol.cliente?.nombre_completo}</p>
                      <p className="text-slate-500 text-xs">CC {sol.cliente?.dni} · {sol.cliente?.telefono}</p>
                      <p className="text-slate-400 text-sm mt-1">{formatCOP(sol.monto_solicitado)} · {sol.plazo_meses} meses</p>
                      {sol.proposito && (
                        <p className="text-slate-500 text-xs mt-0.5 line-clamp-1">{sol.proposito}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    {score && (
                      <div className="text-center">
                        <p className={`text-lg font-extrabold ${
                          score.recomendacion === 'APROBAR'        ? 'text-emerald-400' :
                          score.recomendacion === 'REVISAR_MANUAL' ? 'text-yellow-400'  : 'text-red-400'
                        }`}>{score.puntaje_total}</p>
                        <p className="text-slate-500 text-xs">score</p>
                      </div>
                    )}
                    <div className="text-right">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${ui.color}`}>
                        <IconEstado className="w-3 h-3" />{ui.label}
                      </span>
                      <p className="text-slate-500 text-xs mt-1">{fecha}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-600" />
                  </div>
                </Link>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
