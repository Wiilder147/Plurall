'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Phone, ArrowLeft } from 'lucide-react'

/*
  Alerta importante: Como la autenticación es vía un "correo virtual"
  generado a partir del celular (celular@plurall.app), no podemos
  enviar el enlace de recuperación de contraseña estándar de Supabase
  porque el usuario no tiene acceso a ese dominio.
  
  Para esta versión, este formulario mostrará un mensaje para
  contactar a soporte/administrador con el número celular.
*/
export default function RecuperarPage() {
  const [celular, setCelular] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleReset(e) {
    e.preventDefault()
    setError('')
    
    const telLimpio = celular.replace(/\D/g, '')
    if (telLimpio.length !== 10) { setError('El celular debe tener 10 dígitos.'); return }
    
    setLoading(true)

    // Simulamos un proceso de envío/ticket de soporte en 1 segundo
    setTimeout(() => {
      setSent(true)
      setLoading(false)
    }, 1000)
  }

  return (
    <main className="min-h-screen bg-white flex flex-col items-center justify-center px-4 relative overflow-hidden">
      {/* Formas decorativas */}
      <div className="bg-triangle-orange"></div>
      <div className="bg-triangle-navy"></div>

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

      <div className="w-full max-w-sm animate-fade-in relative z-10 flex flex-col items-center">
        <div className="w-14 h-14 bg-navy-900 rounded-xl flex items-center justify-center mb-6 shadow-md">
          <span className="text-white font-extrabold text-2xl">P</span>
        </div>
        
        <h1 className="text-2xl font-bold text-navy-900 text-center uppercase tracking-wide mb-1">
          RECUPERAR<br/>CONTRASEÑA
        </h1>

        {sent ? (
          <div className="bg-white/90 backdrop-blur p-6 mt-6 rounded-3xl shadow-sm border border-navy-50 text-center animate-fade-in flex flex-col items-center">
            <h2 className="text-lg font-bold text-navy-900 mb-2 uppercase">Solicitud Recibida</h2>
            <p className="text-navy-500 text-sm mb-6 lowercase">
              nuestro equipo se contactará contigo al celular {celular} para ayudarte a restablecer el acceso a tu cuenta.
            </p>
            <Link href="/login" className="btn-primary w-full text-center lowercase">volver a login</Link>
          </div>
        ) : (
          <>
            <p className="text-navy-400 text-sm mb-8 text-center lowercase">
              ingresa tu celular para recibir ayuda
            </p>
            <form onSubmit={handleReset} className="w-full space-y-4 flex flex-col items-center">
              {error && <div className="w-full bg-danger/10 text-danger rounded-lg p-3 text-sm animate-fade-in text-center">{error}</div>}
              
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
              
              <button disabled={loading} type="submit" className="btn-primary w-full max-w-[200px] mt-4 py-3 flex items-center justify-center font-bold tracking-wide transition-transform hover:scale-105 lowercase">
                {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'solicitar soporte'}
              </button>
            </form>
          </>
        )}

        {/* Links inferiores */}
        {!sent && (
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
