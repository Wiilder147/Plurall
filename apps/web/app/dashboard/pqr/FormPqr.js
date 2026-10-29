'use client'

/* ==========================================================================
 * ARCHIVO: FormPqr.js
 * RUTA: apps/web/app/dashboard/pqr/FormPqr.js
 * DESCRIPCIÓN: Formulario del cliente para crear una PQR.
 * FUNCIONALIDAD: Envía la PQR a POST /api/pqr y refresca la lista.
 * ========================================================================== */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Send, Loader2 } from 'lucide-react'

const TIPOS = [
  { v: 'PETICION', l: 'Petición' },
  { v: 'QUEJA', l: 'Queja' },
  { v: 'RECLAMO', l: 'Reclamo' },
  { v: 'SUGERENCIA', l: 'Sugerencia' },
]

export default function FormPqr() {
  const router = useRouter()
  const [tipo, setTipo] = useState('PETICION')
  const [asunto, setAsunto] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState(false)
  const [radicado, setRadicado] = useState('')

  const enviar = async (e) => {
    e.preventDefault()
    if (!asunto.trim() || !descripcion.trim()) return
    setCargando(true); setError(''); setOk(false)
    try {
      const res = await fetch('/api/pqr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo, asunto, descripcion }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Error al enviar')
      setAsunto(''); setDescripcion(''); setTipo('PETICION'); setRadicado(data?.numero_radicado || ''); setOk(true)
      router.refresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setCargando(false)
    }
  }

  return (
    <form onSubmit={enviar} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm flex flex-col gap-4">
      <p className="font-semibold text-slate-900 text-sm">Crear una nueva PQR</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Tipo</label>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-orange-400">
            {TIPOS.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Asunto</label>
          <input type="text" value={asunto} onChange={(e) => setAsunto(e.target.value)} maxLength={160}
            placeholder="Resumen breve" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-orange-400" />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1">Descripción</label>
        <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={4}
          placeholder="Cuéntanos en detalle tu petición, queja, reclamo o sugerencia."
          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-orange-400 resize-none" />
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
      {ok && (
        <p className="text-xs text-emerald-600">
          Tu PQR se registró correctamente.
          {radicado && <> Número de radicado: <strong className="font-mono">{radicado}</strong>. Guárdalo para hacerle seguimiento.</>}
        </p>
      )}

      <button type="submit" disabled={cargando}
        className="self-start inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
        {cargando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        Enviar PQR
      </button>
    </form>
  )
}
