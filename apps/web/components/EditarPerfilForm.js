'use client'

/* ==========================================================================
 * ARCHIVO: EditarPerfilForm.js
 * RUTA: apps/web/components/EditarPerfilForm.js
 * DESCRIPCIÓN: Componente de interfaz de usuario (UI) reutilizable.
 * FUNCIONALIDAD: Este archivo define la lógica y estructura para su respectivo módulo.
 * ========================================================================== */

import { useState } from 'react'
import {
  Pencil, X, Check, Loader2, Phone, MapPin,
  Building2, Store, Calendar, AlertCircle,
} from 'lucide-react'

/**
 * Formulario de edición de perfil del cliente.
 * Se monta dentro del Server Component de perfil como isla interactiva.
 */
export default function EditarPerfilForm({ cliente }) {
  const [abierto,    setAbierto]    = useState(false)
  const [guardando,  setGuardando]  = useState(false)
  const [exito,      setExito]      = useState(false)
  const [error,      setError]      = useState('')

  const [form, setForm] = useState({
    telefono:                  cliente?.telefono                  ?? '',
    direccion:                 cliente?.direccion                 ?? '',
    ciudad:                    cliente?.ciudad                    ?? '',
    departamento:              cliente?.departamento              ?? '',
    nombre_negocio:            cliente?.nombre_negocio            ?? '',
    descripcion_negocio:       cliente?.descripcion_negocio       ?? '',
    antiguedad_negocio_meses:  cliente?.antiguedad_negocio_meses  ?? '',
  })

  function handleChange(e) {
    const { name, value } = e.target
    let sanitized = value
    if (name === 'telefono') sanitized = value.replace(/\D/g, '')
    if (name === 'ciudad' || name === 'departamento') sanitized = value.replace(/[0-9]/g, '')
    setForm(prev => ({ ...prev, [name]: sanitized }))
    setError('')
    setExito(false)
  }

  async function handleGuardar(e) {
    e.preventDefault()
    setGuardando(true)
    setError('')
    setExito(false)

    try {
      const res = await fetch('/api/perfil', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          ...form,
          antiguedad_negocio_meses: form.antiguedad_negocio_meses
            ? parseInt(form.antiguedad_negocio_meses)
            : null,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Error al guardar los cambios.')
      } else {
        setExito(true)
        setAbierto(false)
        // Recargar la página para reflejar los cambios del Server Component
        setTimeout(() => window.location.reload(), 600)
      }
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  // ── Botón de apertura ────────────────────────────────────────
  if (!abierto) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          ¿Necesitas actualizar tu teléfono, dirección o datos del negocio?
        </p>
        <button
          onClick={() => setAbierto(true)}
          className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition-all whitespace-nowrap"
        >
          <Pencil className="w-4 h-4" /> Editar mis datos
        </button>
      </div>
    )
  }

  // ── Formulario ───────────────────────────────────────────────
  return (
    <div className="bg-white border border-orange-200 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-bold text-slate-900 flex items-center gap-2">
          <Pencil className="w-4 h-4 text-orange-500" /> Editar mis datos
        </h3>
        <button
          onClick={() => setAbierto(false)}
          className="text-slate-400 hover:text-slate-600 transition-colors"
          aria-label="Cerrar"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-5 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      <form onSubmit={handleGuardar} className="flex flex-col gap-5">

        {/* Contacto */}
        <fieldset className="border border-slate-100 rounded-xl p-4">
          <legend className="text-xs font-semibold text-slate-400 uppercase tracking-wide px-2">
            Contacto
          </legend>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
            <Campo
              icon={Phone} label="Teléfono (10 dígitos)"
              name="telefono" value={form.telefono}
              onChange={handleChange} maxLength={10}
              inputMode="numeric"
              placeholder="3001234567"
            />
            <Campo
              icon={MapPin} label="Dirección"
              name="direccion" value={form.direccion}
              onChange={handleChange}
              placeholder="Calle 10 # 5-20"
            />
            <Campo
              icon={Building2} label="Ciudad"
              name="ciudad" value={form.ciudad}
              onChange={handleChange}
              placeholder="Bogotá"
            />
            <Campo
              icon={MapPin} label="Departamento"
              name="departamento" value={form.departamento}
              onChange={handleChange}
              placeholder="Cundinamarca"
            />
          </div>
        </fieldset>

        {/* Negocio */}
        <fieldset className="border border-slate-100 rounded-xl p-4">
          <legend className="text-xs font-semibold text-slate-400 uppercase tracking-wide px-2">
            Negocio
          </legend>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
            <Campo
              icon={Store} label="Nombre del negocio"
              name="nombre_negocio" value={form.nombre_negocio}
              onChange={handleChange}
              placeholder="Tienda La Esperanza"
            />
            <Campo
              icon={Calendar} label="Antigüedad (meses)"
              name="antiguedad_negocio_meses" value={form.antiguedad_negocio_meses}
              onChange={handleChange} type="number" min="0"
              placeholder="24"
            />
            <div className="md:col-span-2">
              <label className="text-xs font-medium text-slate-500 flex items-center gap-1.5 mb-1.5 uppercase tracking-wide">
                <Store className="w-3.5 h-3.5" /> Descripción del negocio
              </label>
              <textarea
                name="descripcion_negocio"
                value={form.descripcion_negocio}
                onChange={handleChange}
                rows={2}
                placeholder="Venta de abarrotes y productos de primera necesidad..."
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
              />
            </div>
          </div>
        </fieldset>

        {/* Acciones */}
        <div className="flex items-center gap-3 justify-end">
          <button
            type="button"
            onClick={() => setAbierto(false)}
            className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-all"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={guardando}
            className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-semibold text-sm px-6 py-2.5 rounded-xl transition-all"
          >
            {guardando
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando…</>
              : <><Check className="w-4 h-4" /> Guardar cambios</>
            }
          </button>
        </div>
      </form>
    </div>
  )
}

// ── Campo reutilizable ───────────────────────────────────────────────────────
function Campo({ icon: Icon, label, name, value, onChange, type = 'text', ...rest }) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-500 flex items-center gap-1.5 mb-1.5 uppercase tracking-wide">
        <Icon className="w-3.5 h-3.5" /> {label}
      </label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-400"
        {...rest}
      />
    </div>
  )
}
