'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Lock, Phone, User, IdCard, CheckCircle, Mail, ArrowLeft } from 'lucide-react'

function RegistroContent() {
  const [form, setForm] = useState({
    nombre: '', dni: '', telefono: '', email: '',
    password: '', confirmPassword: '', aceptaTerminos: false,
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [initializing, setInitializing] = useState(true)

  useEffect(() => {
    async function checkOAuthSession() {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (session && session.user) {
        // Acaba de volver de Google Auth
        const meta = session.user.user_metadata
        setForm(prev => ({
          ...prev,
          nombre: meta?.full_name || prev.nombre,
          email: session.user.email || prev.email,
        }))
        // Cerramos sesión inmediatamente para no alterar el registro manual 
        await supabase.auth.signOut()
      }
      setInitializing(false)
    }
    checkOAuthSession()
  }, [])

  function handleChange(e) {
    const { name, value, type, checked } = e.target
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
  }

  async function handleGoogleAutofill(e) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/registro`,
      },
    })
  }

  async function handleRegistro(e) {
    e.preventDefault()
    setError('')

    const telLimpio = form.telefono.replace(/\D/g, '')
    if (telLimpio.length !== 10) { setError('El celular debe tener 10 dígitos.'); return }
    if (!form.aceptaTerminos) { setError('Acepta los términos y condiciones.'); return }
    if (form.password !== form.confirmPassword) { setError('Las contraseñas no coinciden.'); return }
    if (form.password.length < 6) { setError('La contraseña requiere 6 caracteres.'); return }

    setLoading(true)
    const supabase = createClient()

    // Flujo normal de creación de cuenta virtual con el celular
    const fakeEmail = `${telLimpio}@plurall.app`.toLowerCase()

    const { error: authError } = await supabase.auth.signUp({
      email: fakeEmail,
      password: form.password,
      options: {
        data: { 
          nombre_completo: form.nombre, 
          telefono: telLimpio, 
          dni: form.dni,
          email_real: form.email
        },
      },
    })

    if (authError) {
      if (authError.message.includes('already registered')) {
        setError('Este celular ya está registrado.')
      } else { 
        setError(`Error de Supabase: ${authError.message}`) 
      }
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
  }

  if (initializing) {
    return (
      <main className="min-h-screen bg-white flex flex-col items-center justify-center px-4 relative">
        <div className="w-8 h-8 border-4 border-navy-100 border-t-accent-500 rounded-full animate-spin"></div>
      </main>
    )
  }

  if (success) {
    return (
      <main className="min-h-screen bg-white flex flex-col items-center justify-center px-4 relative overflow-hidden">
        <div className="bg-triangle-orange"></div>
        <div className="bg-triangle-navy"></div>
        <div className="w-full max-w-sm animate-fade-in relative z-10 flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-success rounded-full flex items-center justify-center mb-6 shadow-md text-white">
            <CheckCircle size={32} />
          </div>
          <h2 className="text-2xl font-bold text-navy-900 mb-2 uppercase">¡Cuenta Creada!</h2>
          <p className="text-navy-500 mb-8">Ya puedes iniciar sesión con tu celular.</p>
          <Link href="/login" className="btn-primary flex items-center justify-center tracking-wide lowercase px-10">ingresar</Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-white flex flex-col items-center py-12 px-4 relative overflow-hidden">
      {/* Formas decorativas estáticas en el fondo */}
      <div className="bg-triangle-orange fixed"></div>
      <div className="bg-triangle-navy fixed"></div>

      {/* Botón volver al inicio */}
      <Link
        href="/"
        className="fixed top-6 left-6 z-40 inline-flex items-center gap-2 bg-white/90 backdrop-blur-sm border border-slate-200 text-slate-700 hover:text-orange-600 hover:border-orange-300 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-sm hover:shadow-md group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        <span className="hidden sm:inline">Volver al inicio</span>
        <div className="w-6 h-6 bg-slate-900 rounded-md flex items-center justify-center sm:ml-1">
          <span className="text-white font-bold text-xs">P</span>
        </div>
      </Link>

      <div className="w-full max-w-md animate-fade-in relative z-10 flex flex-col items-center">
        {/* Logo */}
        <div className="w-14 h-14 bg-navy-900 rounded-xl flex items-center justify-center mb-4 shadow-md">
          <span className="text-white font-extrabold text-2xl">P</span>
        </div>
        
        <h1 className="text-2xl md:text-3xl font-bold text-navy-900 text-center uppercase tracking-wide mb-1">
          CREAR CUENTA
        </h1>
        <p className="text-navy-400 text-sm mb-6 text-center lowercase">
          regístrate con tu celular y correo
        </p>

        <div className="w-full bg-white/80 p-6 sm:p-8 rounded-[2rem] shadow-lg backdrop-blur border border-navy-50/50">
          
          <button 
            onClick={handleGoogleAutofill} 
            disabled={loading} 
            className="w-full mb-6 bg-white border border-navy-100 shadow-sm hover:bg-navy-50 text-navy-900 flex items-center justify-center gap-3 py-2.5 rounded-full font-semibold transition-all hover:scale-[1.02] text-sm"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Autocompletar con Google
          </button>

          <div className="flex items-center gap-4 mb-6 opacity-40">
            <div className="h-px w-full bg-navy-400"></div>
            <span className="text-xs text-navy-500 font-bold uppercase tracking-wider">o manual</span>
            <div className="h-px w-full bg-navy-400"></div>
          </div>

          <form onSubmit={handleRegistro} className="w-full space-y-4 flex flex-col items-center">
            {error && <div className="w-full bg-danger/10 text-danger rounded-lg p-3 text-sm animate-fade-in text-center">{error}</div>}

            <div className="w-full relative">
              <label htmlFor="nombre" className="block text-xs font-bold text-navy-400 mb-1 ml-1 uppercase">Nombre Completo</label>
              <div className="absolute left-4 top-[38px] -translate-y-[50%] text-navy-400"><User size={18} /></div>
              <input id="nombre" name="nombre" type="text" value={form.nombre} onChange={handleChange} placeholder="Ej. Juan Pérez" required className="input-field" />
            </div>

            <div className="w-full relative">
              <label htmlFor="email" className="block text-xs font-bold text-navy-400 mb-1 ml-1 uppercase">Correo Electrónico</label>
              <div className="absolute left-4 top-[38px] -translate-y-[50%] text-navy-400"><Mail size={18} /></div>
              <input id="email" name="email" type="email" value={form.email} onChange={handleChange} placeholder="tucorreo@ejemplo.com" required className="input-field" />
            </div>

            <div className="w-full relative">
              <label htmlFor="dni" className="block text-xs font-bold text-navy-400 mb-1 ml-1 uppercase">Número de Documento (CC)</label>
              <div className="absolute left-4 top-[38px] -translate-y-[50%] text-navy-400"><IdCard size={18} /></div>
              <input id="dni" name="dni" type="text" value={form.dni} onChange={handleChange} placeholder="Ej. 1020304050" required maxLength={12} className="input-field" />
            </div>

            <div className="w-full relative">
              <label htmlFor="telefono" className="block text-xs font-bold text-navy-400 mb-1 ml-1 uppercase">Número de Celular</label>
              <div className="absolute left-4 top-[38px] -translate-y-[50%] text-navy-400"><Phone size={18} /></div>
              <input id="telefono" name="telefono" type="tel" value={form.telefono} onChange={handleChange} placeholder="Ej. 3001234567" required maxLength={10} className="input-field" />
            </div>

            <div className="w-full relative">
              <label htmlFor="password" className="block text-xs font-bold text-navy-400 mb-1 ml-1 uppercase">Contraseña nueva</label>
              <div className="absolute left-4 top-[38px] -translate-y-[50%] text-navy-400"><Lock size={18} /></div>
              <input id="password" name="password" type="password" value={form.password} onChange={handleChange} placeholder="Mínimo 6 caracteres" required minLength={6} className="input-field" />
            </div>
            
            <div className="w-full relative">
              <label htmlFor="confirmPassword" className="block text-xs font-bold text-navy-400 mb-1 ml-1 uppercase">Repetir Contraseña</label>
              <div className="absolute left-4 top-[38px] -translate-y-[50%] text-navy-400"><Lock size={18} /></div>
              <input id="confirmPassword" name="confirmPassword" type="password" value={form.confirmPassword} onChange={handleChange} placeholder="Mínimo 6 caracteres" required minLength={6} className="input-field" />
            </div>

            <label className="flex items-start gap-3 cursor-pointer w-full text-left mt-2 px-1">
              <input type="checkbox" name="aceptaTerminos" checked={form.aceptaTerminos} onChange={handleChange} className="mt-1 accent-accent-600 w-4 h-4 rounded" />
              <span className="text-navy-500 text-xs leading-relaxed lowercase">
                acepto la política de tratamiento de datos personales conforme a la ley 1581 de 2012 (habeas data)
              </span>
            </label>

            <button type="submit" disabled={loading} className="btn-primary w-full max-w-[200px] mt-4 py-3 flex items-center justify-center font-bold tracking-wide transition-transform hover:scale-105 lowercase">
              {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'crear cuenta'}
            </button>
          </form>
        </div>

        <div className="mt-6">
          <Link href="/login" className="text-navy-400 hover:text-navy-900 text-sm lowercase transition">
            ya tengo cuenta (ingresar)
          </Link>
        </div>
      </div>
    </main>
  )
}

export default function Page() {
  return (
    <Suspense>
      <RegistroContent />
    </Suspense>
  )
}
