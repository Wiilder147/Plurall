'use client'

import 'leaflet/dist/leaflet.css'
import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet'
import L from 'leaflet'
import { ChevronDown, Navigation, Loader2 } from 'lucide-react'

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
      {/* Departamento */}
      <div className="relative">
        <select
          value={depto}
          onChange={e => { setDepto(e.target.value); emit({ departamento: e.target.value }) }}
          className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 appearance-none focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white">
          <option value="">— Departamento —</option>
          {DEPARTAMENTOS.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
      </div>

      {/* Ciudad */}
      <div className="relative">
        <input
          type="text"
          placeholder="Ciudad o municipio"
          value={ciudad}
          onChange={e => { setCiudad(e.target.value); emit({ ciudad: e.target.value }) }}
          className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
        {geocoding && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-orange-400 animate-spin" />}
      </div>

      {/* Dirección */}
      <input
        type="text"
        placeholder="Ej: Calle 50 # 45-10, Barrio El Centro"
        value={direccion}
        onChange={e => { setDireccion(e.target.value); emit({ direccion: e.target.value }) }}
        className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-400"
      />

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
