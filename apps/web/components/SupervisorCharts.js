'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import {
  TrendingUp, AlertTriangle, Users, DollarSign,
  CheckCircle2, ShieldAlert, ArrowRight, RefreshCw,
  BarChart3, Activity, TrendingDown, Filter,
} from 'lucide-react'

// ── Helpers ──────────────────────────────────────────────────────────────────
const COP = (v) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v ?? 0)
const NUM = (v) => (v ?? 0).toLocaleString('es-CO')

// Tooltip personalizado
function TooltipCOP({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl p-3 shadow-xl text-xs">
      <p className="text-slate-400 font-semibold mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-300">{p.name}:</span>
          <span className="font-bold" style={{ color: p.color }}>
            {typeof p.value === 'number' && p.value > 10000 ? COP(p.value) : NUM(p.value)}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function SupervisorCharts() {
  const [data,       setData]       = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [meses,      setMeses]      = useState(12)
  const [graficaActiva, setGrafica] = useState('cartera') // cartera | desembolsos | recaudo | solicitudes | mora

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/supervisor/dashboard-data?meses=${meses}`)
      const json = await res.json()
      setData(json)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [meses])

  useEffect(() => { cargar() }, [cargar])

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center py-24 gap-3 text-slate-400">
        <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
        Cargando datos del panel…
      </div>
    )
  }

  const { serie, kpis, tramos } = data
  const totalActivos = kpis.creditosActivos + kpis.creditosMora

  // KPI cards
  const kpiCards = [
    { label: 'Solicitudes por revisar', value: NUM(kpis.totalClientes),    icon: Users,         color: 'text-blue-400 bg-blue-500/10',      href: '/supervisor/solicitudes' },
    { label: 'Créditos activos',        value: NUM(kpis.creditosActivos),  icon: TrendingUp,    color: 'text-emerald-400 bg-emerald-500/10', href: '/supervisor/cartera'     },
    { label: 'Créditos en mora',        value: NUM(kpis.creditosMora),     icon: AlertTriangle, color: 'text-red-400 bg-red-500/10',         href: '/supervisor/mora'        },
    { label: 'Cuotas vencidas',         value: NUM(kpis.cuotasVencidas),   icon: ShieldAlert,   color: 'text-orange-400 bg-orange-500/10',   href: '/supervisor/mora'        },
    { label: 'Cartera activa',          value: COP(kpis.carteraSaldo),     icon: DollarSign,    color: 'text-indigo-400 bg-indigo-500/10',   href: '/supervisor/cartera'     },
    { label: 'Indicador de mora',       value: `${kpis.indicadorMora}%`,   icon: TrendingDown,  color: parseFloat(kpis.indicadorMora) > 5 ? 'text-red-400 bg-red-500/10' : 'text-emerald-400 bg-emerald-500/10', href: '/supervisor/mora' },
  ]

  // Tabs de gráficas
  const tabs = [
    { key: 'cartera',      label: 'Cartera',      icon: Activity   },
    { key: 'desembolsos',  label: 'Desembolsos',  icon: TrendingUp },
    { key: 'recaudo',      label: 'Recaudo',      icon: CheckCircle2 },
    { key: 'solicitudes',  label: 'Solicitudes',  icon: BarChart3  },
    { key: 'mora',         label: 'Mora',         icon: AlertTriangle },
  ]

  return (
    <div className="flex flex-col gap-6">

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {kpiCards.map(({ label, value, icon: Icon, color, href }) => (
          <Link key={label} href={href}
            className="bg-slate-800 border border-slate-700 rounded-2xl p-5 hover:border-indigo-600/50 transition-colors">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${color}`}>
              <Icon className="w-5 h-5" />
            </div>
            <p className="text-2xl font-extrabold text-white">{value}</p>
            <p className="text-slate-400 text-sm mt-0.5">{label}</p>
          </Link>
        ))}
      </div>

      {/* ── Cartera + Mora ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Cartera activa */}
        <div className="bg-gradient-to-br from-blue-700 to-blue-900 rounded-2xl p-6 text-white shadow-xl">
          <p className="text-blue-200 text-xs font-semibold uppercase tracking-wide mb-1">Cartera activa total</p>
          <p className="text-4xl font-extrabold">{COP(kpis.carteraSaldo)}</p>
          <p className="text-blue-300 text-sm mt-1">Total desembolsado: {COP(kpis.totalDesembolsado)}</p>
          <div className="mt-3 flex items-center gap-3 text-xs text-blue-200">
            <span>{kpis.creditosActivos} activos</span>
            <span>·</span>
            <span className="text-red-300">{kpis.creditosMora} en mora</span>
          </div>
        </div>
        {/* Indicador mora */}
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-2">Indicador de mora</p>
          <p className={`text-4xl font-extrabold ${parseFloat(kpis.indicadorMora) > 5 ? 'text-red-400' : 'text-emerald-400'}`}>
            {kpis.indicadorMora}%
          </p>
          <div className="w-full bg-slate-700 rounded-full h-2.5 mt-3">
            <div className={`h-2.5 rounded-full transition-all ${parseFloat(kpis.indicadorMora) > 5 ? 'bg-red-500' : 'bg-emerald-500'}`}
              style={{ width: `${Math.min(100, parseFloat(kpis.indicadorMora) * 5)}%` }} />
          </div>
          <p className="text-slate-500 text-xs mt-2">
            Referencia sana: &lt; 5% · {kpis.creditosMora} de {totalActivos} créditos en mora
          </p>
        </div>
      </div>

      {/* ── Panel de gráficas interactivo ── */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden">
        {/* Header con filtros */}
        <div className="px-6 py-4 border-b border-slate-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h2 className="font-semibold text-white flex items-center gap-2">
            <Activity className="w-4 h-4 text-indigo-400" /> Análisis histórico
          </h2>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Selector de período */}
            <div className="flex items-center gap-1 bg-slate-700 rounded-xl p-1">
              {[3, 6, 12].map(m => (
                <button key={m} onClick={() => setMeses(m)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    meses === m ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}>
                  {m}m
                </button>
              ))}
            </div>
            {/* Selector de gráfica */}
            <div className="flex items-center gap-1 bg-slate-700 rounded-xl p-1">
              {tabs.map(({ key, label, icon: Icon }) => (
                <button key={key} onClick={() => setGrafica(key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    graficaActiva === key ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}>
                  <Icon className="w-3 h-3" />{label}
                </button>
              ))}
            </div>
            <button onClick={cargar}
              className="p-2 bg-slate-700 hover:bg-slate-600 rounded-xl text-slate-400 hover:text-slate-200 transition-all">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Gráfica */}
        <div className="p-6">
          <ResponsiveContainer width="100%" height={320}>
            {graficaActiva === 'cartera' ? (
              <AreaChart data={serie} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradCartera" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="gradDesemb" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => `$${(v/1000000).toFixed(1)}M`} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<TooltipCOP />} />
                <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 12 }} />
                <Area type="monotone" dataKey="carteraAcumulada" name="Cartera acumulada" stroke="#6366f1" fill="url(#gradCartera)" strokeWidth={2.5} dot={false} activeDot={{ r: 5, fill: '#6366f1' }} />
                <Area type="monotone" dataKey="desembolsado" name="Desembolsado" stroke="#10b981" fill="url(#gradDesemb)" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#10b981' }} />
              </AreaChart>
            ) : graficaActiva === 'desembolsos' ? (
              <BarChart data={serie} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => `$${(v/1000000).toFixed(1)}M`} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<TooltipCOP />} />
                <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 12 }} />
                <Bar dataKey="desembolsado" name="Desembolsado" fill="#6366f1" radius={[4,4,0,0]} />
                <Bar dataKey="recaudado"    name="Recaudado"    fill="#10b981" radius={[4,4,0,0]} />
              </BarChart>
            ) : graficaActiva === 'recaudo' ? (
              <AreaChart data={serie} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradRecaudo" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#10b981" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => `$${(v/1000000).toFixed(1)}M`} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<TooltipCOP />} />
                <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 12 }} />
                <Area type="monotone" dataKey="recaudado" name="Recaudado" stroke="#10b981" fill="url(#gradRecaudo)" strokeWidth={2.5} dot={{ r: 3, fill: '#10b981' }} activeDot={{ r: 6 }} />
                <Area type="monotone" dataKey="desembolsado" name="Desembolsado" stroke="#6366f1" fill="none" strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
              </AreaChart>
            ) : graficaActiva === 'solicitudes' ? (
              <BarChart data={serie} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<TooltipCOP />} />
                <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 12 }} />
                <Bar dataKey="solicitudes" name="Total solicitudes" fill="#6366f1" radius={[4,4,0,0]} />
                <Bar dataKey="aprobadas"   name="Aprobadas"         fill="#10b981" radius={[4,4,0,0]} />
                <Bar dataKey="rechazadas"  name="Rechazadas"        fill="#ef4444" radius={[4,4,0,0]} />
              </BarChart>
            ) : (
              /* Mora — gráfica de línea con área */
              <AreaChart data={serie} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradMora" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<TooltipCOP />} />
                <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 12 }} />
                <ReferenceLine y={0} stroke="#334155" />
                <Area type="monotone" dataKey="enMora"         name="Créditos en mora"  stroke="#ef4444" fill="url(#gradMora)" strokeWidth={2.5} dot={{ r: 3, fill: '#ef4444' }} activeDot={{ r: 6 }} />
                <Area type="monotone" dataKey="creditosNuevos" name="Créditos nuevos"   stroke="#6366f1" fill="none" strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Gráfica de tramos de mora ── */}
      {kpis.creditosMora > 0 && (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
          <h2 className="font-semibold text-slate-300 mb-5 flex items-center gap-2 text-sm">
            <BarChart3 className="w-4 h-4 text-red-400" /> Distribución de mora por tramos
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Barras horizontales */}
            <div className="flex flex-col gap-4">
              {tramos.map((t) => {
                const maxMonto = Math.max(...tramos.map(x => x.monto), 1)
                const pct = Math.max(t.count > 0 ? 6 : 0, (t.monto / maxMonto) * 100)
                const color = t.label === '1-30d' ? 'bg-yellow-500' : t.label === '31-60d' ? 'bg-orange-500' : t.label === '61-90d' ? 'bg-red-500' : 'bg-red-900'
                const textColor = t.label === '1-30d' ? 'text-yellow-400' : t.label === '31-60d' ? 'text-orange-400' : 'text-red-400'
                return (
                  <div key={t.label} className="flex items-center gap-3">
                    <span className="text-slate-400 text-xs w-14 shrink-0 font-mono">{t.label}</span>
                    <div className="flex-1 bg-slate-700 rounded-full h-6 overflow-hidden">
                      <div className={`${color} h-6 rounded-full flex items-center justify-end pr-2 transition-all duration-700`}
                        style={{ width: `${pct}%` }}>
                        {t.count > 0 && <span className="text-white text-xs font-bold">{t.count}</span>}
                      </div>
                    </div>
                    <span className={`text-xs font-bold w-28 text-right ${textColor}`}>{COP(t.monto)}</span>
                  </div>
                )
              })}
            </div>
            {/* Mini gráfica de dona (CSS) */}
            <div className="flex flex-col gap-3">
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={tramos} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                  <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}`} />
                  <YAxis type="category" dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} width={45} />
                  <Tooltip content={<TooltipCOP />} />
                  <Bar dataKey="count" name="Créditos" radius={[0,4,4,0]}
                    fill="#ef4444"
                    label={{ position: 'right', fill: '#94a3b8', fontSize: 11 }}
                  />
                </BarChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 gap-2">
                {tramos.map(t => (
                  <div key={t.label} className="bg-slate-700/50 rounded-xl p-3 text-center">
                    <p className="text-lg font-extrabold text-red-400">{t.count}</p>
                    <p className="text-slate-500 text-xs">{t.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Solicitudes recientes + Mora crítica ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-700 flex items-center justify-between">
            <h2 className="font-semibold text-white text-sm">📋 Solicitudes recientes</h2>
            <Link href="/supervisor/solicitudes" className="text-indigo-400 text-xs font-medium flex items-center gap-1 hover:text-indigo-300">
              Ver todas <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <SolicitudesRecientes />
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-700 flex items-center justify-between">
            <h2 className="font-semibold text-white text-sm">🔴 Mora crítica</h2>
            <Link href="/supervisor/mora" className="text-indigo-400 text-xs font-medium flex items-center gap-1 hover:text-indigo-300">
              Ver todas <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <MoraCritica />
        </div>
      </div>
    </div>
  )
}

// ── Sub-componentes que cargan sus propios datos ──────────────────────────────
function SolicitudesRecientes() {
  const [items, setItems] = useState([])
  useEffect(() => {
    fetch('/api/supervisor/solicitudes-recientes').then(r => r.json()).then(d => setItems(d.items ?? []))
  }, [])
  if (!items.length) return <p className="text-center text-slate-500 py-8 text-sm">Sin solicitudes.</p>
  return (
    <div className="divide-y divide-slate-700/50">
      {items.map(s => {
        const estado = s.estado?.toUpperCase()
        const color = estado === 'APROBADA' ? 'bg-emerald-500/10 text-emerald-400' : estado === 'RECHAZADA' ? 'bg-red-500/10 text-red-400' : estado === 'DESEMBOLSADA' ? 'bg-green-500/10 text-green-400' : 'bg-yellow-500/10 text-yellow-400'
        return (
          <Link key={s.id} href={`/supervisor/solicitudes/${s.id}`}
            className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-700/40 transition-colors">
            <div>
              <p className="font-semibold text-slate-200 text-sm">{s.nombre}</p>
              <p className="text-slate-500 text-xs">{COP(s.monto)} · {s.plazo}m</p>
            </div>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${color}`}>{estado}</span>
          </Link>
        )
      })}
    </div>
  )
}

function MoraCritica() {
  const [items, setItems] = useState([])
  useEffect(() => {
    fetch('/api/supervisor/mora-critica').then(r => r.json()).then(d => setItems(d.items ?? []))
  }, [])
  if (!items.length) return <p className="text-center text-slate-500 py-8 text-sm">Sin créditos en mora. ✓</p>
  return (
    <div className="divide-y divide-slate-700/50">
      {items.map(c => (
        <div key={c.id} className="flex items-center justify-between px-5 py-3.5">
          <div>
            <p className="font-semibold text-slate-200 text-sm">{c.nombre}</p>
            <p className="text-slate-500 text-xs">{c.telefono} · {COP(c.saldo)}</p>
          </div>
          <div className="text-right">
            <p className={`font-bold text-sm ${c.dias > 60 ? 'text-red-400' : 'text-orange-400'}`}>{c.dias}d</p>
            <p className="text-slate-500 text-xs">{c.cuotas} cuota{c.cuotas !== 1 ? 's' : ''}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
