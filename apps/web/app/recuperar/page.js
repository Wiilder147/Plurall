'use client'

/* ==========================================================================
 * ARCHIVO: page.js
 * RUTA: apps/web/app/recuperar/page.js
 * DESCRIPCIÓN: Vista de recuperación de contraseña mediante código OTP.
 * FUNCIONALIDAD: Flujo en 2 pasos:
 *   Paso 1 — El usuario ingresa su celular, se envía un código de 6 dígitos al correo.
 *   Paso 2 — El usuario ingresa el código OTP + su nueva contraseña.
 * ========================================================================== */

import { useState, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Phone, Lock, ArrowLeft, KeyRound, CheckCircle2, Eye, EyeOff } from 'lucide-react'

export default function RecuperarPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [celular, setCelular] = useState('')
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  // C-02: mostrar/ocultar contraseña, igual que en /registro
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [emailEnviado, setEmailEnviado] = useState('')
  const [hints, setHints] = useState({})
  const hintTimers = useRef({})

  function showHint(field, msg) {
    setHints(prev => ({ ...prev, [field]: msg }))
    clearTimeout(hintTimers.current[field])
    hintTimers.current[field] = setTimeout(
      () => setHints(prev => ({ ...prev, [field]: '' })), 2500
    )
  }

  async function handleSendOTP(e) {
    e.preventDefault()
    setError('')
    const telLimpio = celular.replace(/\D/g, '')
    if (telLimpio.length !== 10) { setError('El celular debe tener 10 dígitos.'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/otp/enviar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ celular: telLimpio }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al solicitar el código')
      setEmailEnviado(data.message || 'Hemos enviado un código de 6 dígitos al correo electrónico asociado a este número.')
      setStep(2)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyOTP(e) {
    e.preventDefault()
    setError('')
    if (newPassword !== confirmPassword) { setError('Las contraseñas no coinciden'); return }
    if (newPassword.length < 6) { setError('La contraseña debe tener al menos 6 caracteres'); return }
    if (otp.length !== 6) { setError('El código OTP debe tener 6 dígitos'); return }
    setLoading(true)
    try {
      const telLimpio = celular.replace(/\D/g, '')
      const res = await fetch('/api/auth/otp/verificar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ celular: telLimpio, otp, newPassword }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Código incorrecto o expirado')
      setSuccess(true)
      setTimeout(() => { router.push('/login?reset=success') }, 3000)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    // PÁGINA PRINCIPAL
    // COLOR DE FONDO: bg-white (blanco — para cambiar: bg-slate-50, bg-gray-50)
    // CENTRADO: flex flex-col items-center justify-center
    // overflow-hidden: oculta los triángulos decorativos que sobresalen
    <main className="auth-shell relative min-h-screen flex flex-col items-center justify-center overflow-hidden">

      {/* TRIÁNGULOS DECORATIVOS DE FONDO (definidos en globals.css) */}
      <div className="bg-triangle-orange"></div>
      <div className="bg-triangle-navy"></div>

      {/* BOTÓN "VOLVER AL INICIO"
          POSICIÓN: fixed top-6 left-6 (esquina superior izquierda fija)
          COLOR FONDO: bg-white/90 (blanco 90% opacidad)
          BORDE: border border-slate-200 (gris claro), hover:border-orange-300 (naranja al hover)
          COLOR TEXTO: text-slate-700, hover:text-orange-600
          PADDING: px-4 py-2.5 (16px horizontal, 10px vertical)
          BORDES: rounded-xl (12px), TAMAÑO: text-sm (14px) */}
      <Link
        href="/"
        className="fixed top-6 left-6 z-40 inline-flex items-center gap-2 bg-white/90 backdrop-blur-sm border border-slate-200 text-slate-700 hover:text-orange-600 hover:border-orange-300 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-sm hover:shadow-md group"
      >
        {/* ÍCONO FLECHA — w-4 h-4 (16x16px) */}
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        <span className="hidden sm:inline">Volver al inicio</span>
        {/* MINI LOGO "P" — bg-slate-900, w-6 h-6 (24x24px), rounded-md */}
        <div className="w-6 h-6 bg-slate-900 rounded-md flex items-center justify-center sm:ml-1">
          <span className="text-white font-bold text-xs">P</span>
        </div>
      </Link>

      {/* TARJETA CENTRAL
          ANCHO MÁXIMO: lo define .auth-card en globals.css (480px)
          ANIMACIÓN: animate-fade-in (aparece suavemente) */}
      {/* Utilidades de layout inline para evitar el parpadeo a ancho completo
          mientras carga la clase .auth-card (ver login/page.js). */}
      <div className="auth-card animate-fade-in w-full max-w-[30rem] mx-auto flex flex-col items-center bg-white rounded-[2rem] shadow-xl">

        {/* LOGO CUADRADO "P"
            COLOR FONDO: bg-navy-900 (azul muy oscuro)
            TAMAÑO: w-14 h-14 (56x56px), BORDES: rounded-xl (12px)
            SOMBRA: shadow-md, MARGEN INFERIOR: mb-6 (24px) */}
        <div className="w-20 h-20 bg-navy-900 rounded-2xl flex items-center justify-center mb-7 shadow-lg">
          {/* LETRA "P" — text-white, font-extrabold (extra negrita), text-2xl (24px) */}
          <span className="text-[#ffffff] font-extrabold text-4xl">P</span>
        </div>

        {/* TÍTULO "RECUPERAR CONTRASEÑA"
            COLOR: text-navy-900 (azul muy oscuro)
            TAMAÑO: text-2xl (24px), font-bold, uppercase, tracking-wide */}
        <h1 className="text-3xl md:text-4xl font-bold text-navy-900 text-center uppercase tracking-wide leading-tight mb-2">
          RECUPERAR<br/>CONTRASEÑA
        </h1>

        {/* ── PANTALLA DE ÉXITO (reemplaza el formulario cuando success = true) ──
            COLOR FONDO: bg-white/90 con borde border-emerald-100 (verde muy claro)
            PADDING: p-6 (24px), BORDES: rounded-3xl (24px muy redondeados)
            ANIMACIÓN: animate-fade-in */}
        {success ? (
          <div className="bg-white/90 backdrop-blur p-6 mt-6 rounded-3xl shadow-sm border border-emerald-100 text-center animate-fade-in flex flex-col items-center w-full">
            {/* CÍRCULO ÍCONO ÉXITO
                COLOR FONDO: bg-emerald-100 (verde claro)
                TAMAÑO: w-12 h-12 (48x48px), BORDES: rounded-full
                ÍCONO: w-6 h-6 (24x24px), color text-emerald-600 (verde medio) */}
            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            </div>
            {/* TÍTULO ÉXITO — text-lg (18px), font-bold, text-emerald-900, uppercase */}
            <h2 className="text-lg font-bold text-emerald-900 mb-2 uppercase">¡Contraseña Actualizada!</h2>
            {/* MENSAJE — text-emerald-700/80 (verde con 80% opacidad), text-sm (14px) */}
            <p className="text-emerald-700/80 text-sm mb-6 lowercase">
              tu contraseña ha sido cambiada exitosamente. redirigiendo al login...
            </p>
          </div>
        ) : (
          <>
            {/* ── SUBTÍTULO DINÁMICO según el paso ── */}
            {step === 1 ? (
              // TEXTO DEL PASO 1
              // COLOR: text-navy-500 (gris azulado), TAMAÑO: text-lg (18px)
              <p className="text-navy-500 text-lg mb-9 text-center lowercase">
                ingresa tu celular para recibir un código al correo
              </p>
            ) : (
              // BANNER "Código enviado" (Paso 2)
              // COLOR FONDO: bg-blue-50 (azul muy claro), BORDE: border border-blue-200 (azul claro)
              // BORDES: rounded-xl (12px), PADDING: px-4 py-3 (16px horizontal, 12px vertical)
              // MARGEN INFERIOR: mb-6 (24px)
              <div className="w-full bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-6 text-center animate-fade-in">
                {/* ETIQUETA "Código enviado" — text-blue-800, text-xs (12px), uppercase */}
                <p className="text-blue-800 text-xs font-semibold uppercase tracking-wide mb-1">📧 Código enviado</p>
                {/* MENSAJE CON CORREO ENMASCARADO — text-blue-700, text-sm (14px) */}
                <p className="text-blue-700 text-sm">{emailEnviado}</p>
                {/* TEXTO SPAM — text-blue-500, text-xs (12px) */}
                <p className="text-blue-500 text-xs mt-1">Revisa también tu carpeta de spam</p>
              </div>
            )}

            {/* FORMULARIO — onSubmit cambia según el paso */}
            <form onSubmit={step === 1 ? handleSendOTP : handleVerifyOTP} className="w-full space-y-5 flex flex-col items-center">

              {/* MENSAJE DE ERROR
                  COLOR FONDO: bg-danger/10 (rojo muy suave)
                  COLOR TEXTO: text-danger (rojo)
                  PADDING: p-3 (12px), BORDES: rounded-lg (8px), TAMAÑO: text-sm (14px) */}
              {error && <div className="w-full bg-danger/10 text-danger rounded-lg p-3 text-sm animate-fade-in text-center">{error}</div>}

              {/* ── PASO 1: CAMPO CELULAR ── */}
              {step === 1 && (
                <div className="w-full relative">
                  {/* ÍCONO TELÉFONO — absolute left-4, centrado vertical
                      COLOR: text-navy-400, TAMAÑO: size={20} (20px) */}
                  <div className="absolute left-5 top-1/2 -translate-y-1/2 text-navy-400">
                    <Phone size={20} />
                  </div>
                  {/* INPUT CELULAR — clase input-field (definida en globals.css)
                      maxLength={10} — máximo 10 dígitos */}
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
                  />
                  {hints.celular && <p className="text-xs text-amber-500 mt-1 ml-1 animate-fade-in">⚠ {hints.celular}</p>}
                </div>
              )}

              {/* ── PASO 2: CAMPOS OTP + CONTRASEÑAS ── */}
              {step === 2 && (
                <div className="w-full space-y-4 animate-fade-in">

                  {/* CAMPO CÓDIGO OTP
                      ÍCONO: KeyRound (llave), color text-navy-400
                      tracking-widest — letras muy separadas para el código
                      text-center text-lg font-bold — centrado y grande para claridad
                      maxLength implícito por el .slice(0, 6) en el onChange */}
                  <div className="w-full relative">
                    <div className="absolute left-5 top-1/2 -translate-y-1/2 text-navy-400">
                      <KeyRound size={20} />
                    </div>
                    <input
                      id="otp"
                      type="text"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="código de 6 dígitos"
                      required
                      className="input-field tracking-widest text-center text-lg font-bold"
                    />
                  </div>

                  {/* CAMPO NUEVA CONTRASEÑA
                      ÍCONO: Lock (candado), color text-navy-400 */}
                  <div className="w-full relative">
                    <div className="absolute left-5 top-1/2 -translate-y-1/2 text-navy-400">
                      <Lock size={20} />
                    </div>
                    <input
                      id="newPassword"
                      type={showPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="nueva contraseña"
                      required
                      minLength={6}
                      className="input-field pr-12"
                    />
                    <button type="button" onClick={() => setShowPassword(v => !v)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-navy-400 hover:text-navy-700 transition-colors"
                      aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}>
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>

                  {/* CAMPO CONFIRMAR CONTRASEÑA */}
                  <div className="w-full relative">
                    <div className="absolute left-5 top-1/2 -translate-y-1/2 text-navy-400">
                      <Lock size={20} />
                    </div>
                    <input
                      id="confirmPassword"
                      type={showConfirm ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      onPaste={(e) => e.preventDefault()}
                      onCopy={(e) => e.preventDefault()}
                      onCut={(e) => e.preventDefault()}
                      onDrop={(e) => e.preventDefault()}
                      autoComplete="new-password"
                      placeholder="confirmar contraseña"
                      required
                      minLength={6}
                      className="input-field pr-12"
                    />
                    <button type="button" onClick={() => setShowConfirm(v => !v)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-navy-400 hover:text-navy-700 transition-colors"
                      aria-label={showConfirm ? 'Ocultar contraseña' : 'Ver contraseña'}>
                      {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
              )}

              {/* BOTÓN PRINCIPAL DE SUBMIT
                  CLASE: btn-primary (naranja, definida en globals.css)
                  Para cambiar COLOR: edita .btn-primary en globals.css
                  ANCHO: w-full (100%), PADDING: py-3 (12px vertical)
                  MARGEN: mt-4 (16px arriba)
                  ANIMACIÓN HOVER: hover:scale-105 */}
              <button disabled={loading} type="submit" className="btn-primary w-full mt-5 flex items-center justify-center font-bold tracking-wide transition-transform hover:scale-105 lowercase">
                {/* SPINNER — visible mientras loading=true */}
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  step === 1 ? 'enviar código' : 'cambiar contraseña'
                )}
              </button>

              {/* BOTÓN "cambiar número" (solo visible en el paso 2)
                  COLOR: text-navy-400, hover:text-navy-600 (gris azulado)
                  TAMAÑO: text-xs (12px), subrayado */}
              {step === 2 && (
                <button
                  type="button"
                  onClick={() => { setStep(1); setOtp(''); setError(''); }}
                  disabled={loading}
                  className="text-navy-400 hover:text-navy-600 text-xs lowercase mt-2 underline"
                >
                  cambiar número
                </button>
              )}
            </form>
          </>
        )}

        {/* ENLACE "ya recordé mi contraseña" (oculto cuando success=true)
            COLOR: text-navy-400, hover:text-navy-600
            TAMAÑO: text-sm (14px)
            MARGEN SUPERIOR: mt-8 (32px) */}
        {!success && (
          <div className="mt-9 pt-7 w-full border-t border-navy-100 flex flex-col items-center gap-3">
            <Link href="/login" className="text-navy-500 hover:text-navy-700 text-base lowercase transition">
              ya recordé mi contraseña
            </Link>
          </div>
        )}
      </div>
    </main>
  )
}
