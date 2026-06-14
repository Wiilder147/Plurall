'use client'

/* ==========================================================================
 * ARCHIVO: BotonDesembolsar.js
 * RUTA: apps/web/app/supervisor/desembolsos/BotonDesembolsar.js
 * DESCRIPCIÓN: Botón cliente para ejecutar el desembolso de una solicitud.
 * FUNCIONALIDAD: Llama a POST /api/admin/desembolsar/:id (crea crédito, plan y
 *                cuotas) y refresca la lista. Pide confirmación antes.
 * ========================================================================== */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Banknote, Loader2 } from 'lucide-react'

export default function BotonDesembolsar({ solicitudId, nombreCliente }) {
  const router = useRouter()
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  const desembolsar = async () => {
    if (!confirm(`¿Confirmas el desembolso del crédito de ${nombreCliente}? Esta acción crea el crédito y su plan de pagos.`)) return
    setCargando(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/desembolsar/${solicitudId}`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'No se pudo desembolsar')
      router.refresh()
    } catch (e) {
      setError(e.message)
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={desembolsar}
        disabled={cargando}
        className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
      >
        {cargando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Banknote className="w-4 h-4" />}
        {cargando ? 'Desembolsando…' : 'Desembolsar'}
      </button>
      {error && <p className="text-xs text-red-400 max-w-[200px] text-right">{error}</p>}
    </div>
  )
}
