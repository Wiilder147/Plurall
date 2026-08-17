'use client'

/* ==========================================================================
 * ARCHIVO: ResponderPqr.js
 * RUTA: apps/web/components/ResponderPqr.js
 * DESCRIPCIÓN: Acción del staff para responder y cambiar el estado de una PQR.
 * FUNCIONALIDAD: Modal con respuesta + selector de estado. Consume
 *                PATCH /api/pqr/:id. Reutilizado por supervisor y asesor.
 * ========================================================================== */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MessageSquare, Loader2, X, Lock } from 'lucide-react'

const ESTADOS = ['ABIERTO', 'EN_PROCESO', 'RESUELTO', 'CERRADO']

export default function ResponderPqr({ pqr }) {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [respuesta, setRespuesta] = useState(pqr.respuesta || '')
  const [estado, setEstado] = useState(pqr.estado || 'ABIERTO')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  // Una PQR cerrada es inmutable (trazabilidad de auditoría): solo lectura.
  const cerrado = pqr.estado === 'CERRADO'

  const guardar = async () => {
    setCargando(true); setError('')
    try {
      const res = await fetch(`/api/pqr/${pqr.id_pqr}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ respuesta, estado }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Error al guardar')
      setAbierto(false)
      router.refresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setCargando(false)
    }
  }

  return (
    <>
      <button onClick={() => setAbierto(true)}
        className={`inline-flex items-center gap-1.5 border px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
          cerrado
            ? 'bg-slate-500/10 hover:bg-slate-500/20 text-slate-400 border-slate-500/30'
            : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
        }`}>
        {cerrado
          ? <><Lock className="w-3.5 h-3.5" /> Ver respuesta</>
          : <><MessageSquare className="w-3.5 h-3.5" /> {pqr.respuesta ? 'Editar respuesta' : 'Responder'}</>
        }
      </button>

      {abierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={() => setAbierto(false)} />
          <div className="relative bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md p-6">
            <button onClick={() => setAbierto(false)} className="absolute top-4 right-4 text-slate-500 hover:text-slate-300">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-bold text-white mb-1">{cerrado ? 'PQR cerrada' : 'Responder PQR'}</h3>
            <p className="text-slate-400 text-sm mb-4">{pqr.asunto}</p>

            {cerrado && (
              <div className="flex items-start gap-2 bg-slate-700/40 border border-slate-600 rounded-xl px-3 py-2 mb-4 text-xs text-slate-300">
                <Lock className="w-4 h-4 mt-0.5 shrink-0" />
                Esta PQR está cerrada. Su respuesta es inmutable por trazabilidad de auditoría.
              </div>
            )}

            <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Respuesta</label>
            <textarea value={respuesta} onChange={(e) => setRespuesta(e.target.value)} rows={4}
              readOnly={cerrado}
              placeholder="Escribe la respuesta para el cliente…"
              className={`w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none resize-none ${cerrado ? 'opacity-70 cursor-not-allowed' : 'focus:border-emerald-500'}`} />

            {!cerrado && (
              <>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2 mt-4">Estado</label>
                <select value={estado} onChange={(e) => setEstado(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500">
                  {ESTADOS.map(e => <option key={e} value={e}>{e.replace('_', ' ')}</option>)}
                </select>
              </>
            )}

            {error && <p className="text-red-400 text-xs mt-2">{error}</p>}

            <div className="flex gap-3 mt-5">
              <button onClick={() => setAbierto(false)}
                className="flex-1 py-2.5 border border-slate-600 text-slate-400 hover:text-slate-200 rounded-xl text-sm font-medium">
                {cerrado ? 'Cerrar' : 'Cancelar'}
              </button>
              {!cerrado && (
                <button onClick={guardar} disabled={cargando}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800">
                  {cargando ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
