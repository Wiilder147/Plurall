'use client'

/* ==========================================================================
 * ARCHIVO: BotonDesembolsar.js
 * RUTA: apps/web/app/supervisor/desembolsos/BotonDesembolsar.js
 * DESCRIPCIÓN: Acciones de una solicitud aprobada: desembolsar o rechazar.
 * FUNCIONALIDAD: Desembolsar llama a POST /api/admin/desembolsar/:id (crea
 *                crédito, plan y cuotas). Rechazar pide un motivo y llama a
 *                POST /api/admin/desembolsar/:id/rechazar (devuelve la solicitud
 *                a RECHAZADA, sin crear crédito). Ambas para ADMIN y SUPERVISOR.
 * ========================================================================== */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Banknote, Loader2, XCircle } from 'lucide-react'

export default function BotonDesembolsar({ solicitudId, nombreCliente }) {
  const router = useRouter()
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [rechazando, setRechazando] = useState(false)
  const [motivo, setMotivo] = useState('')

  const desembolsar = async () => {
    if (!confirm(`¿Confirmas el desembolso del crédito de ${nombreCliente}? Esta acción crea el crédito y su plan de pagos.`)) return
    setCargando(true); setError('')
    try {
      const res = await fetch(`/api/admin/desembolsar/${solicitudId}`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'No se pudo desembolsar')
      router.refresh()
    } catch (e) { setError(e.message) }
    finally { setCargando(false) }
  }

  const rechazar = async () => {
    if (!motivo.trim()) { setError('Escribe el motivo del rechazo.'); return }
    setCargando(true); setError('')
    try {
      const res = await fetch(`/api/admin/desembolsar/${solicitudId}/rechazar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivo: motivo.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'No se pudo rechazar')
      router.refresh()
    } catch (e) { setError(e.message) }
    finally { setCargando(false) }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      {!rechazando ? (
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setRechazando(true); setError('') }}
            disabled={cargando}
            className="inline-flex items-center gap-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-sm font-semibold px-3 py-2 rounded-xl transition-colors disabled:opacity-60"
          >
            <XCircle className="w-4 h-4" /> Rechazar
          </button>
          <button
            onClick={desembolsar}
            disabled={cargando}
            className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
          >
            {cargando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Banknote className="w-4 h-4" />}
            {cargando ? 'Desembolsando…' : 'Desembolsar'}
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-end gap-2 w-64">
          <textarea
            value={motivo}
            onChange={e => setMotivo(e.target.value)}
            rows={2}
            autoFocus
            placeholder="Motivo del rechazo del desembolso…"
            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-red-500 resize-none"
          />
          <div className="flex items-center gap-2">
            <button onClick={() => { setRechazando(false); setMotivo(''); setError('') }} disabled={cargando}
              className="text-xs text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded-lg border border-slate-600">
              Cancelar
            </button>
            <button onClick={rechazar} disabled={cargando || !motivo.trim()}
              className="inline-flex items-center gap-1.5 bg-red-500 hover:bg-red-400 disabled:opacity-60 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">
              {cargando ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
              Confirmar rechazo
            </button>
          </div>
        </div>
      )}
      {error && <p className="text-xs text-red-400 max-w-[240px] text-right">{error}</p>}
    </div>
  )
}
