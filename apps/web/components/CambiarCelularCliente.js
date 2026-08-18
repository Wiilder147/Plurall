'use client'

/* ==========================================================================
 * ARCHIVO: CambiarCelularCliente.js
 * RUTA: apps/web/components/CambiarCelularCliente.js
 * DESCRIPCIÓN: El CLIENTE cambia su propio celular, confirmando con OTP.
 * FUNCIONALIDAD: Paso 1 pide el nuevo número y envía un código al correo real
 *                (/api/cliente/celular/solicitar-otp). Paso 2 confirma el código
 *                (/api/cliente/celular/confirmar). Tras el cambio, el acceso es
 *                con el nuevo número.
 * ========================================================================== */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Phone, Loader2, KeyRound, CheckCircle2, X } from 'lucide-react'

export default function CambiarCelularCliente({ celularActual }) {
  const router = useRouter()
  const [paso, setPaso] = useState(0) // 0 cerrado · 1 nuevo número · 2 OTP · 3 éxito
  const [nuevo, setNuevo] = useState('')
  const [otp, setOtp] = useState('')
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  const solicitar = async () => {
    const cel = nuevo.replace(/\D/g, '')
    if (cel.length !== 10) { setError('El celular debe tener 10 dígitos.'); return }
    setCargando(true); setError('')
    try {
      const res = await fetch('/api/cliente/celular/solicitar-otp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nuevoCelular: cel }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'No se pudo enviar el código')
      setMsg(data.message || 'Código enviado.')
      setPaso(2)
    } catch (e) { setError(e.message) }
    finally { setCargando(false) }
  }

  const confirmar = async () => {
    if (otp.replace(/\D/g, '').length !== 6) { setError('El código debe tener 6 dígitos.'); return }
    setCargando(true); setError('')
    try {
      const res = await fetch('/api/cliente/celular/confirmar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nuevoCelular: nuevo.replace(/\D/g, ''), otp: otp.replace(/\D/g, '') }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'No se pudo confirmar')
      setPaso(3)
      setTimeout(() => router.refresh(), 1500)
    } catch (e) { setError(e.message) }
    finally { setCargando(false) }
  }

  if (paso === 0) {
    return (
      <button onClick={() => { setNuevo(''); setOtp(''); setError(''); setMsg(''); setPaso(1) }}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange-600 hover:text-orange-700 bg-orange-50 hover:bg-orange-100 px-3 py-1.5 rounded-lg transition-colors">
        <Phone className="w-3.5 h-3.5" /> Cambiar mi número
      </button>
    )
  }

  return (
    <div className="mt-3 border border-slate-200 rounded-xl p-4 bg-slate-50 max-w-sm">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-slate-700">Cambiar número de celular</p>
        <button onClick={() => setPaso(0)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
      </div>

      {paso === 1 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-slate-500">Actual: <strong>{celularActual}</strong>. Te enviaremos un código a tu correo para confirmar.</p>
          <input value={nuevo} onChange={e => setNuevo(e.target.value.replace(/\D/g, '').slice(0, 10))}
            inputMode="numeric" placeholder="Nuevo celular (10 dígitos)"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
          <button onClick={solicitar} disabled={cargando}
            className="inline-flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-400 text-white text-sm font-semibold py-2 rounded-lg disabled:opacity-60">
            {cargando ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />} Enviar código
          </button>
        </div>
      )}

      {paso === 2 && (
        <div className="flex flex-col gap-2">
          {msg && <p className="text-xs text-emerald-600">{msg}</p>}
          <input value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric" placeholder="Código de 6 dígitos"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-center tracking-widest font-bold focus:outline-none focus:border-orange-400" />
          <button onClick={confirmar} disabled={cargando}
            className="inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold py-2 rounded-lg disabled:opacity-60">
            {cargando ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Confirmar cambio
          </button>
          <button onClick={() => setPaso(1)} className="text-xs text-slate-400 hover:text-slate-600 underline">Cambiar número</button>
        </div>
      )}

      {paso === 3 && (
        <div className="flex items-center gap-2 text-emerald-700 text-sm">
          <CheckCircle2 className="w-5 h-5" /> ¡Número actualizado! Usa <strong>{nuevo}</strong> para iniciar sesión.
        </div>
      )}

      {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
    </div>
  )
}
