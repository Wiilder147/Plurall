'use client'

/* ==========================================================================
 * ARCHIVO: page.js
 * RUTA: apps/web/app/supervisor/funnel/page.js
 * DESCRIPCIÓN: Vista del panel para el rol de supervisor.
 * FUNCIONALIDAD: Este archivo define la lógica y estructura para su respectivo módulo.
 * ========================================================================== */

import { useState, useEffect } from 'react'
import { BarChart2, Users, TrendingDown, RefreshCw, Loader2 } from 'lucide-react'

// Orden oficial del embudo
const PASOS_CONFIG = [
  { key: 'INICIO_CALCULADORA',    label: 'Ingresaron al cotizador',    color: 'bg-indigo-500'  },
  { key: 'INICIO_CUESTIONARIO',   label: 'Avanzaron al cuestionario',  color: 'bg-blue-500'    },
  { key: 'COMPLETO_CUESTIONARIO', label: 'Completaron cuestionario',   color: 'bg-cyan-500'    },
  { key: 'INICIO_DOCUMENTOS',     label: 'Llegaron a documentos',      color: 'bg-teal-500'    },
  { key: 'SUBIO_CEDULA_FRONTAL',  label: 'Subieron cédula frontal',    color: 'bg-emerald-500' },
  { key: 'SUBIO_CEDULA_TRASERA',  label: 'Subieron cédula trasera',    color: 'bg-green-500'   },
  { key: 'INICIO_RESUMEN',        label: 'Llegaron al resumen final',  color: 'bg-lime-500'    },
  { key: 'ENVIO_SOLICITUD',       label: 'Enviaron la solicitud',      color: 'bg-yellow-500'  },
  { key: 'SOLICITUD_APROBADA',    label: '→ Pre-aprobadas',            color: 'bg-emerald-400' },
  { key: 'SOLICITUD_REVISION',    label: '→ En revisión manual',       color: 'bg-orange-400'  },
  { key: 'SOLICITUD_RECHAZADA',   label: '→ Rechazadas por score',     color: 'bg-red-500'     },
]

export default function SupervisorFunnelPage() {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  async function cargar() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/eventos/funnel')
      if (!res.ok) throw new Error('Error al cargar datos del embudo')
      setData(await res.json())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargar() }, [])

  const paso = (key) => data?.pasos?.find(p => p.evento === key) ?? { cantidad: 0 }
  const top   = paso('INICIO_CALCULADORA').cantidad || 1 // divisor para porcentaje

  return (
    <div className="flex flex-col gap-8 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Embudo de Conversión</h1>
          <p className="text-slate-400 mt-1">
            Seguimiento paso a paso de los clientes en el flujo de solicitud.
          </p>
        </div>
        <button
          onClick={cargar}
          disabled={loading}
          className="inline-flex items-center gap-2 bg-slate-800 border border-slate-700 hover:border-indigo-500/50 text-slate-400 hover:text-slate-200 px-4 py-2.5 rounded-xl text-sm transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {loading && (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {data && !loading && (
        <>
          {/* KPIs superiores */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                icon: Users,
                label: 'Entraron al cotizador',
                value: paso('INICIO_CALCULADORA').cantidad,
                color: 'text-indigo-400',
                bg:    'bg-indigo-500/10',
              },
              {
                icon: BarChart2,
                label: 'Enviaron solicitud',
                value: paso('ENVIO_SOLICITUD').cantidad,
                color: 'text-emerald-400',
                bg:    'bg-emerald-500/10',
                extra: top > 1
                  ? `${Math.round((paso('ENVIO_SOLICITUD').cantidad / top) * 100)}% de conversión`
                  : '—',
              },
              {
                icon: TrendingDown,
                label: 'Bloqueados (crédito activo o cooldown)',
                value: (data.bloqueados?.credito_activo ?? 0) + (data.bloqueados?.cooldown_90 ?? 0),
                color: 'text-red-400',
                bg:    'bg-red-500/10',
              },
            ].map(({ icon: Icon, label, value, color, bg, extra }) => (
              <div key={label} className={`${bg} border border-slate-700/50 rounded-2xl p-5 flex flex-col gap-2`}>
                <div className="flex items-center gap-2">
                  <Icon className={`w-4 h-4 ${color}`} />
                  <p className="text-slate-400 text-xs font-medium">{label}</p>
                </div>
                <p className={`text-3xl font-extrabold ${color}`}>{value.toLocaleString('es-CO')}</p>
                {extra && <p className="text-slate-500 text-xs">{extra}</p>}
              </div>
            ))}
          </div>

          {/* Embudo visual */}
          <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-700">
              <h2 className="font-semibold text-slate-300 text-sm flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-indigo-400" />
                Pasos del Embudo
              </h2>
            </div>

            <div className="p-6 flex flex-col gap-5">
              {PASOS_CONFIG.map(({ key, label, color }, idx) => {
                const cantidad = paso(key).cantidad
                const pct      = top > 0 ? Math.round((cantidad / top) * 100) : 0
                const prevKey  = idx > 0 ? PASOS_CONFIG[idx - 1].key : null
                const prevCant = prevKey ? paso(prevKey).cantidad : top
                const perdidos = prevCant - cantidad

                return (
                  <div key={key}>
                    {/* Indicador de abandono entre pasos */}
                    {idx > 0 && idx < 8 && perdidos > 0 && (
                      <div className="flex items-center gap-2 text-xs text-red-400/70 mb-3 pl-2">
                        <TrendingDown className="w-3 h-3" />
                        {perdidos} se fueron en este paso
                        {prevCant > 0 && (
                          <span className="text-slate-600">
                            ({Math.round((perdidos / prevCant) * 100)}% abandono)
                          </span>
                        )}
                      </div>
                    )}
                    {/* Separador visual antes de resultados finales */}
                    {idx === 8 && (
                      <div className="border-t border-slate-700/50 pt-4 mt-1 mb-3">
                        <p className="text-slate-500 text-xs font-medium">Resultados del motor de decisión</p>
                      </div>
                    )}

                    <div className="flex items-center gap-4">
                      <div className="w-36 text-right shrink-0">
                        <p className="text-white font-bold text-lg">{cantidad.toLocaleString('es-CO')}</p>
                        <p className="text-slate-500 text-xs">{pct}%</p>
                      </div>
                      <div className="flex-1">
                        <p className="text-slate-400 text-xs mb-1.5">{label}</p>
                        <div className="w-full bg-slate-700 rounded-full h-3 overflow-hidden">
                          <div
                            className={`h-3 rounded-full ${color} transition-all duration-700`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Tabla de bloqueados */}
          {((data.bloqueados?.credito_activo ?? 0) > 0 || (data.bloqueados?.cooldown_90 ?? 0) > 0) && (
            <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-700">
                <h2 className="font-semibold text-slate-300 text-sm">Clientes Bloqueados (no pueden solicitar)</h2>
              </div>
              <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-orange-500/5 border border-orange-500/20 rounded-xl p-4">
                  <p className="text-orange-400 font-bold text-2xl">{data.bloqueados.credito_activo ?? 0}</p>
                  <p className="text-slate-400 text-sm mt-1">Con crédito activo vigente</p>
                  <p className="text-slate-500 text-xs mt-0.5">Deben finalizar pagos antes de solicitar</p>
                </div>
                <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-4">
                  <p className="text-yellow-400 font-bold text-2xl">{data.bloqueados.cooldown_90 ?? 0}</p>
                  <p className="text-slate-400 text-sm mt-1">En período de espera (90 días)</p>
                  <p className="text-slate-500 text-xs mt-0.5">Restricción trimestral activa</p>
                </div>
              </div>
            </div>
          )}

          {data.total === 0 && (
            <div className="text-center py-12 text-slate-500">
              <BarChart2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Aún no hay eventos registrados.</p>
              <p className="text-xs mt-1">Los datos aparecerán cuando los clientes naveguen el flujo de solicitud.</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
