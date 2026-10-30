'use client'

import 'leaflet/dist/leaflet.css'
import { useState, useEffect, useRef } from 'react'
import { geocodificarDireccion } from '@/lib/geocodificacion'
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet'
import L from 'leaflet'
import { ChevronDown, Navigation, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

delete L.Icon.Default.prototype._getIconUrl

const markerIcon = L.divIcon({
  html: `<div style="
    width:22px;height:22px;background:#f97316;border:3px solid #fff;
    border-radius:50% 50% 50% 0;transform:rotate(-45deg);
    box-shadow:0 2px 8px rgba(0,0,0,.35)"></div>`,
  className:   '',
  iconSize:    [22, 22],
  iconAnchor:  [11, 22],
  popupAnchor: [0, -22],
})

const COLOMBIA_CENTER = [4.5709, -74.2973]

const DEPARTAMENTOS = [
  'Amazonas','Antioquia','Arauca','Atlántico','Bolívar','Boyacá','Caldas',
  'Caquetá','Casanare','Cauca','Cesar','Chocó','Córdoba','Cundinamarca',
  'Guainía','Guaviare','Huila','La Guajira','Magdalena','Meta','Nariño',
  'Norte de Santander','Putumayo','Quindío','Risaralda',
  'San Andrés y Providencia','Santander','Sucre','Tolima',
  'Valle del Cauca','Vaupés','Vichada','Bogotá D.C.',
]

function normalizarDepto(raw) {
  if (!raw) return ''
  const clean = raw.replace(/^Departamento\s+de\s+/i, '').trim()
  if (/bogot[aá]/i.test(clean)) return 'Bogotá D.C.'
  const exact = DEPARTAMENTOS.find(d => d.toLowerCase() === clean.toLowerCase())
  if (exact) return exact
  return DEPARTAMENTOS.find(d =>
    d.toLowerCase().includes(clean.toLowerCase()) ||
    clean.toLowerCase().includes(d.toLowerCase())
  ) ?? ''
}

async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1&accept-language=es`,
      { headers: { 'User-Agent': 'Plurall-Web/1.0' } },
    )
    if (!res.ok) return null
    const data = await res.json()
    const addr = data.address ?? {}

    const depto   = normalizarDepto(addr.state ?? '')
    const ciudad  = addr.city ?? addr.town ?? addr.municipality ?? addr.village ?? addr.county ?? ''

    const vias    = [addr.road, addr.house_number].filter(Boolean).join(' # ')
    const barrio  = addr.neighbourhood ?? addr.suburb ?? ''
    const direccion = [vias, barrio].filter(Boolean).join(', ')

    return { depto, ciudad, direccion }
  } catch {
    return null
  }
}

function MapClickHandler({ onClick }) {
  useMapEvents({ click: (e) => onClick([e.latlng.lat, e.latlng.lng]) })
  return null
}

function MapController({ position }) {
  const map = useMap()
  useEffect(() => {
    if (position) map.flyTo(position, 16, { duration: 0.8 })
  }, [map, position])
  return null
}

export default function LocationPicker({ value, onChange }) {
  const parsed = (() => { try { return JSON.parse(value ?? 'null') } catch { return null } })()

  const [depto,      setDepto]      = useState(parsed?.departamento ?? '')
  const [ciudad,     setCiudad]     = useState(parsed?.ciudad       ?? '')
  const [direccion,  setDireccion]  = useState(parsed?.direccion    ?? '')
  const [position,   setPosition]   = useState(
    parsed?.lat && parsed?.lng ? [parsed.lat, parsed.lng] : null,
  )
  const [geoLoading,  setGeoLoading]  = useState(false)
  const [geoError,    setGeoError]    = useState('')
  const [geocoding,   setGeocoding]   = useState(false)
  const [avisoMapa,   setAvisoMapa]   = useState('')

  // Catálogo de municipios (DANE) para autocompletar ciudad de forma canónica.
  // Se mantiene el input libre (la geocodificación del mapa sigue funcionando),
  // pero el datalist sugiere los nombres oficiales del departamento elegido.
  const [muniPorDepto, setMuniPorDepto] = useState({})
  useEffect(() => {
    let activo = true
    createClient()
      .from('municipio')
      .select('nombre, departamento(nombre)')
      .eq('activo', true)
      .order('nombre')
      .then(({ data }) => {
        if (!activo || !data) return
        const mapa = {}
        for (const m of data) {
          const dep = m.departamento?.nombre
          if (!dep) continue
          ;(mapa[dep] ??= []).push(m.nombre)
        }
        setMuniPorDepto(mapa)
      })
    return () => { activo = false }
  }, [])
  const municipiosDepto = muniPorDepto[depto] ?? []

  // Desplegable propio de departamento (reemplaza el <select> nativo para que
  // el listado se abra ABAJO y con el diseño de la página, no el del navegador)
  const [deptoOpen, setDeptoOpen] = useState(false)
  const deptoRef = useRef(null)
  useEffect(() => {
    if (!deptoOpen) return
    function handleClickFuera(e) {
      if (deptoRef.current && !deptoRef.current.contains(e.target)) setDeptoOpen(false)
    }
    document.addEventListener('mousedown', handleClickFuera)
    return () => document.removeEventListener('mousedown', handleClickFuera)
  }, [deptoOpen])

  // Autocompletado propio de ciudad (reemplaza el <datalist> nativo). Mantiene
  // texto libre y sugiere municipios del departamento filtrando por lo escrito.
  const [ciudadOpen, setCiudadOpen] = useState(false)
  const ciudadRef = useRef(null)
  useEffect(() => {
    if (!ciudadOpen) return
    function handleClickFuera(e) {
      if (ciudadRef.current && !ciudadRef.current.contains(e.target)) setCiudadOpen(false)
    }
    document.addEventListener('mousedown', handleClickFuera)
    return () => document.removeEventListener('mousedown', handleClickFuera)
  }, [ciudadOpen])
  const ciudadesSugeridas = municipiosDepto.filter(
    m => m.toLowerCase().includes(ciudad.trim().toLowerCase()),
  )

  // Build and emit the full object, overrides take precedence over stale state
  function emit(overrides = {}) {
    onChange(JSON.stringify({
      departamento: depto,
      ciudad,
      direccion,
      lat: position?.[0] ?? null,
      lng: position?.[1] ?? null,
      ...overrides,
    }))
  }

  async function applyCoords(pos) {
    setPosition(pos)
    setGeocoding(true)
    const geo = await reverseGeocode(pos[0], pos[1])
    setGeocoding(false)

    if (geo) {
      if (geo.depto)    setDepto(geo.depto)
      if (geo.ciudad)   setCiudad(geo.ciudad)
      if (geo.direccion) setDireccion(geo.direccion)
      emit({
        lat:          pos[0],
        lng:          pos[1],
        departamento: geo.depto    || depto,
        ciudad:       geo.ciudad   || ciudad,
        direccion:    geo.direccion || direccion,
      })
    } else {
      emit({ lat: pos[0], lng: pos[1] })
    }
  }

  // C-03: ubicar en el mapa la dirección escrita (al salir del campo)
  async function ubicarDireccionEscrita() {
    if (!direccion.trim() || !ciudad.trim()) return
    setGeocoding(true)
    setAvisoMapa('')
    const r = await geocodificarDireccion({ direccion, ciudad, depto })
    setGeocoding(false)
    if (!r) {
      setAvisoMapa('No pudimos ubicar la dirección. Marca la ubicación tocando el mapa.')
      return
    }
    setPosition([r.lat, r.lng])
    emit({ lat: r.lat, lng: r.lng })
    if (r.precision === 'ciudad') {
      setAvisoMapa('No encontramos la dirección exacta: ubicamos la ciudad. Ajusta el pin sobre tu dirección.')
    }
  }

  function handleGeolocate() {
    if (!navigator.geolocation) {
      setGeoError('Tu navegador no soporta geolocalización.')
      return
    }
    setGeoLoading(true)
    setGeoError('')
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setGeoLoading(false)
        applyCoords([coords.latitude, coords.longitude])
      },
      (err) => {
        setGeoLoading(false)
        if (err.code === 1)
          setGeoError('Permiso denegado. Activa la ubicación en tu navegador e intenta de nuevo.')
        else if (err.code === 2)
          setGeoError('No se pudo obtener la ubicación. Verifica tu conexión o GPS.')
        else
          setGeoError('Tiempo agotado al obtener la ubicación. Intenta de nuevo.')
      },
      { timeout: 15000, enableHighAccuracy: true, maximumAge: 0 },
    )
  }

  return (
    <div className="space-y-3">
      {/* Departamento — desplegable propio (no nativo): se abre abajo y con el diseño de la página */}
      <div className="relative" ref={deptoRef}>
        {/* BOTÓN/DISPARADOR — mismos estilos que un input (borde gris, rounded-xl, foco naranja) */}
        <button
          type="button"
          onClick={() => setDeptoOpen(o => !o)}
          className={`w-full flex items-center justify-between border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-left bg-white focus:outline-none focus:ring-2 focus:ring-orange-400 ${
            depto ? 'text-slate-900' : 'text-slate-400'
          }`}>
          <span className="truncate">{depto || '— Departamento —'}</span>
          <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${deptoOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* PANEL DEL LISTADO — absolute debajo del botón, z alto para quedar sobre el mapa */}
        {deptoOpen && (
          <ul className="absolute left-0 top-full mt-1 w-full max-h-60 overflow-auto bg-white border border-slate-200 rounded-xl shadow-lg z-[1000] py-1 animate-fade-in">
            {DEPARTAMENTOS.map(d => (
              <li key={d}>
                <button
                  type="button"
                  onClick={() => { setDepto(d); emit({ departamento: d }); setDeptoOpen(false) }}
                  className={`w-full text-left px-4 py-2 text-sm transition-colors hover:bg-orange-50 ${
                    depto === d ? 'text-orange-600 font-semibold bg-orange-50' : 'text-slate-700'
                  }`}>
                  {d}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Ciudad — autocompletado propio (no nativo): sugerencias abajo con el diseño de la página */}
      <div className="relative" ref={ciudadRef}>
        <input
          type="text"
          placeholder={depto ? 'Ciudad o municipio' : 'Elige primero el departamento'}
          value={ciudad}
          autoComplete="off"
          onChange={e => { setCiudad(e.target.value); emit({ ciudad: e.target.value }); setCiudadOpen(true) }}
          onFocus={() => setCiudadOpen(true)}
          className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
        {geocoding && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-orange-400 animate-spin" />}

        {/* PANEL DE SUGERENCIAS — solo si hay departamento y coincidencias */}
        {ciudadOpen && ciudadesSugeridas.length > 0 && (
          <ul className="absolute left-0 top-full mt-1 w-full max-h-60 overflow-auto bg-white border border-slate-200 rounded-xl shadow-lg z-[1000] py-1 animate-fade-in">
            {ciudadesSugeridas.map(m => (
              <li key={m}>
                <button
                  type="button"
                  onClick={() => { setCiudad(m); emit({ ciudad: m }); setCiudadOpen(false) }}
                  className={`w-full text-left px-4 py-2 text-sm transition-colors hover:bg-orange-50 ${
                    ciudad === m ? 'text-orange-600 font-semibold bg-orange-50' : 'text-slate-700'
                  }`}>
                  {m}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Dirección */}
      <input
        type="text"
        placeholder="Ej: Calle 50 # 45-10, Barrio El Centro"
        value={direccion}
        onChange={e => { setDireccion(e.target.value); emit({ direccion: e.target.value }) }}
        onBlur={ubicarDireccionEscrita}
        className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-400"
      />

      {avisoMapa && <p className="text-xs text-amber-600 -mt-1">{avisoMapa}</p>}

      {geocoding && (
        <p className="text-xs text-orange-500 flex items-center gap-1.5 -mt-1">
          <Loader2 className="w-3 h-3 animate-spin" /> Obteniendo dirección desde el mapa…
        </p>
      )}

      {/* Mini-mapa */}
      <div className="rounded-xl overflow-hidden border border-slate-200">
        <div className="flex flex-col bg-slate-50 border-b border-slate-200">
          <div className="flex items-center justify-between px-4 py-2 text-xs text-slate-500">
            <span>Toca el mapa o arrastra el pin para marcar la ubicación</span>
            <button
              type="button"
              onClick={handleGeolocate}
              disabled={geoLoading || geocoding}
              className="flex items-center gap-1 text-orange-500 font-semibold hover:text-orange-400 disabled:opacity-50 ml-3 shrink-0">
              {geoLoading
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Localizando…</>
                : <><Navigation className="w-3.5 h-3.5" /> Mi ubicación</>
              }
            </button>
          </div>
          {geoError && (
            <p className="text-xs text-red-500 px-4 pb-2 -mt-1">{geoError}</p>
          )}
        </div>

        <MapContainer
          center={position ?? COLOMBIA_CENTER}
          zoom={position ? 15 : 5}
          style={{ height: 240 }}
          scrollWheelZoom={false}>
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />
          <MapClickHandler onClick={pos => applyCoords(pos)} />
          <MapController   position={position} />
          {position && (
            <Marker
              position={position}
              icon={markerIcon}
              draggable
              eventHandlers={{
                dragend: (e) => applyCoords([e.target.getLatLng().lat, e.target.getLatLng().lng]),
              }}
            />
          )}
        </MapContainer>

        {position && (
          <p className="text-center text-xs text-slate-400 py-1.5 bg-slate-50 border-t border-slate-200">
            {position[0].toFixed(5)}, {position[1].toFixed(5)}
          </p>
        )}
      </div>
    </div>
  )
}
