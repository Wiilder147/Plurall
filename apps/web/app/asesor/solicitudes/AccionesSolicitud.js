'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, XCircle, Loader2, X } from 'lucide-react'

export default function AccionesSolicitud({ solicitudId, nombreCliente }) {
  const router = useRouter()
  const [modal,   setModal]   = useState(null) // 'PRE_APROBAR' | 'RECHAZAR' | null
  const [notas,   setNotas]   = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  function abrirModal(accion) {
    setModal(accion)
    setNotas('')
    setError('')
  }

  function cerrarModal() {
    setModal(null)
    setNotas('')
    setError('')
  }

  async function confirmar() {
    if (!notas.trim()) { setError('Escribe una nota antes de continuar.'); return }
    setLoading(true)
    setError('')

    try {
      const res  = await fetch(`/api/asesor/solicitudes/${solicitudId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ accion: modal, notas: notas.trim() }),
      })
      const data = await res.json()

      if (!res.ok) { setError(data.error || 'Error al procesar la acción.'); return }

      cerrarModal()
      router.refresh()
    } catch {
      setError('Error de conexión. Inténtalo de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const esPreAprobar = modal === 'PRE_APROBAR'

  return (
    <>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => abrirModal('PRE_APROBAR')}
          className="flex items-center gap-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
        >
          <CheckCircle className="w-3.5 h-3.5" /> Pre-aprobar
        </button>
        <button
          type="button"
          onClick={() => abrirModal('RECHAZAR')}
          className="flex items-center gap-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
        >
          <XCircle className="w-3.5 h-3.5" /> Rechazar
        </button>
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={cerrarModal} />
          <div className="relative bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md p-6 animate-fade-in">
            <button onClick={cerrarModal} className="absolute top-4 right-4 text-slate-500 hover:text-slate-300 transition-colors">
              <X className="w-5 h-5" />
            </button>

            <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${
              esPreAprobar ? 'bg-emerald-500/10' : 'bg-red-500/10'
            }`}>
              {esPreAprobar
                ? <CheckCircle className="w-6 h-6 text-emerald-400" />
                : <XCircle    className="w-6 h-6 text-red-400"     />
              }
            </div>

            <h3 className="text-lg font-bold text-white mb-1">
              {esPreAprobar ? 'Pre-aprobar solicitud' : 'Rechazar solicitud'}
            </h3>
            <p className="text-slate-400 text-sm mb-5">
              {esPreAprobar
                ? `Confirma que verificaste los datos de ${nombreCliente} y la solicitud puede avanzar al supervisor.`
                : `Confirma el rechazo de la solicitud de ${nombreCliente}. Esta acción es definitiva.`}
            </p>

            <label className="block text-xs font-bold text-slate-400 uppercase mb-2">
              {esPreAprobar ? 'Notas de verificación *' : 'Motivo del rechazo *'}
            </label>
            <textarea
              value={notas}
              onChange={e => setNotas(e.target.value)}
              placeholder={esPreAprobar
                ? 'Ej: Llamada realizada. Cliente confirmó datos, trabaja en local comercial propio...'
                : 'Ej: No fue posible contactar al cliente en 3 intentos. Datos no verificables...'}
              rows={4}
              className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-teal-500 resize-none"
            />

            {error && (
              <p className="text-red-400 text-xs mt-2">{error}</p>
            )}

            <div className="flex gap-3 mt-5">
              <button
                type="button"
                onClick={cerrarModal}
                className="flex-1 py-2.5 border border-slate-600 text-slate-400 hover:text-slate-200 rounded-xl text-sm font-medium transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmar}
                disabled={loading}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white transition-all ${
                  esPreAprobar
                    ? 'bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800'
                    : 'bg-red-700 hover:bg-red-600 disabled:bg-red-900'
                }`}
              >
                {loading
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : esPreAprobar ? 'Confirmar pre-aprobación' : 'Confirmar rechazo'
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
