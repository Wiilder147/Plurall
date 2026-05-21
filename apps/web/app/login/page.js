'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Lock, Phone, Globe, ArrowLeft } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [celular, setCelular] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    setError('')

    const telLimpio = celular.replace(/\D/g, '')
    if (telLimpio.length !== 10) {
      setError('El celular debe tener 10 dígitos.')
      return
    }

    setLoading(true)

    // ── ENTRENAMIENTO: RN-02: Verificar bloqueo antes de intentar login ─────────
    // Antes de llamar a Supabase, verificamos si este celular ya superó los 3 intentos fallidos.
    // Llamamos al método GET de nuestra API de lockout.
    try {
      const lockRes = await fetch(`/api/auth/lockout?celular=${telLimpio}`)
      if (lockRes.ok) {
        const lockData = await lockRes.json()
        if (lockData.bloqueado) {
          setError(`Cuenta bloqueada por intentos fallidos. Intenta en ${lockData.minutosRestantes} minuto${lockData.minutosRestantes > 1 ? 's' : ''}.`)
          setLoading(false)
          return
        }
      }
    } catch { /* Si el endpoint falla, continuamos sin bloqueo */ }

    // ── ENTRENAMIENTO: El Truco del Correo Virtual ─────────────────────────────────
    // Supabase Auth requiere obligatoriamente un email. Como nuestros usuarios ingresan
    // su celular, nosotros creamos un "correo virtual" (ej: 3001234567@plurall.app).
    // Esto nos permite usar el sistema seguro de Supabase sin pagar por SMS de terceros.
    const fakeEmail = `${telLimpio}@plurall.app`.toLowerCase()
    const supabase  = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({ email: fakeEmail, password })

    if (authError) {
      // ── ENTRENAMIENTO: Registrar intento fallido ─────────────────────────────
      // Si Supabase dice que la clave es incorrecta, llamamos al método POST de nuestra API.
      // Esta API sumará +1 a los intentos_fallidos del usuario en la base de datos.
      try {
        const res = await fetch('/api/auth/lockout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ celular: telLimpio }),
        })
        const data = await res.json()
        if (data.bloqueado) {
          setError('Demasiados intentos fallidos. Tu cuenta ha sido bloqueada por 30 minutos.')
        } else {
          const restantes = Math.max(0, 3 - (data.intentos || 0))
          setError(`Celular o contraseña incorrectos.${restantes > 0 ? ` Intentos restantes: ${restantes}.` : ''}`)
        }
      } catch {
        setError('Celular o contraseña incorrectos.')
      }
      setLoading(false)
      return
    }

    // ── ENTRENAMIENTO: Login exitoso: resetear contador de intentos ──────────
    // Si la contraseña es correcta, llamamos al método DELETE de la API
    // para volver a poner los intentos_fallidos en 0 (el "perdón").
    fetch('/api/auth/lockout', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ celular: telLimpio }),
    }).catch(() => null)

    // ── ENTRENAMIENTO: Redirigir al portal según el rol del usuario ───────────
    // Aquí llamamos a la API /api/auth/portal que revisa si el usuario es CLIENTE o SUPERVISOR
    // y nos dice a qué ruta enviarlo.
    try {
      const portalRes = await fetch('/api/auth/portal')
      const { portal } = await portalRes.json()
      router.push(portal)
    } catch {
      router.push('/dashboard/inicio')
    }
    router.refresh()
  }

  return (
    <main className="min-h-screen bg-white flex flex-col items-center justify-center px-4 relative overflow-hidden">
      {/* ── ENTRENAMIENTO: BARRA SUPERIOR ── 
           Aviso pegado arriba (fixed top-0) con un link externo hacia la web principal.
      */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-slate-900 text-white flex items-center justify-center gap-2 py-2 px-4 text-xs font-medium">
        <Globe size={13} />
        ¿Quieres conocer más sobre Plurall?&nbsp;
        <a
          href="https://plurall.co"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 text-orange-400 hover:text-orange-300 font-semibold transition-colors"
        >
          Visita nuestro sitio web
        </a>
      </div>

      {/* ── ENTRENAMIENTO: BOTÓN VOLVER ── 
           Botón flotante (fixed top-12 left-6) para regresar al Home, posicionado debajo de la barra superior.
      */}
      <Link
        href="/"
        className="fixed top-12 left-6 z-40 inline-flex items-center gap-2 bg-white/90 backdrop-blur-sm border border-slate-200 text-slate-700 hover:text-orange-600 hover:border-orange-300 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-sm hover:shadow-md group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        <span className="hidden sm:inline">Volver al inicio</span>
        <div className="w-6 h-6 bg-slate-900 rounded-md flex items-center justify-center sm:ml-1">
          <span className="text-white font-bold text-xs">P</span>
        </div>
      </Link>

      {/* ── ENTRENAMIENTO: DECORACIONES DE FONDO ── 
           Estos divs usan clases globales de Tailwind (definidas en globals.css) 
           para pintar los triángulos grandes al fondo de la pantalla.
      */}
      <div className="bg-triangle-orange"></div>
      <div className="bg-triangle-navy"></div>

      <div className="w-full max-w-sm animate-fade-in relative z-10 flex flex-col items-center">
        {/* ── ENTRENAMIENTO: LOGO ── */}
        <div className="w-14 h-14 bg-navy-900 rounded-xl flex items-center justify-center mb-6 shadow-md">
          <span className="text-white font-extrabold text-2xl">P</span>
        </div>
        
        {/* Títulos */}
        <h1 className="text-2xl md:text-3xl font-bold text-navy-900 text-center tracking-wide uppercase mb-1">
          BIENVENIDO A<br/>PLURALL
        </h1>
        <p className="text-navy-400 text-sm mb-8 text-center lowercase">
          ingresa tu celular registrado
        </p>

        {/* ── ENTRENAMIENTO: FORMULARIO PRINCIPAL ── 
             Al enviar el form (onSubmit), se dispara la lógica handleLogin() explicada arriba.
        */}
        <form onSubmit={handleLogin} className="w-full space-y-4 flex flex-col items-center">
          {error && (
            <div className="w-full bg-danger/10 text-danger rounded-lg p-3 text-sm animate-fade-in text-center">
              {error}
            </div>
          )}

          <div className="w-full relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-navy-400">
              <Phone size={18} />
            </div>
            <input 
              id="celular" 
              type="tel" 
              value={celular} 
              onChange={(e) => setCelular(e.target.value)}
              placeholder="celular" 
              required 
              maxLength={10}
              className="input-field" 
              aria-label="Celular" 
            />
          </div>

          <div className="w-full relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-navy-400">
              <Lock size={18} />
            </div>
            <input 
              id="password" 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)} 
              placeholder="contraseña" 
              required 
              minLength={6}
              className="input-field" 
              aria-label="Contraseña" 
            />
          </div>

          <button 
            type="submit" 
            disabled={loading} 
            className="btn-primary w-full max-w-[200px] mt-2 py-3 flex items-center justify-center font-bold tracking-wide transition-transform hover:scale-105 lowercase"
          >
            {loading ? (
               <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
               'ingresar'
            )}
          </button>
        </form>

        {/* ── ENTRENAMIENTO: ENLACES INFERIORES ── 
             Redirigen a las otras vistas de autenticación (Recuperar y Registro).
        */}
        <div className="mt-8 flex flex-col items-center gap-2">
          <Link href="/recuperar" className="text-navy-400 hover:text-navy-600 text-sm lowercase transition">
            olvidé la contraseña
          </Link>
          <Link href="/registro" className="text-navy-900 hover:text-accent-600 font-bold text-sm lowercase transition">
            crear cuenta nueva
          </Link>
        </div>
      </div>
    </main>
  )
}
