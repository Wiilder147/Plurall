'use client'

/* ==========================================================================
 * ARCHIVO: GestionMotivos.js
 * RUTA: apps/web/app/supervisor/motivos-rechazo/GestionMotivos.js
 * DESCRIPCIÓN: Gestión cliente del catálogo de motivos de rechazo.
 * FUNCIONALIDAD: Formulario para crear motivos y toggle para activar/desactivar.
 *                Consume /api/supervisor/motivos.
 * ========================================================================== */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Loader2, Check, X } from 'lucide-react'
import { validarTextoLibre, REGLAS_TEXTO } from '@/lib/validacion'

export default function GestionMotivos({ motivosIniciales }) {
  const router = useRouter()
  const [descripcion, setDescripcion] = useState('')
  const [visibleCliente, setVisibleCliente] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  // M-10: edición en línea del nombre y la visibilidad
  const [editando, setEditando] = useState(null) // { id_motivo, descripcion, visible }
  const [errorEdicion, setErrorEdicion] = useState('')

  const crear = async (e) => {
    e.preventDefault()
    if (!descripcion.trim()) return
    const errorTexto = validarTextoLibre(descripcion, REGLAS_TEXTO.motivoCatalogo)
    if (errorTexto) { setError(errorTexto); return }
    setCargando(true); setError('')
    try {
      const res = await fetch('/api/supervisor/motivos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ descripcion_motivo: descripcion, visible_cliente: visibleCliente }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Error al crear')
      setDescripcion('')
      router.refresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setCargando(false)
    }
  }

  const guardarEdicion = async () => {
    const errorTexto = validarTextoLibre(editando.descripcion, REGLAS_TEXTO.motivoCatalogo)
    if (errorTexto) { setErrorEdicion(errorTexto); return }
    const res = await fetch('/api/supervisor/motivos', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_motivo: editando.id_motivo, descripcion_motivo: editando.descripcion, visible_cliente: editando.visible }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { setErrorEdicion(data?.error || 'No se pudo guardar'); return }
    setEditando(null); setErrorEdicion('')
    router.refresh()
  }

  const toggle = async (id_motivo, activo) => {
    await fetch('/api/supervisor/motivos', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_motivo, activo: !activo }),
    })
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Formulario de creación */}
      <form onSubmit={crear} className="bg-slate-800 border border-slate-700 rounded-2xl p-5 flex flex-col gap-3">
        <label className="text-sm font-semibold text-slate-200">Nuevo motivo de rechazo</label>
        <input
          type="text"
          maxLength={REGLAS_TEXTO.motivoCatalogo.max}
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder="Ej: Capacidad de pago insuficiente"
          className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
        />
        <div className="flex items-center justify-between flex-wrap gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-400">
            <input type="checkbox" checked={visibleCliente} onChange={(e) => setVisibleCliente(e.target.checked)} className="accent-indigo-500" />
            Visible para el cliente
          </label>
          <button type="submit" disabled={cargando}
            className="inline-flex items-center gap-2 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
            {cargando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Agregar motivo
          </button>
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </form>

      {/* Lista de motivos */}
      {motivosIniciales.length === 0 ? (
        <p className="text-slate-400 text-sm text-center py-10">No hay motivos registrados todavía.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {motivosIniciales.map((m) => (
            <div key={m.id_motivo} className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex items-center justify-between gap-4">
              {editando?.id_motivo === m.id_motivo ? (
                <div className="flex-1 flex flex-col gap-2 min-w-0">
                  <input
                    type="text"
                    maxLength={REGLAS_TEXTO.motivoCatalogo.max}
                    value={editando.descripcion}
                    onChange={(e) => setEditando({ ...editando, descripcion: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-600 text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <label className="flex items-center gap-2 text-xs text-slate-400">
                    <input type="checkbox" checked={editando.visible} onChange={(e) => setEditando({ ...editando, visible: e.target.checked })} className="accent-indigo-500" />
                    Visible para el cliente
                  </label>
                  {errorEdicion && <p className="text-xs text-red-400">{errorEdicion}</p>}
                  <div className="flex gap-2">
                    <button onClick={guardarEdicion} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-indigo-500 text-white">Guardar</button>
                    <button onClick={() => { setEditando(null); setErrorEdicion('') }} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-700 text-slate-300">Cancelar</button>
                  </div>
                </div>
              ) : (
              <div className="min-w-0">
                <p className={`text-sm font-medium ${m.activo ? 'text-slate-200' : 'text-slate-500 line-through'}`}>{m.descripcion_motivo}</p>
                <div className="flex gap-2 mt-1">
                  {m.visible_cliente && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400">Visible al cliente</span>}
                  <span className={`text-xs px-2 py-0.5 rounded-full ${m.activo ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-500/10 text-slate-400'}`}>
                    {m.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
              </div>
              )}
              <div className="shrink-0 flex gap-2">
              {editando?.id_motivo !== m.id_motivo && (
                <button onClick={() => { setEditando({ id_motivo: m.id_motivo, descripcion: m.descripcion_motivo, visible: !!m.visible_cliente }); setErrorEdicion('') }}
                  className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors">
                  Editar
                </button>
              )}
              <button onClick={() => toggle(m.id_motivo, m.activo)}
                className={`shrink-0 inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                  m.activo ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20' : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                }`}>
                {m.activo ? <><X className="w-3 h-3" /> Desactivar</> : <><Check className="w-3 h-3" /> Activar</>}
              </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
