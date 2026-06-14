'use client'

/* ==========================================================================
 * ARCHIVO: CambiarCelular.js
 * RUTA: apps/web/components/CambiarCelular.js
 * DESCRIPCIÓN: Edición en línea del celular de un cliente (staff).
 * FUNCIONALIDAD: Muestra el celular actual con un botón de edición; al guardar
 *                llama a PATCH /api/admin/cliente/:id/celular y refresca.
 *                Recuerda: el celular es el usuario de acceso del cliente.
 * ========================================================================== */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Phone, Pencil, Check, X, Loader2 } from 'lucide-react'

export default function CambiarCelular({ idCliente, celularActual }) {
  const router = useRouter()
  const [editando, setEditando] = useState(false)
  const [valor, setValor] = useState(celularActual || '')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  const guardar = async () => {
    const cel = valor.replace(/\D/g, '')
    if (cel.length !== 10) { setError('Debe tener 10 dígitos'); return }
    setCargando(true); setError('')
    try {
      const res = await fetch(`/api/admin/cliente/${idCliente}/celular`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ celular: cel }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Error')
      setEditando(false)
      router.refresh()
    } catch (e) {
      setError(e.message)
    } finally {
      setCargando(false)
    }
  }

  if (!editando) {
    return (
      <button onClick={() => { setValor(celularActual || ''); setError(''); setEditando(true) }}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white bg-slate-700/60 hover:bg-slate-700 px-2.5 py-1 rounded-lg transition-colors"
        title="Cambiar el celular (acceso) del cliente">
        <Phone className="w-3 h-3" /> {celularActual || '—'} <Pencil className="w-3 h-3" />
      </button>
    )
  }

  return (
    <div className="inline-flex flex-col gap-1">
      <div className="inline-flex items-center gap-1.5">
        <input value={valor} onChange={(e) => setValor(e.target.value.replace(/\D/g, '').slice(0, 10))}
          inputMode="numeric" placeholder="Nuevo celular"
          className="w-32 bg-slate-900 border border-slate-600 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-indigo-500" />
        <button onClick={guardar} disabled={cargando}
          className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg p-1.5 disabled:opacity-60">
          {cargando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
        </button>
        <button onClick={() => { setEditando(false); setError('') }} className="text-slate-500 hover:text-slate-300 p-1">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      {error && <p className="text-red-400 text-xs">{error}</p>}
    </div>
  )
}
