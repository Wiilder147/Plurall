'use client'

/* ==========================================================================
 * ARCHIVO: page.js
 * RUTA: apps/web/app/admin/usuarios/page.js
 * DESCRIPCIÓN: Módulo del ADMIN para crear y ver usuarios de staff.
 * FUNCIONALIDAD: Formulario para crear asesores/supervisores (login por celular)
 *                y listado de los existentes. Consume /api/admin/usuarios.
 * ========================================================================== */
import { useState, useEffect, useCallback } from 'react'
import { UserPlus, Loader2, ShieldCheck, Headset, CheckCircle2, AlertCircle, Phone } from 'lucide-react'
import { formatNombre } from '@/lib/nombre'

const FORM_INICIAL = {
  primer_nombre: '', segundo_nombre: '', primer_apellido: '', segundo_apellido: '',
  celular: '', email: '', password: '', rol: 'ASESOR',
}

export default function AdminUsuariosPage() {
  const [usuarios, setUsuarios] = useState([])
  const [cargando, setCargando] = useState(true)
  const [form, setForm] = useState(FORM_INICIAL)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const res = await fetch('/api/admin/usuarios')
      const data = await res.json()
      if (res.ok) setUsuarios(data.usuarios || [])
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  const crear = async (e) => {
    e.preventDefault()
    setError(''); setOk(''); setGuardando(true)
    try {
      const res = await fetch('/api/admin/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'No se pudo crear el usuario')
      setOk(`Usuario creado. Ingresa con el celular ${data.celular}.`)
      setForm(FORM_INICIAL)
      cargar()
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 pb-10">
      <header>
        <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
          <UserPlus className="w-7 h-7 text-orange-400" /> Usuarios del equipo
        </h1>
        <p className="text-slate-400 mt-1">Crea y consulta cuentas de asesor y supervisor. El acceso es por celular.</p>
      </header>

      {/* ── Formulario de creación ── */}
      <form onSubmit={crear} className="bg-slate-800 border border-slate-700 rounded-2xl p-6 flex flex-col gap-4">
        <h2 className="font-semibold text-slate-200">Crear nuevo usuario</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Campo label="Primer nombre *"   value={form.primer_nombre}   onChange={v => set('primer_nombre', v)} />
          <Campo label="Segundo nombre"    value={form.segundo_nombre}  onChange={v => set('segundo_nombre', v)} />
          <Campo label="Primer apellido *" value={form.primer_apellido} onChange={v => set('primer_apellido', v)} />
          <Campo label="Segundo apellido"  value={form.segundo_apellido}onChange={v => set('segundo_apellido', v)} />
          <Campo label="Celular (login) *" value={form.celular} inputMode="numeric" maxLength={10}
                 onChange={v => set('celular', v.replace(/\D/g, '').slice(0, 10))} />
          <Campo label="Correo real (opcional)" value={form.email} type="email"
                 onChange={v => set('email', v)} placeholder="correo@ejemplo.com" />
          <Campo label="Contraseña temporal *" value={form.password} type="password"
                 onChange={v => set('password', v)} placeholder="mínimo 8 caracteres" />
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-400 uppercase">Rol *</label>
            <select value={form.rol} onChange={e => set('rol', e.target.value)}
              className="bg-slate-900 border border-slate-600 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-orange-500">
              <option value="ASESOR">Asesor</option>
              <option value="SUPERVISOR">Supervisor</option>
            </select>
          </div>
        </div>

        {error && <p className="flex items-center gap-2 text-sm text-red-400"><AlertCircle className="w-4 h-4" /> {error}</p>}
        {ok && <p className="flex items-center gap-2 text-sm text-emerald-400"><CheckCircle2 className="w-4 h-4" /> {ok}</p>}

        <div>
          <button type="submit" disabled={guardando}
            className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-white font-semibold px-5 py-2.5 rounded-xl transition-all">
            {guardando ? <><Loader2 className="w-4 h-4 animate-spin" /> Creando…</> : <><UserPlus className="w-4 h-4" /> Crear usuario</>}
          </button>
        </div>
      </form>

      {/* ── Listado ── */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-700">
          <h2 className="font-semibold text-slate-300 text-sm">Equipo ({usuarios.length})</h2>
        </div>
        {cargando ? (
          <div className="flex items-center justify-center py-12 text-slate-500 gap-2">
            <Loader2 className="w-5 h-5 animate-spin" /> Cargando…
          </div>
        ) : usuarios.length === 0 ? (
          <p className="text-center text-slate-500 py-12 text-sm">Aún no hay asesores ni supervisores.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-700/50 text-slate-400 text-xs uppercase tracking-wide">
                  <th className="px-5 py-3 text-left">Nombre</th>
                  <th className="px-5 py-3 text-left">Rol</th>
                  <th className="px-5 py-3 text-left">Celular</th>
                  <th className="px-5 py-3 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/40">
                {usuarios.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-700/20">
                    <td className="px-5 py-3 text-slate-200 font-medium">{formatNombre(u) || '—'}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${
                        u.nombre_rol === 'SUPERVISOR' ? 'bg-indigo-500/15 text-indigo-300' : 'bg-teal-500/15 text-teal-300'
                      }`}>
                        {u.nombre_rol === 'SUPERVISOR' ? <ShieldCheck className="w-3.5 h-3.5" /> : <Headset className="w-3.5 h-3.5" />}
                        {u.nombre_rol === 'SUPERVISOR' ? 'Supervisor' : 'Asesor'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-300 font-mono text-xs flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-slate-500" /> {u.celular}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        u.activo ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-500/15 text-slate-400'
                      }`}>{u.activo ? 'Activo' : 'Inactivo'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function Campo({ label, value, onChange, type = 'text', ...rest }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-bold text-slate-400 uppercase">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="bg-slate-900 border border-slate-600 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-orange-500"
        {...rest}
      />
    </div>
  )
}
