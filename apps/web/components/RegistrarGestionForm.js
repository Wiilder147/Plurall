'use client'

/* ==========================================================================
 * ARCHIVO: RegistrarGestionForm.js
 * RUTA: apps/web/components/RegistrarGestionForm.js
 * DESCRIPCIÓN: Componente de interfaz de usuario (UI) reutilizable.
 * FUNCIONALIDAD: Este archivo define la lógica y estructura para su respectivo módulo.
 * ========================================================================== */

import { useState } from 'react'
import { PhoneCall, CheckCircle2, Loader2, AlertCircle, DollarSign } from 'lucide-react'

const TIPOS = ['LLAMADA', 'WHATSAPP', 'VISITA', 'EMAIL', 'PAGO_EFECTIVO', 'PROMESA_PAGO', 'NO_CONTESTA']
const RESULTADOS = {
  LLAMADA:       ['EXITOSO', 'SIN_RESPUESTA', 'PROMESA', 'RECHAZO'],
  WHATSAPP:      ['EXITOSO', 'SIN_RESPUESTA', 'PROMESA', 'RECHAZO'],
  VISITA:        ['EXITOSO', 'SIN_RESPUESTA', 'PROMESA', 'RECHAZO'],
  EMAIL:         ['EXITOSO', 'SIN_RESPUESTA'],
  PAGO_EFECTIVO: ['PAGO_RECIBIDO'],
  PROMESA_PAGO:  ['PROMESA'],
  NO_CONTESTA:   ['SIN_RESPUESTA'],
}

export default function RegistrarGestionForm({ clienteId, creditoId, clienteNombre }) {
  const [tipo,          setTipo]          = useState('LLAMADA')
  const [resultado,     setResultado]     = useState('EXITOSO')
  const [observaciones, setObservaciones] = useState('')
  const [montoProm,     setMontoProm]     = useState('')
  const [fechaProm,     setFechaProm]     = useState('')
  const [montoRecib,    setMontoRecib]    = useState('')
  const [guardando,     setGuardando]     = useState(false)
  const [exito,         setExito]         = useState(false)
  const [error,         setError]         = useState('')

  const resultadosDisp = RESULTADOS[tipo] ?? ['EXITOSO', 'SIN_RESPUESTA']
  const esPromesa      = resultado === 'PROMESA'
  const esPago         = tipo === 'PAGO_EFECTIVO' || resultado === 'PAGO_RECIBIDO'

  function handleTipo(t) {
    setTipo(t)
    const opts = RESULTADOS[t] ?? []
    setResultado(opts[0] ?? 'EXITOSO')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setGuardando(true)
    setError('')

    const res = await fetch('/api/asesor/gestion', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        clienteId,
        creditoId,
        tipo_gestion:    tipo,
        resultado,
        observaciones:   observaciones || null,
        monto_prometido: esPromesa && montoProm ? parseFloat(montoProm) : null,
        fecha_promesa:   esPromesa && fechaProm ? fechaProm : null,
        monto_recibido:  esPago && montoRecib ? parseFloat(montoRecib) : null,
      }),
    })

    if (res.ok) {
      setExito(true)
      setObservaciones('')
      setMontoProm('')
      setFechaProm('')
      setMontoRecib('')
      setTimeout(() => { setExito(false); window.location.reload() }, 1500)
    } else {
      const d = await res.json()
      setError(d.error || 'Error al registrar la gestión.')
    }
    setGuardando(false)
  }

  return (
    <div className="bg-slate-800 border border-teal-500/20 rounded-2xl p-6">
      <h2 className="font-semibold text-slate-300 mb-5 flex items-center gap-2">
        <PhoneCall className="w-4 h-4 text-teal-400" />
        Registrar gestión con {clienteNombre?.split(' ')[0]}
      </h2>

      {exito && (
        <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 mb-4 text-sm text-emerald-400">
          <CheckCircle2 className="w-4 h-4 shrink-0" /> Gestión registrada correctamente.
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-4 text-sm text-red-400">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Tipo de gestión */}
          <div>
            <label className="text-xs text-slate-400 mb-2 block uppercase tracking-wide">Tipo de gestión</label>
            <div className="flex flex-wrap gap-2">
              {TIPOS.map((t) => (
                <button key={t} type="button" onClick={() => handleTipo(t)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                    tipo === t
                      ? 'bg-teal-500/20 border-teal-500/40 text-teal-300'
                      : 'bg-slate-700 border-slate-600 text-slate-400 hover:border-slate-500'
                  }`}>
                  {t.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Resultado */}
          <div>
            <label className="text-xs text-slate-400 mb-2 block uppercase tracking-wide">Resultado</label>
            <div className="flex flex-wrap gap-2">
              {resultadosDisp.map((r) => (
                <button key={r} type="button" onClick={() => setResultado(r)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                    resultado === r
                      ? r === 'PAGO_RECIBIDO' || r === 'EXITOSO'
                        ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                        : r === 'PROMESA'
                        ? 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300'
                        : r === 'RECHAZO'
                        ? 'bg-red-500/20 border-red-500/40 text-red-300'
                        : 'bg-slate-600 border-slate-500 text-slate-300'
                      : 'bg-slate-700 border-slate-600 text-slate-400 hover:border-slate-500'
                  }`}>
                  {r.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Campos condicionales */}
        {esPromesa && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-4">
            <div>
              <label className="text-xs text-yellow-400 mb-1 block">Monto prometido (COP)</label>
              <input type="number" value={montoProm} onChange={e => setMontoProm(e.target.value)}
                placeholder="Ej: 190000"
                className="w-full bg-slate-700 border border-slate-600 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500" />
            </div>
            <div>
              <label className="text-xs text-yellow-400 mb-1 block">Fecha comprometida</label>
              <input type="date" value={fechaProm} onChange={e => setFechaProm(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full bg-slate-700 border border-slate-600 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500" />
            </div>
          </div>
        )}

        {esPago && (
          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4">
            <label className="text-xs text-emerald-400 mb-1 block flex items-center gap-1">
              <DollarSign className="w-3 h-3" /> Monto recibido en efectivo (COP)
            </label>
            <input type="number" value={montoRecib} onChange={e => setMontoRecib(e.target.value)}
              placeholder="Ej: 190000" required={esPago}
              className="w-full bg-slate-700 border border-slate-600 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
        )}

        {/* Observaciones */}
        <div>
          <label className="text-xs text-slate-400 mb-1 block uppercase tracking-wide">Observaciones</label>
          <textarea value={observaciones} onChange={e => setObservaciones(e.target.value)} rows={2}
            placeholder="Describe brevemente el resultado de la gestión…"
            className="w-full bg-slate-700 border border-slate-600 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none" />
        </div>

        <button type="submit" disabled={guardando}
          className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-60 text-white font-bold px-6 py-3 rounded-xl transition-all w-fit">
          {guardando
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando…</>
            : <><CheckCircle2 className="w-4 h-4" /> Registrar gestión</>
          }
        </button>
      </form>
    </div>
  )
}
