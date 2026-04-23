'use client'

import { useState, useRef } from 'react'
import { Search, MapPin, X, Loader2 } from 'lucide-react'

/**
 * Campo de dirección con búsqueda Nominatim y mini-mapa OSM.
 * Props:
 *  label       – Etiqueta visible
 *  value       – { texto, latitud, longitud, ciudad, departamento }
 *  onChange    – fn({ texto, latitud, longitud, ciudad, departamento })
 *  required    – boolean
 *  placeholder – string
 */
export default function AddressField({
  label,
  value,
  onChange,
  required = false,
  placeholder = 'Escribe la dirección…',
}) {
  const [query,       setQuery]       = useState(value?.texto || '')
  const [results,     setResults]     = useState([])
  const [searching,   setSearching]   = useState(false)
  const [showResults, setShowResults] = useState(false)
  const debounceRef = useRef(null)

  const confirmed = Boolean(value?.latitud && value?.longitud)

  const mapSrc = confirmed
    ? `https://www.openstreetmap.org/export/embed.html` +
      `?bbox=${value.longitud - 0.006},${value.latitud - 0.005},${value.longitud + 0.006},${value.latitud + 0.005}` +
      `&layer=mapnik&marker=${value.latitud},${value.longitud}`
    : null

  async function buscar(q) {
    if (!q || q.trim().length < 4) { setResults([]); setShowResults(false); return }
    setSearching(true)
    try {
      const url =
        `https://nominatim.openstreetmap.org/search` +
        `?format=json&q=${encodeURIComponent(q + ' Colombia')}` +
        `&countrycodes=co&limit=6&addressdetails=1`
      const res  = await fetch(url, {
        headers: { 'Accept-Language': 'es', 'User-Agent': 'Plurall/1.0' },
      })
      const data = await res.json()
      setResults(data || [])
      setShowResults(true)
    } catch {
      setResults([])
    }
    setSearching(false)
  }

  function handleInput(e) {
    const v = e.target.value
    setQuery(v)
    onChange({ texto: v, latitud: null, longitud: null, ciudad: '', departamento: '' })
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => buscar(v), 600)
  }

  function handleSelect(item) {
    const addr        = item.address || {}
    const ciudad      = addr.city || addr.town || addr.village || addr.municipality || addr.county || ''
    const departamento = addr.state || ''
    const texto       = item.display_name
    onChange({ texto, latitud: parseFloat(item.lat), longitud: parseFloat(item.lon), ciudad, departamento })
    setQuery(texto)
    setShowResults(false)
    setResults([])
  }

  function handleClear() {
    onChange({ texto: '', latitud: null, longitud: null, ciudad: '', departamento: '' })
    setQuery('')
    setResults([])
    setShowResults(false)
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Etiqueta */}
      <label className="text-base font-semibold text-slate-700 flex items-center gap-1.5">
        <MapPin className="w-4 h-4 text-orange-500 shrink-0" />
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>

      {/* Input + botón buscar */}
      <div className="relative">
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={handleInput}
            onFocus={() => results.length > 0 && setShowResults(true)}
            onBlur={() => setTimeout(() => setShowResults(false), 220)}
            placeholder={placeholder}
            className="flex-1 border border-slate-200 rounded-xl px-4 py-3 text-base text-slate-700
                       placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-400 transition-shadow"
            autoComplete="off"
          />
          <button
            type="button"
            onClick={() => buscar(query)}
            disabled={searching}
            className="px-4 py-3 bg-slate-900 text-white rounded-xl hover:bg-slate-700
                       transition-colors disabled:opacity-50 flex items-center gap-2 text-sm font-semibold shrink-0"
          >
            {searching
              ? <Loader2 className="w-5 h-5 animate-spin" />
              : <><Search className="w-5 h-5" /><span className="hidden sm:inline">Buscar</span></>
            }
          </button>
        </div>

        {/* Dropdown de resultados */}
        {showResults && results.length > 0 && (
          <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-white border border-slate-200
                          rounded-xl shadow-2xl overflow-hidden">
            <p className="px-4 py-2 text-xs text-slate-400 bg-slate-50 border-b border-slate-100">
              Selecciona la dirección correcta:
            </p>
            {results.map((r, i) => (
              <button
                key={i}
                type="button"
                onMouseDown={() => handleSelect(r)}
                className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-orange-50
                           flex items-start gap-2 border-b border-slate-100 last:border-b-0 transition-colors"
              >
                <MapPin className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                <span className="line-clamp-2 leading-snug">{r.display_name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Mini-mapa cuando hay coordenadas confirmadas */}
      {confirmed && (
        <div className="rounded-xl overflow-hidden border-2 border-orange-200 shadow-md mt-1">
          {/* Cabecera de confirmación */}
          <div className="flex items-center justify-between px-3 py-2 bg-orange-50 border-b border-orange-100">
            <span className="text-sm font-semibold text-orange-700 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-orange-500 shrink-0" />
              Ubicación confirmada
              {value.ciudad ? ` — ${value.ciudad}${value.departamento ? `, ${value.departamento}` : ''}` : ''}
            </span>
            <button
              type="button"
              onClick={handleClear}
              className="text-xs text-slate-400 hover:text-red-500 flex items-center gap-1 ml-2 shrink-0 transition-colors font-medium"
            >
              <X className="w-3.5 h-3.5" /> Cambiar
            </button>
          </div>

          {/* Mapa OSM embebido */}
          <iframe
            src={mapSrc}
            width="100%"
            height="220"
            style={{ border: 0, display: 'block' }}
            loading="lazy"
            title={`Mapa: ${label}`}
            referrerPolicy="no-referrer-when-downgrade"
          />

          {/* Texto dirección completa */}
          <div className="px-3 py-2 bg-white border-t border-slate-100">
            <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">{value.texto}</p>
          </div>
        </div>
      )}

      {/* Sugerencia cuando se escribió pero no se confirmó */}
      {!confirmed && query.trim().length >= 4 && (
        <p className="text-sm text-slate-500 flex items-center gap-1.5 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
          <Search className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          Dirección escrita. Pulse <strong>Buscar</strong> y seleccione del listado para confirmar en el mapa.
        </p>
      )}
    </div>
  )
}
