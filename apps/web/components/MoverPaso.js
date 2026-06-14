'use client'

/* ==========================================================================
 * ARCHIVO: MoverPaso.js
 * RUTA: apps/web/components/MoverPaso.js
 * DESCRIPCIÓN: Control para mover una solicitud de paso (staff).
 * FUNCIONALIDAD: Botones Retroceder / Adelantar sobre el flujo lineal
 *                PENDIENTE → EN_ESTUDIO → APROBADA. Consume
 *                PATCH /api/admin/solicitud/:id/mover y refresca.
 * ========================================================================== */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'

const PASOS = ['PENDIENTE', 'EN_ESTUDIO', 'APROBADA']
const ETIQUETA = { PENDIENTE: 'Pendiente', EN_ESTUDIO: 'Pre-aprobada', APROBADA: 'Aprobada' }

export default function MoverPaso({ solicitudId, estadoActual }) {
  const router = useRouter()
  const [cargando, setCargando] = useState(null)
  const [error, setError] = useState('')

  const estado = (estadoActual || 'PENDIENTE').toUpperCase()
  const idx = PASOS.indexOf(estado)
  const terminal = ['DESEMBOLSADA'].includes(estado)

  const mover = async (direccion) => {
    setCargando(direccion); setError('')
    try {
      const res = await fetch(`/api/admin/solicitud/${solicitudId}/mover`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ direccion }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Error')
      router.refresh()
    } catch (e) {
      setError(e.message)
    } finally {
      setCargando(null)
    }
  }

  if (terminal) return null

  // No se puede retroceder antes del primer paso; no se puede adelantar más allá de APROBADA aquí.
  const noRetroceder = idx === 0
  const noAdelantar = idx === PASOS.length - 1

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex-1">
        <p className="text-sm font-semibold text-slate-200">Mover de paso</p>
        <p className="text-xs text-slate-500 mt-0.5">
          Flujo: Pendiente → Pre-aprobada → Aprobada. El desembolso se hace con su propio botón.
        </p>
        {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
      </div>

      {/* Indicador de pasos */}
      <div className="flex items-center gap-1.5">
        {PASOS.map((p, i) => (
          <span key={p} className={`text-[10px] font-semibold px-2 py-1 rounded-full ${
            i === idx ? 'bg-indigo-500/20 text-indigo-300' : i < idx ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-700 text-slate-500'
          }`}>{ETIQUETA[p]}</span>
        ))}
      </div>

      <div className="flex gap-2">
        <button onClick={() => mover('retroceder')} disabled={noRetroceder || cargando}
          className="inline-flex items-center gap-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 text-xs font-semibold px-3 py-2 rounded-lg transition-colors">
          {cargando === 'retroceder' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ChevronLeft className="w-3.5 h-3.5" />} Retroceder
        </button>
        <button onClick={() => mover('adelantar')} disabled={noAdelantar || cargando}
          className="inline-flex items-center gap-1 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors">
          {cargando === 'adelantar' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <>Adelantar <ChevronRight className="w-3.5 h-3.5" /></>}
        </button>
      </div>
    </div>
  )
}
