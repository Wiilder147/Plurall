'use client'

import { useState } from 'react'
import { UserCheck, Loader2, ChevronDown } from 'lucide-react'

export default function AsignarAsesorBtn({ clienteId, asesores }) {
  const [abierto,   setAbierto]   = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [exito,     setExito]     = useState(false)

  async function asignar(asesorId) {
    setGuardando(true)
    try {
      const res = await fetch('/api/supervisor/asignar-asesor', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ clienteId, asesorId }),
      })
      if (res.ok) {
        setExito(true)
        setAbierto(false)
        setTimeout(() => window.location.reload(), 800)
      }
    } finally {
      setGuardando(false)
    }
  }

  if (exito) return <span className="text-emerald-400 text-xs font-semibold">✓ Asignado</span>

  return (
    <div className="relative">
      <button
        onClick={() => setAbierto(!abierto)}
        disabled={guardando}
        className="inline-flex items-center gap-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all border border-indigo-500/20"
      >
        {guardando ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserCheck className="w-3 h-3" />}
        Asignar
        <ChevronDown className="w-3 h-3" />
      </button>

      {abierto && (
        <div className="absolute right-0 top-full mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-10 min-w-[180px] overflow-hidden">
          {asesores.map((a) => (
            <button key={a.id} onClick={() => asignar(a.id)}
              className="w-full text-left px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-700 transition-colors">
              {a.nombre}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
