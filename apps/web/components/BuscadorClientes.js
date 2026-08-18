'use client'

/* ==========================================================================
 * ARCHIVO: BuscadorClientes.js
 * RUTA: apps/web/components/BuscadorClientes.js
 * DESCRIPCIÓN: Barra buscadora de clientes reutilizable para el staff.
 * FUNCIONALIDAD: Busca (con debounce) en /api/staff/buscar y muestra un
 *                desplegable de resultados. Al elegir uno navega a la ficha del
 *                cliente del panel actual (`basePath/[id]`). Se embebe en cada
 *                sección para no depender de una única pantalla de búsqueda.
 * ========================================================================== */
import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Loader2, User, X } from 'lucide-react'
import { formatNombre } from '@/lib/nombre'
import { emailVisible } from '@/lib/email'

export default function BuscadorClientes({ basePath, accent = 'indigo', placeholder = 'Buscar cliente por nombre, cédula o celular…', onNavigate }) {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [resultados, setResultados] = useState([])
  const [abierto, setAbierto] = useState(false)
  const [cargando, setCargando] = useState(false)
  const boxRef = useRef(null)
  const debounceRef = useRef(null)

  const ring = accent === 'orange' ? 'focus:ring-orange-500' : accent === 'teal' ? 'focus:ring-teal-500' : 'focus:ring-indigo-500'

  // Cerrar al hacer click fuera
  useEffect(() => {
    function onClick(e) { if (boxRef.current && !boxRef.current.contains(e.target)) setAbierto(false) }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const buscar = useCallback(async (texto) => {
    if (!texto || texto.trim().length < 2) { setResultados([]); return }
    setCargando(true)
    try {
      const res = await fetch(`/api/staff/buscar?q=${encodeURIComponent(texto.trim())}`)
      const data = await res.json()
      setResultados(data.resultados ?? [])
      setAbierto(true)
    } catch { setResultados([]) }
    finally { setCargando(false) }
  }, [])

  const onChange = (v) => {
    setQ(v)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => buscar(v), 350)
  }

  const ir = (id) => {
    setAbierto(false); setQ('')
    onNavigate?.()
    router.push(`${basePath}/${id}`)
  }

  return (
    <div ref={boxRef} className="relative w-full">
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
      <input
        value={q}
        onChange={e => onChange(e.target.value)}
        onFocus={() => resultados.length && setAbierto(true)}
        placeholder={placeholder}
        className={`w-full bg-slate-800 border border-slate-700 text-slate-200 placeholder-slate-500 rounded-xl pl-11 pr-9 py-2.5 text-sm focus:outline-none focus:ring-2 ${ring} focus:border-transparent`}
      />
      {(cargando || q) && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2">
          {cargando ? <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
            : <button onClick={() => { setQ(''); setResultados([]); setAbierto(false) }} className="text-slate-500 hover:text-slate-300"><X className="w-4 h-4" /></button>}
        </span>
      )}

      {abierto && (
        <div className="absolute z-50 mt-2 w-full bg-slate-800 border border-slate-700 rounded-xl shadow-2xl shadow-black/40 overflow-hidden max-h-96 overflow-y-auto">
          {resultados.length === 0 ? (
            <p className="text-slate-500 text-sm px-4 py-3">{q.trim().length < 2 ? 'Escribe al menos 2 caracteres…' : 'Sin coincidencias.'}</p>
          ) : resultados.map((r) => {
            const credito = r.creditos?.find(c => ['ACTIVO', 'EN_MORA'].includes(c.estado_credito))
            const enMora = credito?.estado_credito === 'EN_MORA'
            return (
              <button key={r.id_cliente} onClick={() => ir(r.id_cliente)}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-700/50 text-left transition-colors">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 font-bold ${enMora ? 'bg-red-500/20 text-red-400' : 'bg-indigo-500/20 text-indigo-400'}`}>
                  {formatNombre(r)?.charAt(0)?.toUpperCase() || <User className="w-4 h-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-slate-200 text-sm font-medium truncate">{formatNombre(r)}</p>
                  <p className="text-slate-500 text-xs truncate">
                    CC {r.dni} · {r.telefono}{emailVisible(r.email) ? ` · ${emailVisible(r.email)}` : ''}
                  </p>
                </div>
                {enMora && <span className="text-red-400 text-xs font-semibold shrink-0">mora</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
