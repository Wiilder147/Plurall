'use client'

/* ==========================================================================
 * ARCHIVO: page.js
 * RUTA: apps/web/app/registro/page.js
 * DESCRIPCIÓN: Vista de registro de nuevos usuarios.
 * FUNCIONALIDAD: Permite crear cuenta con celular, nombre, correo, CC y contraseña.
 *                También permite autocompletar datos desde Google OAuth.
 * ========================================================================== */

import { useState, useEffect, useRef, Suspense } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Lock, Phone, User, IdCard, CheckCircle, Mail, ArrowLeft, Eye, EyeOff } from 'lucide-react'

function RegistroContent() {
  const [form, setForm] = useState({
    nombre: '', dni: '', telefono: '', email: '',
    password: '', confirmPassword: '', aceptaTerminos: false,
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [hints, setHints] = useState({})
  const hintTimers = useRef({})

  function showHint(field, msg) {
    setHints(prev => ({ ...prev, [field]: msg }))
    clearTimeout(hintTimers.current[field])
    hintTimers.current[field] = setTimeout(
      () => setHints(prev => ({ ...prev, [field]: '' })), 2500
    )
  }

  useEffect(() => {
    async function checkOAuthSession() {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (session && session.user) {
        const meta = session.user.user_metadata
        setForm(prev => ({
          ...prev,
          nombre: meta?.full_name || prev.nombre,
          email: session.user.email || prev.email,
        }))
        await supabase.auth.signOut()
      }
      setInitializing(false)
    }
    checkOAuthSession()
  }, [])

  function handleChange(e) {
    const { name, value, type, checked } = e.target
    if (type === 'checkbox') { setForm(prev => ({ ...prev, [name]: checked })); return }
    let sanitized = value
    if (name === 'nombre') {
      sanitized = value.replace(/[0-9]/g, '')
      if (sanitized !== value) showHint('nombre', 'El nombre no debe contener números')
    }
    if (name === 'dni' || name === 'telefono') {
      sanitized = value.replace(/\D/g, '')
      if (sanitized !== value) showHint(name, 'Solo se permiten números en este campo')
    }
    setForm(prev => ({ ...prev, [name]: sanitized }))
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

  // ── PANTALLA DE INICIALIZACIÓN ────────────────────────────────────────────
  if (initializing) {
    return (
      // FONDO BLANCO, centrado, pantalla completa
      <main className="min-h-screen bg-white flex flex-col items-center justify-center px-4 relative">
        {/* SPINNER — borde azul claro con punta naranja (accent-500) girando
            TAMAÑO: w-8 h-8 (32x32px — para más grande: w-12 h-12=48px)
            BORDE: border-4 (4px) — Para más fino: border-2 */}
        <div className="w-8 h-8 border-4 border-navy-100 border-t-accent-500 rounded-full animate-spin"></div>
      </main>
    )
  }

  // ── PANTALLA DE ÉXITO (cuenta creada) ────────────────────────────────────
  if (success) {
    return (
      // FONDO BLANCO con triángulos decorativos de fondo (definidos en globals.css)
      <main className="min-h-screen bg-white flex flex-col items-center justify-center px-4 relative overflow-hidden">
        <div className="bg-triangle-orange"></div>
        <div className="bg-triangle-navy"></div>
        <div className="w-full max-w-sm animate-fade-in relative z-10 flex flex-col items-center text-center">
          {/* ÍCONO ÉXITO — círculo verde con check
              COLOR DE FONDO: bg-success (verde — definido como color custom en globals.css/tailwind.config)
              Para cambiar a otro color: bg-emerald-500, bg-green-500
              TAMAÑO: w-16 h-16 (64x64px)
              BORDES: rounded-full (círculo perfecto) */}
          <div className="w-16 h-16 bg-success rounded-full flex items-center justify-center mb-6 shadow-md text-white">
            {/* ÍCONO CHECK — size={32} (32px) */}
            <CheckCircle size={32} />
          </div>
          {/* TÍTULO ¡Cuenta Creada!
              COLOR: text-navy-900 (azul muy oscuro)
              TAMAÑO: text-2xl (24px), font-bold (negrita), uppercase (mayúsculas) */}
          <h2 className="text-2xl font-bold text-navy-900 mb-2 uppercase">¡Cuenta Creada!</h2>
          {/* SUBTÍTULO
              COLOR: text-navy-500 (gris azulado medio)
              TAMAÑO: texto por defecto (16px) */}
          <p className="text-navy-500 mb-8">Ya puedes iniciar sesión con tu celular.</p>
          {/* BOTÓN "ingresar" — usa clase btn-primary (naranja, definida en globals.css)
              Para cambiar el COLOR: edita .btn-primary en globals.css
              PADDING HORIZONTAL: px-10 (40px) */}
          <Link href="/login" className="btn-primary flex items-center justify-center tracking-wide lowercase px-10">ingresar</Link>
        </div>
      </main>
    )
  }

  return (
    // PÁGINA PRINCIPAL DE REGISTRO
    // FONDO: bg-white (blanco), overflow-hidden (oculta lo que sale del borde)
    // PADDING: py-12 (48px arriba/abajo), px-4 (16px lados)
    <main className="min-h-screen bg-white flex flex-col items-center py-12 px-4 relative overflow-hidden">

      {/* TRIÁNGULOS DECORATIVOS DE FONDO — posición fija, estilos en globals.css */}
      <div className="bg-triangle-orange fixed"></div>
      <div className="bg-triangle-navy fixed"></div>

      {/* BOTÓN "VOLVER AL INICIO" (flotante, esquina superior izquierda)
          POSICIÓN: fixed top-6 left-6 (fijo, 24px del top, 24px izquierda)
          COLOR DE FONDO: bg-white/90 (blanco 90% opacidad)
          BORDE: border border-slate-200 (gris claro, 1px)
          COLOR TEXTO: text-slate-700 (gris oscuro), hover:text-orange-600 (naranja al hover)
          PADDING: px-4 py-2.5 (16px horizontal, 10px vertical)
          BORDES REDONDEADOS: rounded-xl (12px)
          TAMAÑO FUENTE: text-sm (14px) */}
      <Link
        href="/"
        className="fixed top-6 left-6 z-40 inline-flex items-center gap-2 bg-white/90 backdrop-blur-sm border border-slate-200 text-slate-700 hover:text-orange-600 hover:border-orange-300 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-sm hover:shadow-md group"
      >
        {/* ÍCONO FLECHA — w-4 h-4 (16x16px) */}
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        <span className="hidden sm:inline">Volver al inicio</span>
        {/* CUADRADO LOGO "P" — bg-slate-900, 24x24px, bordes rounded-md */}
        <div className="w-6 h-6 bg-slate-900 rounded-md flex items-center justify-center sm:ml-1">
          <span className="text-white font-bold text-xs">P</span>
        </div>
      </Link>

      {/* TARJETA CENTRAL
          ANCHO MÁXIMO: max-w-md (448px — para más ancho: max-w-lg=512px, max-w-xl=576px)
          ANIMACIÓN: animate-fade-in (aparece suavemente) */}
      <div className="w-full max-w-md animate-fade-in relative z-10 flex flex-col items-center">

        {/* LOGO CUADRADO "P"
            COLOR DE FONDO: bg-navy-900 (azul muy oscuro)
            TAMAÑO: w-14 h-14 (56x56px)
            BORDES: rounded-xl (12px redondeados)
            SOMBRA: shadow-md (media) */}
        <div className="w-14 h-14 bg-navy-900 rounded-xl flex items-center justify-center mb-4 shadow-md">
          {/* LETRA — text-white (blanco), font-extrabold (extra negrita), text-2xl (24px) */}
          <span className="text-white font-extrabold text-2xl">P</span>
        </div>

        {/* TÍTULO "CREAR CUENTA"
            COLOR: text-navy-900 (azul muy oscuro)
            TAMAÑO: text-2xl (24px), md:text-3xl en tablet (30px)
            FUENTE: font-bold, uppercase, tracking-wide */}
        <h1 className="text-2xl md:text-3xl font-bold text-navy-900 text-center uppercase tracking-wide mb-1">
          CREAR CUENTA
        </h1>

        {/* SUBTÍTULO
            COLOR: text-navy-400 (gris azulado)
            TAMAÑO: text-sm (14px)
            MARGEN INFERIOR: mb-6 (24px) */}
        <p className="text-navy-400 text-sm mb-6 text-center lowercase">
          regístrate con tu celular y correo
        </p>

        {/* TARJETA BLANCA DEL FORMULARIO
            COLOR DE FONDO: bg-white/80 (blanco 80% opacidad)
            PADDING: p-6 (24px) en móvil, sm:p-8 (32px) en tablet+
            BORDES REDONDEADOS: rounded-[2rem] (32px — muy redondeados)
            SOMBRA: shadow-lg (sombra grande)
            BORDE: border border-navy-50/50 (azul muy claro, semi-transparente) */}
        <div className="w-full bg-white/80 p-6 sm:p-8 rounded-[2rem] shadow-lg backdrop-blur border border-navy-50/50">

          {/* BOTÓN "Autocompletar con Google"
              COLOR DE FONDO: bg-white (blanco puro)
              BORDE: border border-navy-100 (azul muy claro)
              COLOR DE TEXTO: text-navy-900 (azul muy oscuro)
              HOVER: hover:bg-navy-50 (azul casi blanco)
              TAMAÑO: py-2.5 (10px vertical), text-sm (14px)
              BORDES: rounded-full (completamente ovalado)
              MARGEN INFERIOR: mb-6 (24px) */}
          <button
            onClick={handleGoogleAutofill}
            disabled={loading}
            className="w-full mb-6 bg-white border border-navy-100 shadow-sm hover:bg-navy-50 text-navy-900 flex items-center justify-center gap-3 py-2.5 rounded-full font-semibold transition-all hover:scale-[1.02] text-sm"
          >
            {/* LOGO GOOGLE SVG — w-4 h-4 (16x16px) */}
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Autocompletar con Google
          </button>

          {/* SEPARADOR "o manual"
              OPACIDAD: opacity-40 (40% visible — para más visible: opacity-60, opacity-100) */}
          <div className="flex items-center gap-4 mb-6 opacity-40">
            <div className="h-px w-full bg-navy-400"></div>
            {/* TEXTO "o manual" — text-xs (12px), font-bold, uppercase, tracking-wider */}
            <span className="text-xs text-navy-500 font-bold uppercase tracking-wider">o manual</span>
            <div className="h-px w-full bg-navy-400"></div>
          </div>

          {/* FORMULARIO MANUAL
              ESPACIO ENTRE CAMPOS: space-y-4 (16px entre cada campo) */}
          <form onSubmit={handleRegistro} className="w-full space-y-4 flex flex-col items-center">

            {/* MENSAJE DE ERROR
                COLOR DE FONDO: bg-danger/10 (rojo muy suave)
                COLOR DE TEXTO: text-danger (rojo)
                BORDES: rounded-lg (8px)
                PADDING: p-3 (12px), TAMAÑO: text-sm (14px) */}
            {error && <div className="w-full bg-danger/10 text-danger rounded-lg p-3 text-sm animate-fade-in text-center">{error}</div>}

            {/* ── CAMPO NOMBRE COMPLETO ── */}
            <div className="w-full relative">
              {/* ETIQUETA DEL CAMPO
                  COLOR: text-navy-400 (gris azulado)
                  TAMAÑO: text-xs (12px), font-bold (negrita), uppercase */}
              <label htmlFor="nombre" className="block text-xs font-bold text-navy-400 mb-1 ml-1 uppercase">Nombre Completo</label>
              {/* ÍCONO PERSONA — posicionado absoluto dentro del input
                  COLOR: text-navy-400, TAMAÑO: size={18} (18px) */}
              <div className="absolute left-4 top-[38px] -translate-y-[50%] text-navy-400"><User size={18} /></div>
              {/* INPUT — clase input-field (definida en globals.css) */}
              <input id="nombre" name="nombre" type="text" value={form.nombre} onChange={handleChange} placeholder="Ej. Juan Pérez" required className="input-field" />
              {hints.nombre && <p className="text-xs text-amber-500 mt-1 ml-1 animate-fade-in">⚠ {hints.nombre}</p>}
            </div>

            {/* ── CAMPO CORREO ELECTRÓNICO ── */}
            <div className="w-full relative">
              <label htmlFor="email" className="block text-xs font-bold text-navy-400 mb-1 ml-1 uppercase">Correo Electrónico</label>
              <div className="absolute left-4 top-[38px] -translate-y-[50%] text-navy-400"><Mail size={18} /></div>
              <input id="email" name="email" type="email" value={form.email} onChange={handleChange} placeholder="tucorreo@ejemplo.com" required className="input-field" />
            </div>

            {/* ── CAMPO NÚMERO DE DOCUMENTO (CC) ── */}
            <div className="w-full relative">
              <label htmlFor="dni" className="block text-xs font-bold text-navy-400 mb-1 ml-1 uppercase">Número de Documento (CC)</label>
              <div className="absolute left-4 top-[38px] -translate-y-[50%] text-navy-400"><IdCard size={18} /></div>
              {/* maxLength={12} — máximo 12 caracteres para la cédula */}
              <input id="dni" name="dni" type="text" inputMode="numeric" value={form.dni} onChange={handleChange} placeholder="Ej. 1020304050" required maxLength={12} className="input-field" />
              {hints.dni && <p className="text-xs text-amber-500 mt-1 ml-1 animate-fade-in">⚠ {hints.dni}</p>}
            </div>

            {/* ── CAMPO NÚMERO DE CELULAR ── */}
            <div className="w-full relative">
              <label htmlFor="telefono" className="block text-xs font-bold text-navy-400 mb-1 ml-1 uppercase">Número de Celular</label>
              <div className="absolute left-4 top-[38px] -translate-y-[50%] text-navy-400"><Phone size={18} /></div>
              {/* maxLength={10} — máximo 10 dígitos para el celular colombiano */}
              <input id="telefono" name="telefono" type="tel" inputMode="numeric" value={form.telefono} onChange={handleChange} placeholder="Ej. 3001234567" required maxLength={10} className="input-field" />
              {hints.telefono && <p className="text-xs text-amber-500 mt-1 ml-1 animate-fade-in">⚠ {hints.telefono}</p>}
            </div>

            {/* ── CAMPO CONTRASEÑA NUEVA ── */}
            <div className="w-full relative">
              <label htmlFor="password" className="block text-xs font-bold text-navy-400 mb-1 ml-1 uppercase">Contraseña nueva</label>
              <div className="absolute left-4 top-[38px] -translate-y-[50%] text-navy-400"><Lock size={18} /></div>
              {/* pr-12 — padding derecho de 48px para dejar espacio al botón ojo */}
              <input id="password" name="password" type={showPassword ? 'text' : 'password'} value={form.password} onChange={handleChange} placeholder="Mínimo 6 caracteres" required minLength={6} className="input-field pr-12" />
              {/* BOTÓN OJO — color text-navy-400, hover:text-navy-700, ÍCONO: size={18} */}
              <button type="button" onClick={() => setShowPassword(v => !v)}
                className="absolute right-4 top-[38px] -translate-y-[50%] text-navy-400 hover:text-navy-700 transition-colors"
                aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}>
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {/* ── CAMPO REPETIR CONTRASEÑA ── */}
            <div className="w-full relative">
              <label htmlFor="confirmPassword" className="block text-xs font-bold text-navy-400 mb-1 ml-1 uppercase">Repetir Contraseña</label>
              <div className="absolute left-4 top-[38px] -translate-y-[50%] text-navy-400"><Lock size={18} /></div>
              <input id="confirmPassword" name="confirmPassword" type={showConfirm ? 'text' : 'password'} value={form.confirmPassword} onChange={handleChange} placeholder="Mínimo 6 caracteres" required minLength={6} className="input-field pr-12" />
              <button type="button" onClick={() => setShowConfirm(v => !v)}
                className="absolute right-4 top-[38px] -translate-y-[50%] text-navy-400 hover:text-navy-700 transition-colors"
                aria-label={showConfirm ? 'Ocultar contraseña' : 'Ver contraseña'}>
                {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {/* ── CHECKBOX DE TÉRMINOS ──
                TAMAÑO: w-4 h-4 (16x16px)
                COLOR DEL CHECK: accent-accent-600 (naranja — para cambiar: accent-blue-600, accent-green-600)
                COLOR DEL TEXTO: text-navy-500, text-xs (12px) */}
            <label className="flex items-start gap-3 cursor-pointer w-full text-left mt-2 px-1">
              <input type="checkbox" name="aceptaTerminos" checked={form.aceptaTerminos} onChange={handleChange} className="mt-1 accent-accent-600 w-4 h-4 rounded" />
              <span className="text-navy-500 text-xs leading-relaxed lowercase">
                acepto la política de tratamiento de datos personales conforme a la ley 1581 de 2012 (habeas data)
              </span>
            </label>

            {/* BOTÓN "crear cuenta" (botón principal)
                CLASE BASE: btn-primary (naranja, definida en globals.css)
                Para cambiar COLOR: edita .btn-primary en globals.css
                ANCHO: w-full max-w-[200px] (máximo 200px)
                PADDING VERTICAL: py-3 (12px)
                MARGEN SUPERIOR: mt-4 (16px)
                ANIMACIÓN HOVER: hover:scale-105 (crece 5%) */}
            <button type="submit" disabled={loading} className="btn-primary w-full max-w-[200px] mt-4 py-3 flex items-center justify-center font-bold tracking-wide transition-transform hover:scale-105 lowercase">
              {/* SPINNER — visible cuando loading=true
                  TAMAÑO: w-5 h-5 (20x20px), BORDE: border-2 */}
              {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'crear cuenta'}
            </button>
          </form>
        </div>

        {/* ENLACE "ya tengo cuenta"
            MARGEN SUPERIOR: mt-6 (24px)
            COLOR: text-navy-400, hover:text-navy-900
            TAMAÑO: text-sm (14px) */}
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
