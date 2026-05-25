/* ==========================================================================
 * ARCHIVO: SupervisorCharts.js
 * RUTA: apps/web/components/SupervisorCharts.js
 * DESCRIPCIÓN: Componente de interfaz de usuario (UI) reutilizable.
 * FUNCIONALIDAD: Este archivo define la lógica y estructura para su respectivo módulo.
 * ========================================================================== */

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import {
  TrendingUp, AlertTriangle, Users, DollarSign,
  CheckCircle2, ShieldAlert, ArrowRight, RefreshCw,
  BarChart3, Activity, TrendingDown, Calendar,
  ChevronLeft, ChevronRight, X, Filter,
} from 'lucide-react'

// ── Helpers ──────────────────────────────────────────────────────────────────
const COP = (v) => new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP',
  minimumFractionDigits: 0, maximumFractionDigits: 0,
}).format(v ?? 0)
const NUM = (v) => (v ?? 0).toLocaleString('es-CO')
const ISO = (d) => d.toISOString().slice(0, 10)

function TooltipCOP({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl p-3 shadow-xl text-xs min-w-[160px]">
      <p className="text-slate-400 font-semibold mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
          <span className="text-slate-300 truncate">{p.name}:</span>
          <span className="font-bold ml-auto" style={{ color: p.color }}>
            {typeof p.value === 'number' && p.value > 10000 ? COP(p.value) : NUM(p.value)}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Componente de calendario para selección de rango ─────────────────────────
function DateRangePicker({ desde, hasta, onChange, onClose }) {
  const hoy = new Date()
  const [viewYear,  setViewYear]  = useState(hoy.getFullYear())
  const [viewMonth, setViewMonth] = useState(hoy.getMonth())
  const [selecting, setSelecting] = useState('desde') // 'desde' | 'hasta'
  const [tempDesde, setTempDesde] = useState(desde)
  const [tempHasta, setTempHasta] = useState(hasta)

  const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
  const DIAS  = ['Do','Lu','Ma','Mi','Ju','Vi','Sa']

  function getDaysInMonth(y, m) {
    return new Date(y, m + 1, 0).getDate()
  }
  function getFirstDayOfMonth(y, m) {
    return new Date(y, m, 1).getDay()
  }

  function handleDayClick(day) {
    const d = ISO(new Date(viewYear, viewMonth, day))
    if (selecting === 'desde') {
      setTempDesde(d)
      setTempHasta(d)
      setSelecting('hasta')
    } else {
      if (d < tempDesde) {
        setTempHasta(tempDesde)
        setTempDesde(d)
      } else {
        setTempHasta(d)
      }
      setSelecting('desde')
    }
  }

  function isInRange(day) {
    const d = ISO(new Date(viewYear, viewMonth, day))
    return d >= tempDesde && d <= tempHasta
  }
  function isStart(day) { return ISO(new Date(viewYear, viewMonth, day)) === tempDesde }
  function isEnd(day)   { return ISO(new Date(viewYear, viewMonth, day)) === tempHasta }

  const totalDays   = getDaysInMonth(viewYear, viewMonth)
  const firstDay    = getFirstDayOfMonth(viewYear, viewMonth)
  const cells       = Array.from({ length: firstDay + totalDays }, (_, i) => i < firstDay ? null : i - firstDay + 1)

  // Atajos rápidos
  const shortcuts = [
    { label: 'Hoy',         fn: () => { const d = ISO(hoy); setTempDesde(d); setTempHasta(d) } },
    { label: 'Esta semana', fn: () => {
      const lun = new Date(hoy); lun.setDate(hoy.getDate() - hoy.getDay() + 1)
      setTempDesde(ISO(lun)); setTempHasta(ISO(hoy))
    }},
    { label: 'Este mes',    fn: () => {
      setTempDesde(ISO(new Date(hoy.getFullYear(), hoy.getMonth(), 1)))
      setTempHasta(ISO(hoy))
    }},
    { label: 'Último mes',  fn: () => {
      const ini = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)
      const fin = new Date(hoy.getFullYear(), hoy.getMonth(), 0)
      setTempDesde(ISO(ini)); setTempHasta(ISO(fin))
    }},
    { label: 'Últ. 3 meses',fn: () => {
      const ini = new Date(hoy); ini.setMonth(ini.getMonth() - 3)
      setTempDesde(ISO(ini)); setTempHasta(ISO(hoy))
    }},
    { label: 'Últ. 6 meses',fn: () => {
      const ini = new Date(hoy); ini.setMonth(ini.getMonth() - 6)
      setTempDesde(ISO(ini)); setTempHasta(ISO(hoy))
    }},
    { label: 'Este año',    fn: () => {
      setTempDesde(`${hoy.getFullYear()}-01-01`)
      setTempHasta(ISO(hoy))
    }},
    { label: 'Año pasado',  fn: () => {
      const y = hoy.getFullYear() - 1
      setTempDesde(`${y}-01-01`); setTempHasta(`${y}-12-31`)
    }},
  ]

  return (
    <div className="absolute top-full right-0 mt-2 z-50 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl shadow-black/40 flex overflow-hidden"
      style={{ minWidth: 520 }}>

      {/* Atajos */}
      <div className="w-36 border-r border-slate-700 p-3 flex flex-col gap-1">
        <p className="text-slate-500 text-xs font-semibold uppercase tracking-wide mb-2 px-1">Atajos</p>
        {shortcuts.map(s => (
          <button key={s.label} onClick={s.fn}
            className="text-left text-xs text-slate-400 hover:text-white hover:bg-slate-700 px-3 py-2 rounded-lg transition-all">
            {s.label}
          </button>
        ))}
      </div>

      {/* Calendario */}
      <div className="flex-1 p-4">
        {/* Navegación mes */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y-1) } else setViewMonth(m => m-1) }}
            className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-all">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-white font-semibold text-sm">
            {MESES[viewMonth]} {viewYear}
          </span>
          <button onClick={() => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y+1) } else setViewMonth(m => m+1) }}
            className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-all">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Días de la semana */}
        <div className="grid grid-cols-7 mb-2">
          {DIAS.map(d => (
            <div key={d} className="text-center text-slate-500 text-xs font-semibold py-1">{d}</div>
          ))}
        </div>

        {/* Celdas del mes */}
        <div className="grid grid-cols-7 gap-0.5">
          {cells.map((day, idx) => {
            if (!day) return <div key={idx} />
            const inRange = isInRange(day)
            const start   = isStart(day)
            const end     = isEnd(day)
            return (
              <button key={idx} onClick={() => handleDayClick(day)}
                className={`
                  h-8 w-full text-xs font-medium rounded-lg transition-all
                  ${start || end ? 'bg-indigo-500 text-white font-bold' :
                    inRange ? 'bg-indigo-500/20 text-indigo-300' :
                    'text-slate-300 hover:bg-slate-700 hover:text-white'}
                `}>
                {day}
              </button>
            )
          })}
        </div>

        {/* Rango seleccionado + botones */}
        <div className="mt-4 pt-4 border-t border-slate-700">
          <div className="flex items-center gap-2 mb-3">
            <div className={`flex-1 bg-slate-800 border rounded-xl px-3 py-2 text-xs ${selecting === 'desde' ? 'border-indigo-500' : 'border-slate-700'}`}>
              <p className="text-slate-500 text-xs mb-0.5">Desde</p>
              <p className="text-white font-semibold">{tempDesde || '—'}</p>
            </div>
            <span className="text-slate-600">→</span>
            <div className={`flex-1 bg-slate-800 border rounded-xl px-3 py-2 text-xs ${selecting === 'hasta' ? 'border-indigo-500' : 'border-slate-700'}`}>
              <p className="text-slate-500 text-xs mb-0.5">Hasta</p>
              <p className="text-white font-semibold">{tempHasta || '—'}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={onClose}
              className="flex-1 py-2 rounded-xl text-sm text-slate-400 hover:bg-slate-700 transition-all border border-slate-700">
              Cancelar
            </button>
            <button
              onClick={() => { onChange(tempDesde, tempHasta); onClose() }}
              disabled={!tempDesde || !tempHasta}
              className="flex-1 py-2 rounded-xl text-sm bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white font-semibold transition-all">
              Aplicar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function SupervisorCharts() {
  const hoy = new Date()
  const hace12 = new Date(hoy); hace12.setMonth(hace12.getMonth() - 12)

  const [data,          setData]          = useState(null)
  const [loading,       setLoading]       = useState(true)
  const [graficaActiva, setGrafica]       = useState('cartera')
  const [agrupacion,    setAgrupacion]    = useState('mes')
  const [showCalendar,  setShowCalendar]  = useState(false)
  const [modoFecha,     setModoFecha]     = useState('meses') // 'meses' | 'rango'
  const [meses,         setMeses]         = useState(12)
  const [desde,         setDesde]         = useState(ISO(hace12))
  const [hasta,         setHasta]         = useState(ISO(hoy))
  const calRef = useRef(null)

  // Cerrar calendario al hacer click fuera
  useEffect(() => {
    function handleClick(e) {
      if (calRef.current && !calRef.current.contains(e.target)) setShowCalendar(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      let url
      if (modoFecha === 'rango') {
        url = `/api/supervisor/dashboard-data?desde=${desde}&hasta=${hasta}&agrupacion=${agrupacion}`
      } else {
        url = `/api/supervisor/dashboard-data?meses=${meses}&agrupacion=${agrupacion}`
      }
      const res  = await fetch(url)
      const json = await res.json()
      setData(json)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [meses, desde, hasta, agrupacion, modoFecha])

  useEffect(() => { cargar() }, [cargar])

  function handleRangoChange(d, h) {
    setDesde(d); setHasta(h); setModoFecha('rango')
  }

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

  const kpiCards = [
    { label: 'Clientes registrados', value: NUM(kpis.totalClientes),   icon: Users,         color: 'text-blue-400 bg-blue-500/10',       href: '/supervisor/clientes'    },
    { label: 'Créditos activos',     value: NUM(kpis.creditosActivos), icon: TrendingUp,    color: 'text-emerald-400 bg-emerald-500/10', href: '/supervisor/cartera'     },
    { label: 'Créditos en mora',     value: NUM(kpis.creditosMora),    icon: AlertTriangle, color: 'text-red-400 bg-red-500/10',         href: '/supervisor/mora'        },
    { label: 'Cuotas vencidas',      value: NUM(kpis.cuotasVencidas),  icon: ShieldAlert,   color: 'text-orange-400 bg-orange-500/10',   href: '/supervisor/mora'        },
    { label: 'Cartera activa',       value: COP(kpis.carteraSaldo),    icon: DollarSign,    color: 'text-indigo-400 bg-indigo-500/10',   href: '/supervisor/cartera'     },
    { label: 'Indicador de mora',    value: `${kpis.indicadorMora}%`,  icon: TrendingDown,
      color: parseFloat(kpis.indicadorMora) > 5 ? 'text-red-400 bg-red-500/10' : 'text-emerald-400 bg-emerald-500/10',
      href: '/supervisor/mora' },
  ]

  const tabs = [
    { key: 'cartera',     label: 'Cartera',     icon: Activity    },
    { key: 'desembolsos', label: 'Desembolsos', icon: TrendingUp  },
    { key: 'recaudo',     label: 'Recaudo',     icon: CheckCircle2},
    { key: 'solicitudes', label: 'Solicitudes', icon: BarChart3   },
    { key: 'mora',        label: 'Mora',        icon: AlertTriangle},
  ]

  const labelFiltro = modoFecha === 'rango'
    ? `${desde} → ${hasta}`
    : `Últimos ${meses} meses`

  return (
    <div className="flex flex-col gap-6">

      {/* KPI Cards */}
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

      {/* Cartera + Mora */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-blue-100 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 rounded-2xl p-6">
          <p className="text-orange-500 text-xs font-semibold uppercase tracking-wide mb-1">Cartera activa total</p>
          <p className="text-4xl font-extrabold text-slate-900 dark:text-white">{COP(kpis.carteraSaldo)}</p>
          <p className="text-slate-600 dark:text-blue-300 text-sm mt-1">Total desembolsado: {COP(kpis.totalDesembolsado)}</p>
          <div className="mt-3 flex items-center gap-3 text-xs text-slate-500 dark:text-blue-200">
            <span>{kpis.creditosActivos} activos</span>
            <span>·</span>
            <span className="text-red-600 dark:text-red-300">{kpis.creditosMora} en mora</span>
          </div>
        </div>
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

      {/* KPIs del período */}
      {kpis.periodo && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Desembolsado en período', value: COP(kpis.periodo.desembolsado), color: 'text-indigo-600 dark:text-indigo-400',  bg: 'bg-indigo-500/10 border-indigo-500/30' },
            { label: 'Recaudado en período',    value: COP(kpis.periodo.recaudado),    color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' },
            { label: 'Solicitudes en período',  value: NUM(kpis.periodo.solicitudes),  color: 'text-yellow-600 dark:text-yellow-400',   bg: 'bg-yellow-500/10 border-yellow-500/30' },
            { label: 'Créditos en período',     value: NUM(kpis.periodo.creditos),     color: 'text-blue-600 dark:text-blue-400',       bg: 'bg-blue-500/10 border-blue-500/30' },
          ].map(({ label, value, color, bg }) => (
            <div key={label} className={`border rounded-xl p-4 ${bg}`}>
              <p className={`text-xl font-extrabold ${color}`}>{value}</p>
              <p className="text-slate-600 dark:text-slate-400 text-xs mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Panel de gráficas */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden">
        {/* Header con todos los filtros */}
        <div className="px-6 py-4 border-b border-slate-700 flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-400" /> Análisis histórico
              <span className="text-xs text-slate-500 font-normal ml-1">· {labelFiltro}</span>
            </h2>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Agrupación */}
              <div className="flex items-center gap-1 bg-slate-700 rounded-xl p-1">
                {[['dia','Día'],['semana','Sem'],['mes','Mes']].map(([k,l]) => (
                  <button key={k} onClick={() => setAgrupacion(k)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${agrupacion === k ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
                    {l}
                  </button>
                ))}
              </div>
              {/* Período rápido */}
              <div className="flex items-center gap-1 bg-slate-700 rounded-xl p-1">
                {[3,6,12,24].map(m => (
                  <button key={m} onClick={() => { setMeses(m); setModoFecha('meses') }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${modoFecha === 'meses' && meses === m ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
                    {m}m
                  </button>
                ))}
              </div>
              {/* Botón calendario */}
              <div className="relative" ref={calRef}>
                <button onClick={() => setShowCalendar(v => !v)}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                    modoFecha === 'rango'
                      ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
                      : 'bg-slate-700 border-slate-600 text-slate-400 hover:text-slate-200'
                  }`}>
                  <Calendar className="w-3.5 h-3.5" />
                  {modoFecha === 'rango' ? `${desde} → ${hasta}` : 'Rango'}
                  {modoFecha === 'rango' && (
                    <span onClick={(e) => { e.stopPropagation(); setModoFecha('meses') }}
                      className="ml-1 hover:text-red-400 transition-colors">
                      <X className="w-3 h-3" />
                    </span>
                  )}
                </button>
                {showCalendar && (
                  <DateRangePicker
                    desde={desde} hasta={hasta}
                    onChange={handleRangoChange}
                    onClose={() => setShowCalendar(false)}
                  />
                )}
              </div>
              <button onClick={cargar}
                className="p-2 bg-slate-700 hover:bg-slate-600 rounded-xl text-slate-400 hover:text-slate-200 transition-all">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          {/* Tabs de gráfica */}
          <div className="flex gap-1 flex-wrap">
            {tabs.map(({ key, label, icon: Icon }) => (
              <button key={key} onClick={() => setGrafica(key)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                  graficaActiva === key ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/20' : 'bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-slate-200'
                }`}>
                <Icon className="w-3.5 h-3.5" />{label}
              </button>
            ))}
          </div>
        </div>

        {/* Gráfica */}
        <div className="p-6">
          {serie.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500">
              <BarChart3 className="w-12 h-12 mb-3 opacity-40" />
              <p>Sin datos para el período seleccionado.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              {graficaActiva === 'cartera' ? (
                <AreaChart data={serie} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gC" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="gD" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={v => `$${(v/1000000).toFixed(1)}M`} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<TooltipCOP />} />
                  <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 12 }} />
                  <Area type="monotone" dataKey="carteraAcumulada" name="Cartera acumulada" stroke="#6366f1" fill="url(#gC)" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
                  <Area type="monotone" dataKey="desembolsado"     name="Desembolsado"      stroke="#10b981" fill="url(#gD)" strokeWidth={2}   dot={false} activeDot={{ r: 4 }} />
                </AreaChart>
              ) : graficaActiva === 'desembolsos' ? (
                <BarChart data={serie} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={v => `$${(v/1000000).toFixed(1)}M`} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<TooltipCOP />} />
                  <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 12 }} />
                  <Bar dataKey="desembolsado"  name="Desembolsado" fill="#6366f1" radius={[4,4,0,0]} />
                  <Bar dataKey="recaudado"     name="Recaudado"    fill="#10b981" radius={[4,4,0,0]} />
                </BarChart>
              ) : graficaActiva === 'recaudo' ? (
                <AreaChart data={serie} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gR" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#10b981" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={v => `$${(v/1000000).toFixed(1)}M`} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<TooltipCOP />} />
                  <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 12 }} />
                  <Area type="monotone" dataKey="recaudado"    name="Recaudado"    stroke="#10b981" fill="url(#gR)" strokeWidth={2.5} dot={{ r: 3, fill: '#10b981' }} activeDot={{ r: 6 }} />
                  <Area type="monotone" dataKey="desembolsado" name="Desembolsado" stroke="#6366f1" fill="none"     strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
                </AreaChart>
              ) : graficaActiva === 'solicitudes' ? (
                <BarChart data={serie} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<TooltipCOP />} />
                  <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 12 }} />
                  <Bar dataKey="solicitudes" name="Total"      fill="#6366f1" radius={[4,4,0,0]} />
                  <Bar dataKey="aprobadas"   name="Aprobadas"  fill="#10b981" radius={[4,4,0,0]} />
                  <Bar dataKey="rechazadas"  name="Rechazadas" fill="#ef4444" radius={[4,4,0,0]} />
                </BarChart>
              ) : (
                <AreaChart data={serie} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gM" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<TooltipCOP />} />
                  <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 12 }} />
                  <Area type="monotone" dataKey="enMora"         name="En mora"        stroke="#ef4444" fill="url(#gM)" strokeWidth={2.5} dot={{ r: 3, fill: '#ef4444' }} activeDot={{ r: 6 }} />
                  <Area type="monotone" dataKey="creditosNuevos" name="Créditos nuevos" stroke="#6366f1" fill="none"     strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
                </AreaChart>
              )}
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Tramos de mora */}
      {kpis.creditosMora > 0 && (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
          <h2 className="font-semibold text-slate-300 mb-5 flex items-center gap-2 text-sm">
            <BarChart3 className="w-4 h-4 text-red-400" /> Distribución de mora por tramos
          </h2>
          <div className="flex flex-col gap-4">
            {tramos.map((t) => {
              const maxM = Math.max(...tramos.map(x => x.monto), 1)
              const pct  = Math.max(t.count > 0 ? 6 : 0, (t.monto / maxM) * 100)
              const col  = t.label === '1-30d' ? 'bg-yellow-500' : t.label === '31-60d' ? 'bg-orange-500' : t.label === '61-90d' ? 'bg-red-500' : 'bg-red-900'
              const txt  = t.label === '1-30d' ? 'text-yellow-400' : t.label === '31-60d' ? 'text-orange-400' : 'text-red-400'
              return (
                <div key={t.label} className="flex items-center gap-3">
                  <span className="text-slate-400 text-xs w-14 shrink-0 font-mono">{t.label}</span>
                  <div className="flex-1 bg-slate-700 rounded-full h-6 overflow-hidden">
                    <div className={`${col} h-6 rounded-full flex items-center justify-end pr-2 transition-all duration-700`}
                      style={{ width: `${pct}%` }}>
                      {t.count > 0 && <span className="text-white text-xs font-bold">{t.count}</span>}
                    </div>
                  </div>
                  <span className={`text-xs font-bold w-28 text-right ${txt}`}>{COP(t.monto)}</span>
                </div>
              )
            })}
          </div>
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {tramos.map(t => (
              <div key={t.label} className="bg-slate-700/50 rounded-xl p-3 text-center">
                <p className="text-xl font-extrabold text-red-400">{t.count}</p>
                <p className="text-slate-500 text-xs mt-0.5">{t.label}</p>
                <p className="text-slate-400 text-xs">{COP(t.monto)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Solicitudes + Mora crítica */}
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
