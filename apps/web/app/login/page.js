'use client'

/* ==========================================================================
 * ARCHIVO: page.js
 * RUTA: apps/web/app/login/page.js
 * DESCRIPCIÓN: Vista de inicio de sesión para los usuarios.
 * FUNCIONALIDAD: Maneja el login con celular + contraseña usando Supabase Auth.
 *                Incluye protección anti-fuerza bruta (bloqueo a 3 intentos).
 * ========================================================================== */

import { useState, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Lock, Phone, Globe, ArrowLeft, Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [celular, setCelular] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [hints, setHints] = useState({})
  const hintTimers = useRef({})

  function showHint(field, msg) {
    setHints(prev => ({ ...prev, [field]: msg }))
    clearTimeout(hintTimers.current[field])
    hintTimers.current[field] = setTimeout(
      () => setHints(prev => ({ ...prev, [field]: '' })), 2500
    )
  }

  async function handleLogin(e) {
    e.preventDefault()
    setError('')

    const telLimpio = celular.replace(/\D/g, '')
    if (telLimpio.length !== 10) {
      setError('El celular debe tener 10 dígitos.')
      return
    }

    setLoading(true)

    // ── Verificar bloqueo antes de intentar login ─────────────────────────────
    // Antes de llamar a Supabase, verificamos si este celular ya superó los 3 intentos.
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

    // ── El Truco del Correo Virtual ───────────────────────────────────────────
    // Supabase Auth requiere un email. Creamos uno virtual: 3001234567@plurall.app
    const fakeEmail = `${telLimpio}@plurall.app`.toLowerCase()
    const supabase  = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({ email: fakeEmail, password })

    if (authError) {
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

    // ── Login exitoso: resetear contador de intentos ──────────────────────────
    fetch('/api/auth/lockout', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ celular: telLimpio }),
    }).catch(() => null)

    // ── Redirigir al portal según el rol del usuario ──────────────────────────
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
    // CONTENEDOR PRINCIPAL DE LA PÁGINA
    // CLASE: auth-shell (definida en globals.css) — centra el contenido y pinta
    //        el fondo degradado suave sobre el que resalta la tarjeta blanca.
    //        Para cambiar el fondo: edita .auth-shell en globals.css
    <main className="auth-shell">

      {/* ──────────────────────────────────────────────────────────────────────
          BARRA SUPERIOR (banner informativo)
          POSICIÓN: fixed top-0 left-0 right-0 (pegada arriba, ancho completo)
          Z-INDEX: z-50 (se superpone sobre todo)
          COLOR DE FONDO: bg-slate-900 (gris muy oscuro casi negro — para cambiar: bg-navy-900, bg-black, etc.)
          COLOR DE TEXTO: text-white (blanco)
          TAMAÑO DEL TEXTO: text-xs (12px — para más grande: text-sm=14px, text-base=16px)
          PADDING VERTICAL: py-2 (8px arriba y abajo)
          ────────────────────────────────────────────────────────────────────── */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-slate-900 text-white flex items-center justify-center gap-2 py-2 px-4 text-xs font-medium">
        {/* ÍCONO GLOBO — tamaño size={13} (13px). Para más grande: size={16}, size={20} */}
        <Globe size={13} />
        ¿Quieres conocer más sobre Plurall?&nbsp;
        {/* ENLACE "Visita nuestro sitio web"
            COLOR: text-orange-400 (naranja medio — para cambiar: text-yellow-400, text-blue-300)
            HOVER: hover:text-orange-300 (se aclara al pasar el cursor)
            GROSOR DE FUENTE: font-semibold (semi-negrita — para negrita completa: font-bold) */}
        <a
          href="https://plurall.co"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 text-orange-400 hover:text-orange-300 font-semibold transition-colors"
        >
          Visita nuestro sitio web
        </a>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────
          BOTÓN "VOLVER AL INICIO" (flotante, esquina superior izquierda)
          POSICIÓN: fixed top-12 left-6 (fijo, a 48px del top, 24px de la izquierda)
          Z-INDEX: z-40 (debajo de la barra pero sobre el contenido normal)
          COLOR DE FONDO: bg-white/90 (blanco con 90% opacidad)
          BORDE: border border-slate-200 (borde gris claro, 1px)
          COLOR DE TEXTO: text-slate-700 (gris oscuro)
          HOVER: hover:text-orange-600 (texto naranja oscuro al pasar cursor)
          PADDING: px-4 py-2.5 (horizontal 16px, vertical 10px)
          BORDES REDONDEADOS: rounded-xl (muy redondeados, 12px)
          TAMAÑO DE FUENTE: text-sm (14px — para más grande: text-base=16px)
          ────────────────────────────────────────────────────────────────────── */}
      <Link
        href="/"
        className="fixed top-12 left-6 z-40 inline-flex items-center gap-2 bg-white/90 backdrop-blur-sm border border-slate-200 text-slate-700 hover:text-orange-600 hover:border-orange-300 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-sm hover:shadow-md group"
      >
        {/* ÍCONO FLECHA IZQUIERDA — w-4 h-4 (16x16px). Para más grande: w-5 h-5=20px */}
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        {/* TEXTO "Volver al inicio" — solo visible en pantallas sm (≥640px) y mayores */}
        <span className="hidden sm:inline">Volver al inicio</span>
        {/* CUADRADO LOGO MINI "P"
            COLOR DE FONDO: bg-slate-900 (gris muy oscuro)
            TAMAÑO: w-6 h-6 (24x24px)
            BORDES: rounded-md (bordes medianamente redondeados, 6px) */}
        <div className="w-6 h-6 bg-slate-900 rounded-md flex items-center justify-center sm:ml-1">
          {/* LETRA "P" — text-white (blanco), font-bold (negrita), text-xs (12px) */}
          <span className="text-white font-bold text-xs">P</span>
        </div>
      </Link>

      {/* ──────────────────────────────────────────────────────────────────────
          DECORACIONES DE FONDO (triángulos decorativos)
          Estas clases están definidas en globals.css como .bg-triangle-orange y .bg-triangle-navy
          Para cambiar colores/posición de los triángulos: edita globals.css
          ────────────────────────────────────────────────────────────────────── */}
      <div className="bg-triangle-orange"></div>
      <div className="bg-triangle-navy"></div>

      {/* ──────────────────────────────────────────────────────────────────────
          TARJETA CENTRAL DEL FORMULARIO
          CLASE: auth-card (definida en globals.css) — tarjeta blanca con sombra,
                 ancho máximo 480px y filete naranja superior.
                 Para cambiar ancho/padding/sombra: edita .auth-card en globals.css
          ANIMACIÓN: animate-fade-in (aparece suavemente)
          ────────────────────────────────────────────────────────────────────── */}
      <div className="auth-card animate-fade-in">

        {/* ── LOGO CUADRADO "P" ──
            COLOR DE FONDO: bg-navy-900 (azul muy oscuro — para cambiar: bg-slate-900, bg-blue-900)
            TAMAÑO: w-20 h-20 (80x80px — para más pequeño: w-16 h-16=64px)
            BORDES: rounded-2xl (muy redondeados, 16px — para circulo: rounded-full)
            SOMBRA: shadow-lg (sombra amplia)
            MARGEN INFERIOR: mb-7 (28px abajo) */}
        <div className="w-20 h-20 bg-navy-900 rounded-2xl flex items-center justify-center mb-7 shadow-lg">
          {/* LETRA "P" — color fijo #fff (no text-white, que el tema claro repinta),
              font-extrabold (extra negrita), text-4xl (36px) */}
          <span className="text-[#ffffff] font-extrabold text-4xl">P</span>
        </div>

        {/* TÍTULO PRINCIPAL "BIENVENIDO A PLURALL"
            TAMAÑO: text-3xl (30px) en móvil, md:text-4xl (36px) en tablet+
            COLOR: text-navy-900 (azul muy oscuro — para cambiar: text-slate-900, text-black)
            FUENTE: font-bold (negrita), uppercase (todo mayúsculas), tracking-wide (letras separadas)
            INTERLINEADO: leading-tight (compacto, porque el título va en dos renglones)
            MARGEN INFERIOR: mb-2 (8px) */}
        <h1 className="text-3xl md:text-4xl font-bold text-navy-900 text-center tracking-wide uppercase leading-tight mb-2">
          BIENVENIDO A<br/>PLURALL
        </h1>

        {/* SUBTÍTULO "ingresa tu celular registrado"
            COLOR: text-navy-500 (gris azulado medio — para cambiar: text-slate-500, text-gray-400)
            TAMAÑO: text-lg (18px)
            MARGEN INFERIOR: mb-9 (36px) */}
        <p className="text-navy-500 text-lg mb-9 text-center lowercase">
          ingresa tu celular registrado
        </p>

        {/* ──────────────────────────────────────────────────────────────────
            FORMULARIO PRINCIPAL DE LOGIN
            ESPACIO ENTRE CAMPOS: space-y-5 (20px entre cada elemento)
            ────────────────────────────────────────────────────────────────── */}
        <form onSubmit={handleLogin} className="w-full space-y-5 flex flex-col items-center">

          {/* MENSAJE DE ERROR (visible solo si hay error)
              COLOR DE FONDO: bg-danger/10 (rojo con 10% opacidad — definido como color custom)
              COLOR DE TEXTO: text-danger (rojo — para cambiar: text-red-600)
              BORDES: rounded-lg (redondeados, 8px)
              PADDING: p-3 (12px en todos lados)
              TAMAÑO: text-sm (14px) */}
          {error && (
            <div className="w-full bg-danger/10 text-danger rounded-lg p-3 text-sm animate-fade-in text-center">
              {error}
            </div>
          )}

          {/* ── CAMPO CELULAR ──
              CONTENEDOR: relative (para posicionar el ícono dentro)
              ANCHO: w-full (100% del contenedor padre) */}
          <div className="w-full relative">
            {/* ÍCONO TELÉFONO — posición: absolute left-4 top-1/2 (centro vertical, 16px desde la izquierda)
                COLOR: text-navy-400 (gris azulado)
                TAMAÑO DEL ÍCONO: size={20} (20px) */}
            <div className="absolute left-5 top-1/2 -translate-y-1/2 text-navy-400">
              <Phone size={20} />
            </div>
            {/* INPUT CELULAR
                CLASE: input-field (definida en globals.css — incluye padding, borde, fondo, etc.)
                Para cambiar el estilo del input: edita .input-field en globals.css */}
            <input
              id="celular"
              type="tel"
              inputMode="numeric"
              value={celular}
              onChange={(e) => {
                const raw = e.target.value
                const clean = raw.replace(/\D/g, '')
                if (raw !== clean) showHint('celular', 'Solo se permiten números en este campo')
                setCelular(clean)
              }}
              placeholder="celular"
              required
              maxLength={10}
              className="input-field"
              aria-label="Celular"
            />
            {hints.celular && (
              <p className="text-sm text-amber-600 mt-1 ml-1 animate-fade-in">⚠ {hints.celular}</p>
            )}
          </div>

          {/* ── CAMPO CONTRASEÑA ──
              CONTENEDOR: relative (para posicionar íconos dentro) */}
          <div className="w-full relative">
            {/* ÍCONO CANDADO — posición: absolute left-4, centrado vertical
                COLOR: text-navy-400 (gris azulado)
                TAMAÑO: size={20} (20px) */}
            <div className="absolute left-5 top-1/2 -translate-y-1/2 text-navy-400">
              <Lock size={20} />
            </div>
            {/* INPUT CONTRASEÑA
                CLASE: input-field pr-12 (input-field de globals.css + padding derecho de 48px para el ojo)
                type cambia entre 'text' y 'password' según showPassword */}
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="contraseña"
              required
              minLength={6}
              className="input-field pr-14"
              aria-label="Contraseña"
            />
            {/* BOTÓN OJO (mostrar/ocultar contraseña)
                POSICIÓN: absolute right-4, centrado vertical (top-1/2 -translate-y-1/2)
                COLOR: text-navy-400 en reposo, hover:text-navy-700 (más oscuro al hover)
                TAMAÑO DEL ÍCONO: size={20} (20px) */}
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              className="absolute right-5 top-1/2 -translate-y-1/2 text-navy-400 hover:text-navy-700 transition-colors"
              aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          {/* ── BOTÓN "INGRESAR" (botón principal de submit) ──
              CLASE BASE: btn-primary (definida en globals.css — incluye color naranja, texto blanco, etc.)
              Para cambiar el COLOR DEL BOTÓN: edita .btn-primary en globals.css
              ANCHO: w-full max-w-[260px] (100% pero máximo 260px)
              ALTO: lo define .auth-card .btn-primary en globals.css (padding 0.95rem)
              MARGEN SUPERIOR: mt-3 (12px)
              ANIMACIÓN HOVER: hover:scale-105 (crece 5% al pasar el cursor)
              FUENTE: font-bold (negrita), tracking-wide (letras separadas) */}
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full max-w-[260px] mt-3 flex items-center justify-center font-bold tracking-wide transition-transform hover:scale-105 lowercase"
          >
            {/* SPINNER DE CARGA (visible solo mientras loading=true)
                TAMAÑO: w-5 h-5 (20x20px)
                BORDE: border-2 (2px), border-white/30 (blanco 30% transparente), border-t-white (arriba blanco)
                ANIMACIÓN: animate-spin (giro continuo) */}
            {loading ? (
               <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
               'ingresar'
            )}
          </button>
        </form>

        {/* ──────────────────────────────────────────────────────────────────
            ENLACES INFERIORES (Olvidé contraseña y Crear cuenta)
            MARGEN SUPERIOR: mt-8 (32px)
            ESPACIO ENTRE ENLACES: gap-2 (8px)
            ────────────────────────────────────────────────────────────────── */}
        <div className="mt-9 pt-7 w-full border-t border-navy-100 flex flex-col items-center gap-3">
          {/* ENLACE "olvidé la contraseña"
              COLOR: text-navy-500 (gris azulado — para cambiar: text-slate-500, text-gray-400)
              HOVER: hover:text-navy-700 (más oscuro al hover)
              TAMAÑO: text-lg (18px — para más grande: text-xl=20px) */}
          <Link href="/recuperar" className="text-navy-500 hover:text-navy-700 text-lg lowercase transition">
            olvidé la contraseña
          </Link>

          {/* ENLACE "crear cuenta nueva"
              COLOR: text-navy-900 (azul muy oscuro)
              HOVER: hover:text-accent-600 (naranja-anaranjado al hover)
              FUENTE: font-bold (negrita)
              TAMAÑO: text-lg (18px — para más grande: text-xl=20px) */}
          <Link href="/registro" className="text-navy-900 hover:text-accent-600 font-bold text-lg lowercase transition">
            crear cuenta nueva
          </Link>
        </div>
      </div>
    </main>
  )
}
