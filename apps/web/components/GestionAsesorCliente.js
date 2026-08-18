'use client'

/* ==========================================================================
 * ARCHIVO: GestionAsesorCliente.js
 * RUTA: apps/web/components/GestionAsesorCliente.js
 * DESCRIPCIÓN: Gestión del asesor asignado a un cliente (ADMIN / SUPERVISOR).
 * FUNCIONALIDAD: Muestra el asesor actual y permite asignar, cambiar o quitar.
 *                Consume /api/supervisor/asignar-asesor (POST/DELETE). El asesor
 *                afectado recibe una notificación (la genera el backend).
 * ========================================================================== */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { UserCog, Loader2, ChevronDown, X, Check } from 'lucide-react'

export default function GestionAsesorCliente({ clienteId, asesorActual, asesores = [] }) {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  async function asignar(asesorId) {
    setCargando(true); setError('')
    try {
      const res = await fetch('/api/supervisor/asignar-asesor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clienteId, asesorId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'No se pudo asignar')
      setAbierto(false)
      router.refresh()
    } catch (e) { setError(e.message) }
    finally { setCargando(false) }
  }

  async function quitar() {
    setCargando(true); setError('')
    try {
      const res = await fetch('/api/supervisor/asignar-asesor', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clienteId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'No se pudo quitar')
      router.refresh()
    } catch (e) { setError(e.message) }
    finally { setCargando(false) }
  }

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
      <h2 className="font-semibold text-slate-300 mb-4 flex items-center gap-2 text-sm">
        <UserCog className="w-4 h-4 text-orange-400" /> Asesor asignado
      </h2>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          {asesorActual
            ? <p className="text-slate-200 font-medium text-sm">{asesorActual.nombre}</p>
            : <p className="text-slate-500 text-sm">Sin asesor asignado</p>}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <button onClick={() => setAbierto(v => !v)} disabled={cargando}
              className="inline-flex items-center gap-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all border border-indigo-500/20">
              {cargando ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserCog className="w-3 h-3" />}
              {asesorActual ? 'Cambiar' : 'Asignar'}
              <ChevronDown className="w-3 h-3" />
            </button>
            {abierto && (
              <div className="absolute right-0 top-full mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-20 min-w-[200px] max-h-64 overflow-y-auto">
                {asesores.length === 0 ? (
                  <p className="text-slate-500 text-xs px-4 py-3">No hay asesores disponibles.</p>
                ) : asesores.map((a) => (
                  <button key={a.id} onClick={() => asignar(a.id)}
                    className="w-full text-left px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-700 transition-colors flex items-center justify-between gap-2">
                    {a.nombre}
                    {asesorActual?.id === a.id && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {asesorActual && (
            <button onClick={quitar} disabled={cargando}
              className="inline-flex items-center gap-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all border border-red-500/20">
              <X className="w-3 h-3" /> Quitar
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
    </div>
  )
}
