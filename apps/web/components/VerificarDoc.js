'use client'

/* ==========================================================================
 * ARCHIVO: VerificarDoc.js
 * RUTA: apps/web/components/VerificarDoc.js
 * DESCRIPCIÓN: Botones de verificación de un documento KYC (staff).
 * FUNCIONALIDAD: Aprobar directo o Rechazar con motivo. Consume
 *                PATCH /api/documentos/verificar/:id y refresca la vista.
 * ========================================================================== */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, X, Loader2 } from 'lucide-react'

export default function VerificarDoc({ idDocumento, estadoActual }) {
  const router = useRouter()
  const [cargando, setCargando] = useState(null) // 'APROBADO' | 'RECHAZADO'
  const [rechazando, setRechazando] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState('')

  const enviar = async (estado, motivoTexto = '') => {
    setCargando(estado); setError('')
    try {
      const res = await fetch(`/api/documentos/verificar/${idDocumento}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado, motivo: motivoTexto }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Error')
      setRechazando(false)
      router.refresh()
    } catch (e) {
      setError(e.message)
    } finally {
      setCargando(null)
    }
  }

  if (rechazando) {
    return (
      <div className="flex flex-col gap-2 w-full sm:w-72">
        <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2}
          placeholder="Motivo del rechazo…"
          className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-red-500 resize-none" />
        {error && <p className="text-red-400 text-xs">{error}</p>}
        <div className="flex gap-2">
          <button onClick={() => motivo.trim() && enviar('RECHAZADO', motivo)} disabled={cargando}
            className="inline-flex items-center gap-1 bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white text-xs font-semibold px-3 py-1.5 rounded-lg">
            {cargando === 'RECHAZADO' ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />} Confirmar rechazo
          </button>
          <button onClick={() => { setRechazando(false); setError('') }}
            className="text-xs text-slate-400 hover:text-slate-200 px-2">Cancelar</button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      {estadoActual !== 'APROBADO' && (
        <button onClick={() => enviar('APROBADO')} disabled={cargando}
          className="inline-flex items-center gap-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all">
          {cargando === 'APROBADO' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Aprobar
        </button>
      )}
      {estadoActual !== 'RECHAZADO' && (
        <button onClick={() => setRechazando(true)}
          className="inline-flex items-center gap-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all">
          <X className="w-3 h-3" /> Rechazar
        </button>
      )}
    </div>
  )
}
