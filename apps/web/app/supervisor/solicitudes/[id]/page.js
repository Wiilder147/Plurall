'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { calcularAmortizacion, formatCOP } from '@/lib/calculadora'
import {
  ArrowLeft, CheckCircle2, XCircle, Loader2, AlertCircle,
  User, DollarSign, FileText, BarChart3, ChevronDown, ChevronUp,
  Send, Eye, TrendingUp,
} from 'lucide-react'
import Link from 'next/link'

const MOTIVOS_RECHAZO = [
  'Capacidad de pago insuficiente',
  'Documentación incompleta o inconsistente',
  'Historial crediticio negativo',
  'Negocio con menos de 6 meses de antigüedad',
  'Información no verificable',
  'Monto solicitado supera el límite permitido',
]

export default function SupervisorDetalleSolicitudPage() {
  const router = useRouter()
  const params = useParams()
  const id     = params.id

  const [sol,          setSol]          = useState(null)
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState(null)
  const [accion,       setAccion]       = useState(null)
  const [submitting,   setSubmitting]   = useState(false)
  const [exito,        setExito]        = useState(false)
  const [mostrarTabla, setMostrarTabla] = useState(false)
  const [mostrarDocs,  setMostrarDocs]  = useState(false)

  // Form aprobar
  const [montoAprobado, setMontoAprobado] = useState('')
  const [plazoAprobado, setPlazoAprobado] = useState('')
  const [tasaAprobada,  setTasaAprobada]  = useState('28')
  const [comentCliente, setComentCliente] = useState('')
  const [comentTecnico, setComentTecnico] = useState('')
  const [motivoRechazo, setMotivoRechazo] = useState(MOTIVOS_RECHAZO[0])

  useEffect(() => {
    async function cargar() {
      const supabase = createClient()
      const { data, error: err } = await supabase
        .from('solicitud_credito')
        .select(`
          *,
          estado_solicitud ( nombre ),
          cliente (
            id_cliente, nombre_completo, dni, email, telefono,
            nombre_negocio, descripcion_negocio, score_credito, ciudad,
            detalle_cliente ( ingresos_mensuales, egresos_mensuales, otras_obligaciones, patrimonio_estimado ),
            documento_cliente ( tipo_documento, estado_verificacion, url_archivo, created_at )
          ),
          score ( puntaje_total, porcentaje, recomendacion, puntaje_maximo_posible ),
          decision_solicitud ( resultado, monto_aprobado, plazo_aprobado, tasa_interes_aprobada, comentarios_cliente, comentarios_tecnicos, fecha_decision )
        `)
        .eq('id_solicitud', id)
        .single()

      if (err || !data) { setError('Solicitud no encontrada.'); setLoading(false); return }
      setSol(data)
      setMontoAprobado(data.monto_solicitado)
      setPlazoAprobado(data.plazo_meses)
      setLoading(false)
    }
    cargar()
  }, [id])

  async function handleAprobar() {
    setSubmitting(true)
    setError(null)
    const res = await fetch(`/api/admin/solicitud/${id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        accion:                'APROBAR',
        monto_aprobado:        parseFloat(montoAprobado),
        plazo_aprobado:        parseInt(plazoAprobado),
        tasa_interes_aprobada: parseFloat(tasaAprobada) / 100 / 12,
        comentarios_cliente:   comentCliente,
        comentarios_tecnicos:  comentTecnico,
      }),
    })
    if (res.ok) setExito(true)
    else { const d = await res.json(); setError(d.error || 'Error al aprobar.') }
    setSubmitting(false)
  }

  async function handleRechazar() {
    setSubmitting(true)
    setError(null)
    const res = await fetch(`/api/admin/solicitud/${id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        accion:               'RECHAZAR',
        comentarios_cliente:  motivoRechazo,
        comentarios_tecnicos: comentTecnico,
      }),
    })
    if (res.ok) setExito(true)
    else { const d = await res.json(); setError(d.error || 'Error al rechazar.') }
    setSubmitting(false)
  }

  async function handleDesembolsar() {
    setSubmitting(true)
    setError(null)
    const res = await fetch(`/api/admin/desembolsar/${id}`, { method: 'POST' })
    if (res.ok) setExito(true)
    else { const d = await res.json(); setError(d.error || 'Error al desembolsar.') }
    setSubmitting(false)
  }

  if (exito) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-5 text-center">
      <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center">
        <CheckCircle2 className="w-10 h-10 text-emerald-400" />
      </div>
      <h2 className="text-2xl font-bold text-white">Acción completada</h2>
      <p className="text-slate-400">La solicitud fue actualizada correctamente.</p>
      <Link href="/supervisor/solicitudes" className="text-indigo-400 font-semibold hover:underline">
        ← Volver a solicitudes
      </Link>
    </div>
  )

  if (loading) return <div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>
  if (error && !sol) return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3 text-center">
      <AlertCircle className="w-12 h-12 text-red-400" />
      <p className="text-slate-400">{error}</p>
    </div>
  )

  const estadoNombre  = sol.estado_solicitud?.nombre?.toUpperCase() ?? 'PENDIENTE'
  const decision      = sol.decision_solicitud?.[0]
  const cliente       = sol.cliente
  const detalle       = cliente?.detalle_cliente?.[0]
  const docs          = cliente?.documento_cliente ?? []
  const scoreData     = sol.score?.[0]
  const esPendiente   = ['PENDIENTE', 'EN_ESTUDIO'].includes(estadoNombre)
  const esAprobada    = estadoNombre === 'APROBADA'

  const montoSim  = parseFloat(montoAprobado) || sol.monto_solicitado
  const plazoSim  = parseInt(plazoAprobado)   || sol.plazo_meses
  const tasaSim   = parseFloat(tasaAprobada)  || 28
  const simResult = calcularAmortizacion(montoSim, tasaSim, plazoSim)

  // Color del score
  const scoreColor = !scoreData ? 'text-slate-400'
    : scoreData.recomendacion === 'APROBAR'        ? 'text-emerald-400'
    : scoreData.recomendacion === 'REVISAR_MANUAL' ? 'text-yellow-400'
    : 'text-red-400'

  return (
    <div className="flex flex-col gap-6 pb-10 max-w-5xl">
      <header>
        <Link href="/supervisor/solicitudes"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-indigo-400 transition-colors mb-3">
          <ArrowLeft className="w-4 h-4" /> Volver a solicitudes
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h1 className="text-2xl font-bold text-white">Revisar Solicitud</h1>
          <span className={`px-3 py-1.5 rounded-full text-xs font-bold w-fit ${
            esPendiente ? 'bg-yellow-500/10 text-yellow-400' :
            esAprobada  ? 'bg-emerald-500/10 text-emerald-400' :
            estadoNombre === 'DESEMBOLSADA' ? 'bg-green-500/10 text-green-400' :
            'bg-red-500/10 text-red-400'
          }`}>{estadoNombre}</span>
        </div>
      </header>

      {error && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {/* Tres columnas: cliente, solicitud, score */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Cliente */}
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
          <h2 className="font-semibold text-slate-300 mb-4 flex items-center gap-2 text-sm">
            <User className="w-4 h-4 text-indigo-400" /> Cliente
          </h2>
          <div className="flex flex-col gap-2.5 text-sm">
            <p className="text-white font-bold text-base">{cliente?.nombre_completo}</p>
            <p className="text-slate-400">CC: {cliente?.dni}</p>
            <p className="text-slate-400">{cliente?.telefono}</p>
            <p className="text-slate-400 text-xs">{cliente?.email}</p>
            {cliente?.ciudad && <p className="text-slate-400 text-xs">{cliente.ciudad}</p>}
            {cliente?.nombre_negocio && (
              <div className="mt-1 bg-slate-700/50 rounded-lg p-3">
                <p className="text-indigo-400 font-medium text-xs">Negocio</p>
                <p className="text-slate-300 text-sm">{cliente.nombre_negocio}</p>
              </div>
            )}
            {detalle && (
              <div className="mt-1 flex flex-col gap-1.5 border-t border-slate-700 pt-2">
                {[
                  ['Ingresos/mes',  detalle.ingresos_mensuales],
                  ['Egresos/mes',   detalle.egresos_mensuales],
                  ['Otras deudas',  detalle.otras_obligaciones],
                  ['Patrimonio',    detalle.patrimonio_estimado],
                ].map(([label, val]) => val ? (
                  <div key={label} className="flex justify-between text-xs">
                    <span className="text-slate-500">{label}</span>
                    <span className="text-slate-300 font-medium">{formatCOP(val)}</span>
                  </div>
                ) : null)}
              </div>
            )}
          </div>
        </div>

        {/* Solicitud + simulador */}
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
          <h2 className="font-semibold text-slate-300 mb-4 flex items-center gap-2 text-sm">
            <DollarSign className="w-4 h-4 text-indigo-400" /> Solicitud
          </h2>
          <div className="flex flex-col gap-3 text-sm">
            {[
              ['Monto solicitado', formatCOP(sol.monto_solicitado)],
              ['Plazo',            `${sol.plazo_meses} meses`],
              ['Canal',            sol.canal_solicitud],
              ['Propósito',        sol.proposito],
            ].map(([label, value]) => value ? (
              <div key={label}>
                <p className="text-slate-500 text-xs">{label}</p>
                <p className="text-slate-200 text-sm">{value}</p>
              </div>
            ) : null)}
            <div className="mt-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-3">
              <p className="text-indigo-400 text-xs font-medium">Cuota estimada (TEA {tasaSim}%)</p>
              <p className="text-white text-xl font-extrabold mt-0.5">{formatCOP(simResult.cuotaMensual)}</p>
              <p className="text-indigo-300 text-xs">Total intereses: {formatCOP(simResult.totalIntereses)}</p>
            </div>
          </div>
        </div>

        {/* Score + documentos */}
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 flex flex-col gap-4">
          {/* Score */}
          <div>
            <h2 className="font-semibold text-slate-300 mb-3 flex items-center gap-2 text-sm">
              <BarChart3 className="w-4 h-4 text-indigo-400" /> Score crediticio
            </h2>
            {scoreData ? (
              <div className="bg-slate-700/50 rounded-xl p-3 text-center">
                <p className={`text-3xl font-extrabold ${scoreColor}`}>{scoreData.puntaje_total}</p>
                <p className="text-slate-500 text-xs mt-0.5">de {scoreData.puntaje_maximo_posible ?? 1000} pts</p>
                <div className="w-full bg-slate-600 rounded-full h-2 mt-2">
                  <div className={`h-2 rounded-full ${
                    scoreData.recomendacion === 'APROBAR' ? 'bg-emerald-500' :
                    scoreData.recomendacion === 'REVISAR_MANUAL' ? 'bg-yellow-500' : 'bg-red-500'
                  }`} style={{ width: `${scoreData.porcentaje ?? 0}%` }} />
                </div>
                <p className={`text-xs font-bold mt-1.5 ${scoreColor}`}>{scoreData.recomendacion?.replace('_', ' ')}</p>
              </div>
            ) : (
              <div className="bg-slate-700/50 rounded-xl p-3 text-center">
                <p className="text-2xl font-extrabold text-slate-400">{cliente?.score_credito ?? 0}</p>
                <p className="text-slate-500 text-xs">Score interno</p>
              </div>
            )}
          </div>

          {/* Documentos KYC */}
          <div>
            <button onClick={() => setMostrarDocs(!mostrarDocs)}
              className="w-full flex items-center justify-between text-sm font-semibold text-slate-300 mb-2">
              <span className="flex items-center gap-2"><FileText className="w-4 h-4 text-indigo-400" /> Documentos KYC ({docs.length})</span>
              {mostrarDocs ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
            </button>
            {mostrarDocs && (
              <div className="flex flex-col gap-2">
                {docs.length === 0 && <p className="text-slate-500 text-xs">Sin documentos.</p>}
                {docs.map((d) => (
                  <div key={d.tipo_documento} className="flex items-center justify-between text-xs bg-slate-700/40 rounded-lg px-3 py-2">
                    <span className="text-slate-400">{d.tipo_documento.replace(/_/g, ' ')}</span>
                    <span className={`font-semibold ${
                      d.estado_verificacion === 'APROBADO'  ? 'text-emerald-400' :
                      d.estado_verificacion === 'RECHAZADO' ? 'text-red-400' : 'text-yellow-400'
                    }`}>{d.estado_verificacion}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabla de amortización desplegable */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden">
        <button onClick={() => setMostrarTabla(!mostrarTabla)}
          className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-slate-700/40 transition-colors">
          <span className="font-semibold text-slate-300 text-sm flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-indigo-400" />
            Tabla de amortización ({plazoSim} cuotas · {formatCOP(simResult.cuotaMensual)}/mes)
          </span>
          {mostrarTabla ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>
        {mostrarTabla && (
          <div className="overflow-x-auto border-t border-slate-700">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-700/50 text-slate-400 uppercase tracking-wide">
                  {['#','Capital','Interés','Cuota','Saldo'].map(h => (
                    <th key={h} className="px-4 py-2 text-right first:text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/30">
                {simResult.tablaCuotas.map((c) => (
                  <tr key={c.numero} className="hover:bg-slate-700/20">
                    <td className="px-4 py-2 text-slate-400">{c.numero}</td>
                    <td className="px-4 py-2 text-right text-slate-300">{formatCOP(c.capital)}</td>
                    <td className="px-4 py-2 text-right text-slate-400">{formatCOP(c.interes)}</td>
                    <td className="px-4 py-2 text-right font-semibold text-slate-200">{formatCOP(c.cuota)}</td>
                    <td className="px-4 py-2 text-right text-slate-400">{formatCOP(c.saldo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Panel de decisión */}
      {(esPendiente || esAprobada) && !decision && (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
          <h2 className="font-semibold text-slate-300 mb-5 flex items-center gap-2">
            <Send className="w-4 h-4 text-indigo-400" /> Tomar Decisión
          </h2>

          {/* Desembolsar si ya está aprobada */}
          {esAprobada && (
            <div className="flex flex-col gap-3">
              <p className="text-slate-400 text-sm">Esta solicitud fue aprobada. ¿Confirmas el desembolso?</p>
              <button onClick={handleDesembolsar} disabled={submitting}
                className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold px-6 py-3 rounded-xl transition-all w-fit">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Confirmar Desembolso
              </button>
            </div>
          )}

          {/* Aprobar / Rechazar */}
          {esPendiente && (
            <div className="flex flex-col gap-6">
              <div className="flex gap-2">
                {[['aprobar','Aprobar','border-emerald-500 bg-emerald-500/10 text-emerald-400'],
                  ['rechazar','Rechazar','border-red-500 bg-red-500/10 text-red-400']].map(([key, label, cls]) => (
                  <button key={key} onClick={() => setAccion(accion === key ? null : key)}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
                      accion === key ? cls : 'border-slate-700 text-slate-400 hover:border-slate-600'
                    }`}>{label}</button>
                ))}
              </div>

              {accion === 'aprobar' && (
                <div className="flex flex-col gap-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[
                      { label: 'Monto aprobado (COP)', val: montoAprobado, set: setMontoAprobado },
                      { label: 'Plazo aprobado (meses)', val: plazoAprobado, set: setPlazoAprobado },
                      { label: 'Tasa EA (%)', val: tasaAprobada, set: setTasaAprobada },
                    ].map(({ label, val, set }) => (
                      <div key={label}>
                        <label className="text-xs text-slate-400 mb-1 block">{label}</label>
                        <input type="number" value={val} onChange={e => set(e.target.value)}
                          className="w-full bg-slate-700 border border-slate-600 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                      </div>
                    ))}
                  </div>
                  {[
                    { label: 'Comentario para el cliente', val: comentCliente, set: setComentCliente },
                    { label: 'Notas internas (no visible al cliente)', val: comentTecnico, set: setComentTecnico },
                  ].map(({ label, val, set }) => (
                    <div key={label}>
                      <label className="text-xs text-slate-400 mb-1 block">{label}</label>
                      <textarea value={val} onChange={e => set(e.target.value)} rows={2}
                        className="w-full bg-slate-700 border border-slate-600 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
                    </div>
                  ))}
                  <button onClick={handleAprobar} disabled={submitting}
                    className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold px-6 py-3 rounded-xl transition-all w-fit">
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Aprobar Solicitud
                  </button>
                </div>
              )}

              {accion === 'rechazar' && (
                <div className="flex flex-col gap-4">
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Motivo (visible al cliente)</label>
                    <select value={motivoRechazo} onChange={e => setMotivoRechazo(e.target.value)}
                      className="w-full bg-slate-700 border border-slate-600 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
                      {MOTIVOS_RECHAZO.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Notas internas</label>
                    <textarea value={comentTecnico} onChange={e => setComentTecnico(e.target.value)} rows={2}
                      className="w-full bg-slate-700 border border-slate-600 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none" />
                  </div>
                  <button onClick={handleRechazar} disabled={submitting}
                    className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white font-bold px-6 py-3 rounded-xl transition-all w-fit">
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                    Rechazar Solicitud
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Decisión ya tomada */}
      {decision && (
        <div className={`border rounded-2xl p-5 ${
          decision.resultado === 'APROBADO' ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20'
        }`}>
          <p className="font-semibold text-slate-300 mb-1">Decisión registrada: {decision.resultado}</p>
          {decision.monto_aprobado && <p className="text-slate-400 text-sm">Monto: {formatCOP(decision.monto_aprobado)} · {decision.plazo_aprobado} meses</p>}
          {decision.comentarios_cliente && <p className="text-slate-400 text-sm mt-1">{decision.comentarios_cliente}</p>}
        </div>
      )}
    </div>
  )
}
