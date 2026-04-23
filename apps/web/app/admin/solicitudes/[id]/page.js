'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { calcularAmortizacion, formatCOP } from '@/lib/calculadora'
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
  User,
  DollarSign,
  FileText,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Send,
} from 'lucide-react'
import Link from 'next/link'

const MOTIVOS_RECHAZO = [
  'Capacidad de pago insuficiente',
  'Documentación incompleta o inconsistente',
  'Historial crediticio negativo',
  'Negocio con menos de 6 meses de antigüedad',
  'Información no verificable',
]

export default function AdminDetalleSolicitudPage() {
  const router = useRouter()
  const params = useParams()
  const id     = params.id

  const [sol,         setSol]         = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState(null)
  const [accion,      setAccion]      = useState(null) // 'aprobar' | 'rechazar' | 'desembolsar'
  const [submitting,  setSubmitting]  = useState(false)
  const [exito,       setExito]       = useState(false)
  const [mostrarTabla,setMostrarTabla]= useState(false)

  // Form aprobar
  const [montoAprobado,  setMontoAprobado]  = useState('')
  const [plazoAprobado,  setPlazoAprobado]  = useState('')
  const [tasaAprobada,   setTasaAprobada]   = useState('28')
  const [comentCliente,  setComentCliente]  = useState('')
  const [comentTecnico,  setComentTecnico]  = useState('')
  const [motivoRechazo,  setMotivoRechazo]  = useState(MOTIVOS_RECHAZO[0])

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
            nombre_negocio, descripcion_negocio, score_credito,
            detalle_cliente ( ingresos_mensuales, egresos_mensuales, otras_obligaciones ),
            documento_cliente ( tipo_documento, estado_verificacion )
          ),
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
    const res = await fetch(`/api/admin/solicitud/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accion:               'APROBAR',
        monto_aprobado:       parseFloat(montoAprobado),
        plazo_aprobado:       parseInt(plazoAprobado),
        tasa_interes_aprobada: parseFloat(tasaAprobada) / 100 / 12,
        comentarios_cliente:  comentCliente,
        comentarios_tecnicos: comentTecnico,
      }),
    })
    if (res.ok) setExito(true)
    else setError('Error al aprobar. Intenta de nuevo.')
    setSubmitting(false)
  }

  async function handleRechazar() {
    setSubmitting(true)
    const res = await fetch(`/api/admin/solicitud/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accion:               'RECHAZAR',
        comentarios_cliente:  motivoRechazo,
        comentarios_tecnicos: comentTecnico,
      }),
    })
    if (res.ok) setExito(true)
    else setError('Error al rechazar. Intenta de nuevo.')
    setSubmitting(false)
  }

  async function handleDesembolsar() {
    setSubmitting(true)
    const res = await fetch(`/api/admin/desembolsar/${id}`, {
      method: 'POST',
    })
    if (res.ok) setExito(true)
    else {
      const data = await res.json()
      setError(data.error || 'Error al desembolsar.')
    }
    setSubmitting(false)
  }

  // ── Pantalla de éxito ────────────────────────────────────────
  if (exito) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-5 text-center">
        <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center">
          <CheckCircle2 className="w-10 h-10 text-emerald-400" />
        </div>
        <h2 className="text-2xl font-bold text-white">Acción completada</h2>
        <p className="text-slate-400">La solicitud fue actualizada correctamente.</p>
        <Link href="/admin/solicitudes" className="text-orange-400 font-semibold hover:underline">
          ← Volver a solicitudes
        </Link>
      </div>
    )
  }

  if (loading) return <div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="w-8 h-8 animate-spin text-orange-500" /></div>
  if (error && !sol) return <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3 text-center"><AlertCircle className="w-12 h-12 text-red-400" /><p className="text-slate-400">{error}</p></div>

  const estadoNombre = sol.estado_solicitud?.nombre?.toUpperCase() || 'PENDIENTE'
  const decision     = sol.decision_solicitud?.[0]
  const cliente      = sol.cliente
  const detalle      = cliente?.detalle_cliente?.[0]
  const docs         = cliente?.documento_cliente || []
  const docsAprobados = docs.filter((d) => d.estado_verificacion === 'APROBADO').length
  const esPendiente   = ['PENDIENTE', 'EN_ESTUDIO'].includes(estadoNombre)
  const esAprobada    = estadoNombre === 'APROBADA'

  // Simulación con datos aprobados (o solicitados)
  const montoSim  = parseFloat(montoAprobado)  || sol.monto_solicitado
  const plazoSim  = parseInt(plazoAprobado)    || sol.plazo_meses
  const tasaSim   = parseFloat(tasaAprobada)   || 28
  const simResult = calcularAmortizacion(montoSim, tasaSim, plazoSim)

  return (
    <div className="flex flex-col gap-6 pb-10 max-w-5xl">

      <header>
        <Link href="/admin/solicitudes" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-orange-400 transition-colors mb-3">
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Datos del cliente */}
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
          <h2 className="font-semibold text-slate-300 mb-4 flex items-center gap-2 text-sm">
            <User className="w-4 h-4 text-orange-400" /> Cliente
          </h2>
          <div className="flex flex-col gap-2 text-sm">
            <p className="text-white font-bold text-lg">{cliente?.nombre_completo}</p>
            <p className="text-slate-400">CC: {cliente?.dni}</p>
            <p className="text-slate-400">{cliente?.telefono}</p>
            <p className="text-slate-400 text-xs">{cliente?.email}</p>
            {cliente?.nombre_negocio && (
              <div className="mt-2 bg-slate-700/50 rounded-lg p-3">
                <p className="text-orange-400 font-medium text-xs">Negocio</p>
                <p className="text-slate-300 text-sm">{cliente.nombre_negocio}</p>
                {cliente.descripcion_negocio && <p className="text-slate-500 text-xs mt-1">{cliente.descripcion_negocio}</p>}
              </div>
            )}
            {detalle && (
              <div className="mt-2 flex flex-col gap-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Ingresos</span>
                  <span className="text-slate-300">{formatCOP(detalle.ingresos_mensuales || 0)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Egresos</span>
                  <span className="text-slate-300">{formatCOP(detalle.egresos_mensuales || 0)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Otras deudas</span>
                  <span className="text-slate-300">{formatCOP(detalle.otras_obligaciones || 0)}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Datos de la solicitud + simulador */}
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
          <h2 className="font-semibold text-slate-300 mb-4 flex items-center gap-2 text-sm">
            <DollarSign className="w-4 h-4 text-orange-400" /> Solicitud
          </h2>
          <div className="flex flex-col gap-3 text-sm">
            {[
              { label: 'Monto', value: formatCOP(sol.monto_solicitado) },
              { label: 'Plazo', value: `${sol.plazo_meses} meses` },
              { label: 'Propósito', value: sol.proposito || '—' },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-slate-500 text-xs">{label}</p>
                <p className="text-slate-200">{value}</p>
              </div>
            ))}
            {/* Cuota calculada */}
            <div className="mt-3 bg-orange-500/10 border border-orange-500/20 rounded-xl p-3">
              <p className="text-orange-400 text-xs font-medium">Cuota estimada (tasa {tasaSim}% EA)</p>
              <p className="text-white text-xl font-extrabold mt-0.5">{formatCOP(simResult.cuotaMensual)}</p>
              <p className="text-orange-300 text-xs">Total intereses: {formatCOP(simResult.totalIntereses)}</p>
            </div>
          </div>
        </div>

        {/* Documentos y score */}
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
          <h2 className="font-semibold text-slate-300 mb-4 flex items-center gap-2 text-sm">
            <FileText className="w-4 h-4 text-orange-400" /> Documentos KYC
          </h2>
          <div className="flex flex-col gap-2 mb-4">
            {docs.length === 0 ? (
              <p className="text-slate-500 text-xs">Sin documentos subidos.</p>
            ) : docs.map((d) => (
              <div key={d.tipo_documento} className="flex items-center justify-between text-xs">
                <span className="text-slate-400">{d.tipo_documento.replace(/_/g, ' ')}</span>
                <span className={`font-semibold ${
                  d.estado_verificacion === 'APROBADO' ? 'text-emerald-400' :
                  d.estado_verificacion === 'RECHAZADO' ? 'text-red-400' : 'text-yellow-400'
                }`}>{d.estado_verificacion}</span>
              </div>
            ))}
            <div className="mt-2 text-xs text-slate-400">
              {docsAprobados}/{docs.length} documentos aprobados
            </div>
          </div>
          {/* Score */}
          <h2 className="font-semibold text-slate-300 mb-2 flex items-center gap-2 text-sm">
            <BarChart3 className="w-4 h-4 text-orange-400" /> Score crediticio
          </h2>
          <div className="bg-slate-700/50 rounded-xl p-3 text-center">
            <p className="text-2xl font-extrabold text-white">{cliente?.score_credito || 0}</p>
            <p className="text-slate-500 text-xs">Puntaje interno</p>
            <div className="w-full bg-slate-600 rounded-full h-1.5 mt-2">
              <div className="bg-orange-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, (cliente?.score_credito || 0) / 10)}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Tabla de amortización (desplegable) */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden">
        <button
          onClick={() => setMostrarTabla(!mostrarTabla)}
          className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-slate-700/40 transition-colors"
        >
          <span className="font-semibold text-slate-300 text-sm">Ver tabla de amortización ({plazoSim} cuotas)</span>
          {mostrarTabla ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>
        {mostrarTabla && (
          <div className="overflow-x-auto border-t border-slate-700">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-700/50 text-slate-400 uppercase tracking-wide">
                  {['#','Capital','Interés','Cuota','Saldo'].map((h) => (
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
            <Send className="w-4 h-4 text-orange-400" /> Tomar Decisión
          </h2>

          {error && (
            <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-4">
              {error}
            </p>
          )}

          {/* Desembolsar si ya está aprobada */}
          {esAprobada && (
            <div className="flex flex-col gap-3">
              <p className="text-slate-400 text-sm">Esta solicitud fue aprobada. ¿Confirmas el desembolso?</p>
              <button
                onClick={handleDesembolsar}
                disabled={submitting}
                className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-500 disabled:opacity-60 text-white font-bold px-6 py-3 rounded-xl transition-all w-fit"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Confirmar Desembolso
              </button>
            </div>
          )}

          {/* Aprobar / Rechazar si está pendiente */}
          {esPendiente && (
            <div className="flex flex-col gap-6">
              {/* Tabs aprobar / rechazar */}
              <div className="flex gap-2">
                {[['aprobar', 'Aprobar', 'border-emerald-500 bg-emerald-500/10 text-emerald-400'],
                  ['rechazar','Rechazar','border-red-500 bg-red-500/10 text-red-400']].map(([key, label, cls]) => (
                  <button
                    key={key}
                    onClick={() => setAccion(accion === key ? null : key)}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
                      accion === key ? cls : 'border-slate-700 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Formulario Aprobar */}
              {accion === 'aprobar' && (
                <div className="flex flex-col gap-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs text-slate-400 mb-1 block">Monto aprobado (COP)</label>
                      <input type="number" value={montoAprobado} onChange={(e) => setMontoAprobado(e.target.value)}
                        className="w-full bg-slate-700 border border-slate-600 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 mb-1 block">Plazo aprobado (meses)</label>
                      <input type="number" value={plazoAprobado} onChange={(e) => setPlazoAprobado(e.target.value)}
                        className="w-full bg-slate-700 border border-slate-600 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 mb-1 block">Tasa EA (%)</label>
                      <input type="number" value={tasaAprobada} onChange={(e) => setTasaAprobada(e.target.value)}
                        className="w-full bg-slate-700 border border-slate-600 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Comentario para el cliente</label>
                    <textarea value={comentCliente} onChange={(e) => setComentCliente(e.target.value)} rows={2}
                      className="w-full bg-slate-700 border border-slate-600 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Notas internas (no visible al cliente)</label>
                    <textarea value={comentTecnico} onChange={(e) => setComentTecnico(e.target.value)} rows={2}
                      className="w-full bg-slate-700 border border-slate-600 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none" />
                  </div>
                  <button onClick={handleAprobar} disabled={submitting}
                    className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold px-6 py-3 rounded-xl transition-all w-fit">
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Aprobar Solicitud
                  </button>
                </div>
              )}

              {/* Formulario Rechazar */}
              {accion === 'rechazar' && (
                <div className="flex flex-col gap-4">
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Motivo (visible al cliente)</label>
                    <select value={motivoRechazo} onChange={(e) => setMotivoRechazo(e.target.value)}
                      className="w-full bg-slate-700 border border-slate-600 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
                      {MOTIVOS_RECHAZO.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Notas internas (no visible al cliente)</label>
                    <textarea value={comentTecnico} onChange={(e) => setComentTecnico(e.target.value)} rows={2}
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
          <p className="font-semibold text-slate-300 mb-2">Decisión ya registrada: {decision.resultado}</p>
          <p className="text-slate-400 text-sm">{decision.comentarios_cliente}</p>
        </div>
      )}
    </div>
  )
}
