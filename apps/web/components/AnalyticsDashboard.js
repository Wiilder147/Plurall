'use client'

/* ==========================================================================
 * ARCHIVO: AnalyticsDashboard.js
 * RUTA: apps/web/components/AnalyticsDashboard.js
 * DESCRIPCIÓN: Panel de analítica con gráficas (recharts) para ADMIN y SUPERVISOR.
 * FUNCIONALIDAD: Carga /api/analitica con filtros de fecha configurables y
 *                renderiza KPIs y múltiples gráficas: solicitudes por estado,
 *                aprobadas vs rechazadas, créditos por asesor, mora por tramos,
 *                créditos por ciudad/departamento y PQR por estado/tipo.
 *                Permite exportar reportes CSV.
 * ========================================================================== */
import { useState, useEffect, useCallback } from 'react'
import {
  PieChart, Pie, Cell, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { Filter, RefreshCw, Download, TrendingUp, AlertTriangle, Users, MessageSquare, CheckCircle2, XCircle, MousePointerClick } from 'lucide-react'
import DrilldownDrawer from './DrilldownDrawer'

const COP = (v) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v ?? 0)

// Paletas
const ESTADO_COLORS = { PENDIENTE: '#eab308', EN_ESTUDIO: '#3b82f6', APROBADA: '#10b981', RECHAZADA: '#ef4444', CANCELADA: '#64748b', DESEMBOLSADA: '#22c55e' }
const MORA_COLORS = ['#fbbf24', '#fb923c', '#f87171', '#dc2626']
const PQR_COLORS = ['#eab308', '#3b82f6', '#10b981', '#64748b']
const BAR_COLORS = ['#6366f1', '#8b5cf6', '#0ea5e9', '#14b8a6', '#f59e0b', '#ec4899', '#22c55e', '#ef4444', '#a855f7', '#06b6d4']

function TooltipDark({ active, payload, label, money }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl p-3 shadow-xl text-xs">
      {label && <p className="text-slate-400 font-semibold mb-1">{label}</p>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color || p.payload?.fill }} />
          <span className="text-slate-300">{p.name}: <strong className="text-white">{money ? COP(p.value) : (p.value ?? 0).toLocaleString('es-CO')}</strong></span>
        </div>
      ))}
    </div>
  )
}

function Card({ children, className = '' }) {
  return <div className={`bg-slate-800 border border-slate-700 rounded-2xl p-5 ${className}`}>{children}</div>
}

function ChartTitle({ icon: Icon, children, accent }) {
  return (
    <h3 className="font-semibold text-slate-200 text-sm flex items-center gap-2 mb-4">
      {Icon && <Icon className={`w-4 h-4 ${accent}`} />} {children}
    </h3>
  )
}

export default function AnalyticsDashboard({ accent = 'indigo' }) {
  const hoy = new Date().toISOString().slice(0, 10)
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [data, setData] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [drill, setDrill] = useState(null)

  // Panel activo: el ADMIN usa naranja y navega a /admin; el supervisor a /supervisor
  const basePath = accent === 'orange' ? '/admin' : '/supervisor'
  const pick = (d, key) => d?.[key] ?? d?.payload?.[key]
  const openDrill = (dim, valor, titulo) => { if (valor != null) setDrill({ dim, valor: String(valor), titulo }) }

  const accentText = accent === 'orange' ? 'text-orange-400' : 'text-indigo-400'
  const accentBtn = accent === 'orange' ? 'bg-orange-500 hover:bg-orange-600' : 'bg-indigo-500 hover:bg-indigo-400'
  const accentBar = accent === 'orange' ? '#f97316' : '#6366f1'

  const cargar = useCallback(async () => {
    setCargando(true); setError('')
    try {
      const params = new URLSearchParams()
      if (desde) params.set('desde', desde)
      if (hasta) params.set('hasta', hasta)
      const res = await fetch(`/api/analitica?${params.toString()}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Error al cargar analítica')
      setData(json)
    } catch (e) {
      setError(e.message)
    } finally {
      setCargando(false)
    }
  }, [desde, hasta])

  useEffect(() => { cargar() }, [cargar])

  if (cargando && !data) {
    return <Card className="flex items-center justify-center py-20"><RefreshCw className="w-6 h-6 text-slate-500 animate-spin" /></Card>
  }
  if (error) {
    return <Card className="text-red-400 text-sm">{error}</Card>
  }

  const r = data.resumen
  const kpis = [
    { label: 'Tasa de aprobación', value: `${r.tasaAprobacion}%`, icon: CheckCircle2, color: 'text-emerald-400 bg-emerald-500/10' },
    { label: 'Solicitudes', value: r.totalSolicitudes.toLocaleString('es-CO'), icon: TrendingUp, color: 'text-blue-400 bg-blue-500/10' },
    { label: 'Créditos en mora', value: r.creditosEnMora.toLocaleString('es-CO'), icon: AlertTriangle, color: 'text-red-400 bg-red-500/10' },
    { label: 'PQR abiertas', value: r.pqrAbiertas.toLocaleString('es-CO'), icon: MessageSquare, color: 'text-yellow-400 bg-yellow-500/10' },
  ]

  return (
    <div className="flex flex-col gap-5">
      {/* ── Barra de filtros / configuración del reporte ── */}
      <Card className="!p-4">
        <div className="flex flex-col lg:flex-row lg:items-end gap-3">
          <div className="flex items-center gap-2 text-slate-300 text-sm font-semibold">
            <Filter className={`w-4 h-4 ${accentText}`} /> Configurar reporte
          </div>
          <div className="flex flex-wrap gap-3 flex-1">
            <label className="text-xs text-slate-400 flex flex-col gap-1">
              Desde
              <input type="date" value={desde} max={hasta || hoy} onChange={e => setDesde(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-slate-500" />
            </label>
            <label className="text-xs text-slate-400 flex flex-col gap-1">
              Hasta
              <input type="date" value={hasta} min={desde} max={hoy} onChange={e => setHasta(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-slate-500" />
            </label>
          </div>
          <div className="flex gap-2">
            <button onClick={cargar} className={`inline-flex items-center gap-2 ${accentBtn} text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors`}>
              <RefreshCw className={`w-4 h-4 ${cargando ? 'animate-spin' : ''}`} /> Aplicar
            </button>
            <button onClick={() => { setDesde(''); setHasta('') }}
              className="inline-flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
              Limpiar
            </button>
            <a href="/api/reportes/export?tipo=creditos" className="inline-flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
              <Download className="w-4 h-4" /> Exportar
            </a>
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-3 flex items-center gap-1.5">
          <MousePointerClick className="w-3.5 h-3.5" /> Haz clic en cualquier barra o sector para ver el detalle y actuar sobre los registros.
        </p>
      </Card>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(k => (
          <Card key={k.label}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${k.color}`}><k.icon className="w-5 h-5" /></div>
            <p className="text-2xl font-extrabold text-white">{k.value}</p>
            <p className="text-slate-400 text-sm mt-0.5">{k.label}</p>
          </Card>
        ))}
      </div>

      {/* ── Fila 1: estados (pie) + comparativa aprobadas/rechazadas ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card>
          <ChartTitle icon={Users} accent={accentText}>Clientes por estado del proceso</ChartTitle>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={data.solicitudesPorEstado.filter(e => e.count > 0)} dataKey="count" nameKey="estado" cx="50%" cy="50%" outerRadius={90} label={(e) => e.estado}
                cursor="pointer" onClick={(d) => openDrill('estado', pick(d, 'estado'), 'Estado del proceso')}>
                {data.solicitudesPorEstado.map((e, i) => <Cell key={i} fill={ESTADO_COLORS[e.estado] || BAR_COLORS[i]} />)}
              </Pie>
              <Tooltip content={<TooltipDark />} />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <ChartTitle icon={CheckCircle2} accent={accentText}>Aprobadas vs Rechazadas</ChartTitle>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={[{ name: 'Comparativa', Aprobadas: data.comparativa.aprobadas, Rechazadas: data.comparativa.rechazadas }]}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} allowDecimals={false} />
              <Tooltip content={<TooltipDark />} cursor={{ fill: '#33415533' }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Aprobadas" fill="#10b981" radius={[6, 6, 0, 0]} cursor="pointer" onClick={() => openDrill('estado', 'APROBADA', 'Estado del proceso')} />
              <Bar dataKey="Rechazadas" fill="#ef4444" radius={[6, 6, 0, 0]} cursor="pointer" onClick={() => openDrill('estado', 'RECHAZADA', 'Estado del proceso')} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* ── Fila 2: créditos por asesor + mora por tramos ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card>
          <ChartTitle icon={Users} accent={accentText}>Créditos por asesor</ChartTitle>
          <ResponsiveContainer width="100%" height={Math.max(220, data.creditosPorAsesor.length * 42)}>
            <BarChart data={data.creditosPorAsesor} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
              <XAxis type="number" stroke="#94a3b8" fontSize={12} allowDecimals={false} />
              <YAxis type="category" dataKey="asesor" stroke="#94a3b8" fontSize={11} width={110} />
              <Tooltip content={<TooltipDark />} cursor={{ fill: '#33415533' }} />
              <Bar dataKey="creditos" name="Créditos" fill={accentBar} radius={[0, 6, 6, 0]}
                cursor="pointer" onClick={(d) => openDrill('asesor', pick(d, 'asesor'), 'Créditos del asesor')}>
                {data.creditosPorAsesor.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <ChartTitle icon={AlertTriangle} accent={accentText}>Mora por tramos</ChartTitle>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.moraPorTramos}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="tramo" stroke="#94a3b8" fontSize={10} />
              <YAxis stroke="#94a3b8" fontSize={12} allowDecimals={false} />
              <Tooltip content={<TooltipDark />} cursor={{ fill: '#33415533' }} />
              <Bar dataKey="count" name="Créditos" radius={[6, 6, 0, 0]}
                cursor="pointer" onClick={(d) => openDrill('mora', pick(d, 'tramo'), 'Mora por tramo')}>
                {data.moraPorTramos.map((_, i) => <Cell key={i} fill={MORA_COLORS[i]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* ── Fila 3: créditos por ciudad + por departamento ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card>
          <ChartTitle icon={TrendingUp} accent={accentText}>Créditos por ciudad</ChartTitle>
          <ResponsiveContainer width="100%" height={Math.max(220, data.creditosPorCiudad.length * 36)}>
            <BarChart data={data.creditosPorCiudad} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
              <XAxis type="number" stroke="#94a3b8" fontSize={12} allowDecimals={false} />
              <YAxis type="category" dataKey="ciudad" stroke="#94a3b8" fontSize={11} width={100} />
              <Tooltip content={<TooltipDark />} cursor={{ fill: '#33415533' }} />
              <Bar dataKey="count" name="Créditos" fill="#0ea5e9" radius={[0, 6, 6, 0]} cursor="pointer" onClick={(d) => openDrill('ciudad', pick(d, 'ciudad'), 'Créditos por ciudad')} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <ChartTitle icon={TrendingUp} accent={accentText}>Créditos por departamento</ChartTitle>
          <ResponsiveContainer width="100%" height={Math.max(220, data.creditosPorDepartamento.length * 36)}>
            <BarChart data={data.creditosPorDepartamento} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
              <XAxis type="number" stroke="#94a3b8" fontSize={12} allowDecimals={false} />
              <YAxis type="category" dataKey="departamento" stroke="#94a3b8" fontSize={11} width={100} />
              <Tooltip content={<TooltipDark />} cursor={{ fill: '#33415533' }} />
              <Bar dataKey="count" name="Créditos" fill="#14b8a6" radius={[0, 6, 6, 0]} cursor="pointer" onClick={(d) => openDrill('departamento', pick(d, 'departamento'), 'Créditos por departamento')} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* ── Fila 4: PQR por estado + por tipo ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card>
          <ChartTitle icon={MessageSquare} accent={accentText}>PQR (tickets) por estado</ChartTitle>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={data.pqrPorEstado.filter(e => e.count > 0)} dataKey="count" nameKey="estado" cx="50%" cy="50%" outerRadius={90} label={(e) => e.estado}
                cursor="pointer" onClick={(d) => openDrill('pqr_estado', pick(d, 'estado'), 'PQR por estado')}>
                {data.pqrPorEstado.map((e, i) => <Cell key={i} fill={PQR_COLORS[i]} />)}
              </Pie>
              <Tooltip content={<TooltipDark />} />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <ChartTitle icon={MessageSquare} accent={accentText}>PQR (tickets) por tipo</ChartTitle>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.pqrPorTipo}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="tipo" stroke="#94a3b8" fontSize={11} />
              <YAxis stroke="#94a3b8" fontSize={12} allowDecimals={false} />
              <Tooltip content={<TooltipDark />} cursor={{ fill: '#33415533' }} />
              <Bar dataKey="count" name="PQR" fill="#8b5cf6" radius={[6, 6, 0, 0]} cursor="pointer" onClick={(d) => openDrill('pqr_tipo', pick(d, 'tipo'), 'PQR por tipo')} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* ── Fila 5: serie mensual aprobadas vs rechazadas ── */}
      {data.serieMensual.length > 0 && (
        <Card>
          <ChartTitle icon={TrendingUp} accent={accentText}>Evolución mensual: aprobadas vs rechazadas</ChartTitle>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={data.serieMensual}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="mes" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} allowDecimals={false} />
              <Tooltip content={<TooltipDark />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="aprobadas" name="Aprobadas" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="rechazadas" name="Rechazadas" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* ── Panel flotante de drill-down (estilo CRM) ── */}
      {drill && (
        <DrilldownDrawer
          drill={drill}
          basePath={basePath}
          desde={desde}
          hasta={hasta}
          onClose={() => setDrill(null)}
        />
      )}
    </div>
  )
}
