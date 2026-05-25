'use client'

/* ==========================================================================
 * ARCHIVO: page.js
 * RUTA: apps/web/app/recuperar/page.js
 * DESCRIPCIÓN: Vista para recuperar la contraseña mediante OTP.
 * FUNCIONALIDAD: Este archivo define la lógica y estructura para su respectivo módulo.
 * ========================================================================== */

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Phone, Lock, ArrowLeft, KeyRound, CheckCircle2 } from 'lucide-react'

export default function RecuperarPage() {
  const router = useRouter()
  
  // ── ENTRENAMIENTO: Flujo de 2 pasos ──────────────────────────────────────────
  // step 1: El usuario solo ingresa su celular.
  // step 2: El usuario ingresa el código OTP que le llegó al correo + su nueva contraseña.
  const [step, setStep] = useState(1) 
  
  // Step 1
  const [celular, setCelular] = useState('')
  
  // Step 2
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [emailEnviado, setEmailEnviado] = useState('')

  async function handleSendOTP(e) {
    e.preventDefault()
    setError('')
    
    const telLimpio = celular.replace(/\D/g, '')
    if (telLimpio.length !== 10) { 
      setError('El celular debe tener 10 dígitos.')
      return 
    }
    
    setLoading(true)

    // ── ENTRENAMIENTO: Paso 1 - Enviar OTP ──────────────────────────────────────
    // Llamamos a nuestra API que busca el correo real asociado a este celular
    // y usa Nodemailer para enviarle el código de 6 dígitos.
    try {
      const res = await fetch('/api/auth/otp/enviar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ celular: telLimpio }),
      })
      
      const data = await res.json()
      
      if (!res.ok) {
        throw new Error(data.error || 'Error al solicitar el código')
      }
      
      // Guardar el mensaje con el correo enmascarado que devuelve el backend
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
    
    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden')
      return
    }
    
    if (newPassword.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      return
    }
    
    if (otp.length !== 6) {
      setError('El código OTP debe tener 6 dígitos')
      return
    }

    setLoading(true)

    // ── ENTRENAMIENTO: Paso 2 - Verificar OTP y Cambiar Clave ───────────────────
    // Llamamos a nuestra API que valida que el código sea correcto y no esté expirado.
    // Si es correcto, la API usa permisos de Administrador para forzar el cambio
    // de la contraseña en Supabase Auth.
    try {
      const telLimpio = celular.replace(/\D/g, '')
      const res = await fetch('/api/auth/otp/verificar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ celular: telLimpio, otp, newPassword }),
      })
      
      const data = await res.json()
      
      if (!res.ok) {
        throw new Error(data.error || 'Código incorrecto o expirado')
      }
      
      setSuccess(true)
      setTimeout(() => {
        router.push('/login?reset=success')
      }, 3000)
      
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-white flex flex-col items-center justify-center px-4 relative overflow-hidden">
      {/* Formas decorativas */}
      <div className="bg-triangle-orange"></div>
      <div className="bg-triangle-navy"></div>

      {/* ── ENTRENAMIENTO: BOTÓN VOLVER ── 
           Igual que en el login, botón flotante superior izquierdo para salir del flujo.
      */}
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

      <div className="w-full max-w-sm animate-fade-in relative z-10 flex flex-col items-center">
        <div className="w-14 h-14 bg-navy-900 rounded-xl flex items-center justify-center mb-6 shadow-md">
          <span className="text-white font-extrabold text-2xl">P</span>
        </div>
        
        <h1 className="text-2xl font-bold text-navy-900 text-center uppercase tracking-wide mb-1">
          RECUPERAR<br/>CONTRASEÑA
        </h1>

        {/* ── ENTRENAMIENTO: MENSAJE DE ÉXITO ── 
             Si success es true, ocultamos el formulario y mostramos esta tarjeta 
             de confirmación verde antes de redirigir al login.
        */}
        {success ? (
          <div className="bg-white/90 backdrop-blur p-6 mt-6 rounded-3xl shadow-sm border border-emerald-100 text-center animate-fade-in flex flex-col items-center w-full">
            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            </div>
            <h2 className="text-lg font-bold text-emerald-900 mb-2 uppercase">¡Contraseña Actualizada!</h2>
            <p className="text-emerald-700/80 text-sm mb-6 lowercase">
              tu contraseña ha sido cambiada exitosamente. redirigiendo al login...
            </p>
          </div>
        ) : (
          <>
            {/* ── ENTRENAMIENTO: ESTADO DEL FORMULARIO ── 
                 Cambiamos dinámicamente el título y el onSubmit dependiendo del `step` 
                 en el que nos encontremos (1: Celular, 2: OTP).
            */}
            {step === 1 ? (
              <p className="text-navy-400 text-sm mb-8 text-center lowercase">
                ingresa tu celular para recibir un código al correo
              </p>
            ) : (
              <div className="w-full bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-6 text-center animate-fade-in">
                <p className="text-blue-800 text-xs font-semibold uppercase tracking-wide mb-1">📧 Código enviado</p>
                <p className="text-blue-700 text-sm">{emailEnviado}</p>
                <p className="text-blue-500 text-xs mt-1">Revisa también tu carpeta de spam</p>
              </div>
            )}

            <form onSubmit={step === 1 ? handleSendOTP : handleVerifyOTP} className="w-full space-y-4 flex flex-col items-center">
              {error && <div className="w-full bg-danger/10 text-danger rounded-lg p-3 text-sm animate-fade-in text-center">{error}</div>}
              
              {/* ── ENTRENAMIENTO: PASO 1 (Solo Celular) ── */}
              {step === 1 && (
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
                  />
                </div>
              )}

              {/* ── ENTRENAMIENTO: PASO 2 (OTP + Claves) ── 
                   Se muestra cuando el backend responde que el correo fue enviado.
                   Pide el código OTP de 6 dígitos y la nueva clave.
              */}
              {step === 2 && (
                <div className="w-full space-y-4 animate-fade-in">
                  <div className="w-full relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-navy-400">
                      <KeyRound size={18} />
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

                  <div className="w-full relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-navy-400">
                      <Lock size={18} />
                    </div>
                    <input 
                      id="newPassword" 
                      type="password" 
                      value={newPassword} 
                      onChange={(e) => setNewPassword(e.target.value)} 
                      placeholder="nueva contraseña" 
                      required 
                      minLength={6}
                      className="input-field" 
                    />
                  </div>

                  <div className="w-full relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-navy-400">
                      <Lock size={18} />
                    </div>
                    <input 
                      id="confirmPassword" 
                      type="password" 
                      value={confirmPassword} 
                      onChange={(e) => setConfirmPassword(e.target.value)} 
                      placeholder="confirmar contraseña" 
                      required 
                      minLength={6}
                      className="input-field" 
                    />
                  </div>
                </div>
              )}
              
              <button disabled={loading} type="submit" className="btn-primary w-full mt-4 py-3 flex items-center justify-center font-bold tracking-wide transition-transform hover:scale-105 lowercase">
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  step === 1 ? 'enviar código' : 'cambiar contraseña'
                )}
              </button>
              
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

        {/* ── ENTRENAMIENTO: ENLACES INFERIORES ── */}
        {!success && (
          <div className="mt-8 flex flex-col items-center gap-2">
            <Link href="/login" className="text-navy-400 hover:text-navy-600 text-sm lowercase transition">
              ya recordé mi contraseña
            </Link>
          </div>
        )}
      </div>
    </main>
  )
}
