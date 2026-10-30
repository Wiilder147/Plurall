'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { calcularAmortizacion, formatCOP } from '@/lib/calculadora'
import { MONTO_MIN, MONTO_MAX, PLAZOS } from '@/lib/producto'
import { esEmailValido } from '@/lib/validacion'
import {
  X, ArrowRight, ArrowLeft, CheckCircle,
  Phone, Lock, User, IdCard, Mail, Eye, EyeOff,
  Loader2, AlertTriangle, TrendingUp,
} from 'lucide-react'

const TASA_ANUAL = 28


const PRE_PREGUNTAS = [
  {
    id: 'fuente',
    label: '¿Cuál es tu fuente principal de ingresos?',
    opciones: [
      { valor: 'empleado',      texto: 'Empleado (salario fijo)',       puntos: 30 },
      { valor: 'independiente', texto: 'Independiente / Emprendedor',   puntos: 20 },
      { valor: 'pensionado',    texto: 'Pensionado',                    puntos: 25 },
      { valor: 'otro',          texto: 'Otro',                          puntos: 10 },
    ],
  },
  {
    id: 'deuda',
    label: '¿Tienes deudas activas actualmente?',
    opciones: [
      { valor: 'no',        texto: 'No tengo deudas',          puntos: 40 },
      { valor: 'si_pocas',  texto: 'Sí, pero pocas y al día',  puntos: 20 },
      { valor: 'si_varias', texto: 'Sí, varias deudas',        puntos: 5  },
    ],
  },
  {
    id: 'ingreso',
    label: '¿Cuáles son tus ingresos mensuales aproximados?',
    opciones: [
      { valor: 'menos1m', texto: 'Menos de $1.000.000',             puntos: 10 },
      { valor: '1m_2m',   texto: 'Entre $1.000.000 y $2.000.000',   puntos: 20 },
      { valor: '2m_5m',   texto: 'Entre $2.000.000 y $5.000.000',   puntos: 30 },
      { valor: 'mas5m',   texto: 'Más de $5.000.000',               puntos: 40 },
    ],
  },
  {
    id: 'experiencia',
    label: '¿Cuánto tiempo llevas en tu actividad económica actual?',
    opciones: [
      { valor: 'menos6m', texto: 'Menos de 6 meses',           puntos: 5  },
      { valor: '6m_2y',   texto: 'Entre 6 meses y 2 años',     puntos: 20 },
      { valor: 'mas2y',   texto: 'Más de 2 años',              puntos: 35 },
    ],
  },
  {
    id: 'proposito',
    label: '¿Para qué utilizarás el crédito?',
    opciones: [
      { valor: 'capital',    texto: 'Capital de trabajo',        puntos: 30 },
      { valor: 'inventario', texto: 'Compra de inventario',      puntos: 25 },
      { valor: 'equipos',    texto: 'Equipos o maquinaria',      puntos: 20 },
      { valor: 'otro',       texto: 'Otro propósito',            puntos: 10 },
    ],
  },
]

function calcularSoftScore(respuestas) {
  return PRE_PREGUNTAS.reduce((total, p) => {
    const op = p.opciones.find(o => o.valor === respuestas[p.id])
    return total + (op?.puntos ?? 0)
  }, 0) // max 175
}

function getSoftResult(score) {
  if (score >= 110) return {
    tipo: 'alta',
    emoji: '🎯',
    title: '¡Perfil con alta probabilidad de aprobación!',
    desc: 'Tus respuestas indican un perfil crediticio sólido. Completa tu cuenta para continuar.',
    color: 'text-emerald-700',
    bg: 'bg-emerald-50 border-emerald-200',
  }
  if (score >= 65) return {
    tipo: 'media',
    emoji: '📋',
    title: 'Tu perfil califica con revisión',
    desc: 'Tu solicitud puede avanzar aunque requerirá análisis adicional por nuestro comité.',
    color: 'text-blue-700',
    bg: 'bg-blue-50 border-blue-200',
  }
  return {
    tipo: 'baja',
    emoji: '⚠️',
    title: 'Perfil con riesgo elevado',
    desc: 'En este momento tu historial podría no cumplir los criterios mínimos. Puedes intentarlo igualmente.',
    color: 'text-orange-700',
    bg: 'bg-orange-50 border-orange-200',
  }
}

const REG_INITIAL = {
  primer_nombre: '', segundo_nombre: '', primer_apellido: '', segundo_apellido: '',
  email: '', dni: '', telefono: '',
  password: '', confirmPassword: '', aceptaTerminos: false,
}

export default function CreditFunnelModal({ isOpen, onClose }) {
  const router   = useRouter()
  const [supabase] = useState(() => createClient())

  // Wizard state
  const [step,     setStep]     = useState(1)
  const [authMode, setAuthMode] = useState('registro')

  // Step 1
  const [monto, setMonto] = useState(1_000_000)
  const [plazo, setPlazo] = useState(12)

  // Step 2
  const [preRespuestas, setPreRespuestas] = useState({})

  // Step 4 – auth
  const [regForm,      setRegForm]      = useState(REG_INITIAL)
  const [loginForm,    setLoginForm]    = useState({ celular: '', password: '' })
  const [showPwd,      setShowPwd]      = useState(false)
  const [showConfirm,  setShowConfirm]  = useState(false)
  const [authError,    setAuthError]    = useState('')
  const [authLoading,  setAuthLoading]  = useState(false)
  const [currentUser,  setCurrentUser]  = useState(null)
  const [checkingUser, setCheckingUser] = useState(true)
  const [hints,        setHints]        = useState({})
  const hintTimers = useRef({})

  function showHint(field, msg) {
    setHints(prev => ({ ...prev, [field]: msg }))
    clearTimeout(hintTimers.current[field])
    hintTimers.current[field] = setTimeout(
      () => setHints(prev => ({ ...prev, [field]: '' })), 2500
    )
  }

  // Derived
  const { cuotaMensual, totalPagar, totalIntereses } = useMemo(
    () => calcularAmortizacion(monto, TASA_ANUAL, plazo),
    [monto, plazo],
  )
  const softScore     = calcularSoftScore(preRespuestas)
  const softResult    = getSoftResult(softScore)
  const precalCompleta = PRE_PREGUNTAS.every(p => preRespuestas[p.id])

  // Check if user is already authenticated
  useEffect(() => {
    supabase.auth.getUser()
      .then(({ data: { user } }) => setCurrentUser(user ?? null))
      .catch(() => {})
      .finally(() => setCheckingUser(false))
  }, [supabase])

  // Prevent body scroll while open
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  // Reset internal state when modal closes (delayed to allow close animation)
  useEffect(() => {
    if (isOpen) return
    const t = setTimeout(() => {
      setStep(1)
      setAuthMode('registro')
      setPreRespuestas({})
      setRegForm(REG_INITIAL)
      setLoginForm({ celular: '', password: '' })
      setShowPwd(false)
      setShowConfirm(false)
      setAuthError('')
    }, 300)
    return () => clearTimeout(t)
  }, [isOpen])

  function switchAuthMode(mode) {
    setAuthMode(mode)
    setAuthError('')
    setShowPwd(false)
    setShowConfirm(false)
  }

  function saveAndRedirect() {
    localStorage.setItem('plurall_resume_funnel', JSON.stringify({
      monto,
      plazo,
      prequalificado: true,
      ts: Date.now(),
    }))
    router.push('/dashboard/creditos/solicitar?resume=true')
  }

  function fireEvent(evento, metadata = {}) {
    fetch('/api/eventos/funnel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ evento, metadata }),
    }).catch(() => null)
  }

  // Step 3 CTA: skip auth if already logged in
  function handleContinueFromResult() {
    if (currentUser) {
      saveAndRedirect()
    } else {
      setStep(4)
    }
  }

  async function handleRegistro(e) {
    e.preventDefault()
    setAuthError('')

    const telLimpio = regForm.telefono.replace(/\D/g, '')
    if (!regForm.primer_nombre.trim())         { setAuthError('El primer nombre es obligatorio.'); return }
    if (!regForm.primer_apellido.trim())       { setAuthError('El primer apellido es obligatorio.'); return }
    if (telLimpio.length !== 10)               { setAuthError('El celular debe tener 10 dígitos.'); return }
    // El type="email" nativo acepta "usuario@gmail" sin TLD; esta validación exige dominio completo
    if (!esEmailValido(regForm.email)) {
      setAuthError('Ingresa un correo completo y válido, por ejemplo: tucorreo@gmail.com'); return
    }
    if (!regForm.aceptaTerminos)               { setAuthError('Acepta los términos y condiciones.'); return }
    if (regForm.password !== regForm.confirmPassword) { setAuthError('Las contraseñas no coinciden.'); return }
    if (regForm.password.length < 6)           { setAuthError('La contraseña requiere mínimo 6 caracteres.'); return }

    setAuthLoading(true)
    const fakeEmail = `${telLimpio}@plurall.app`

    const { error } = await supabase.auth.signUp({
      email:    fakeEmail,
      password: regForm.password,
      options: {
        data: {
          primer_nombre:    regForm.primer_nombre.trim(),
          segundo_nombre:   regForm.segundo_nombre.trim() || null,
          primer_apellido:  regForm.primer_apellido.trim(),
          segundo_apellido: regForm.segundo_apellido.trim() || null,
          telefono:        telLimpio,
          dni:             regForm.dni,
          email_real:      regForm.email.trim().toLowerCase(),
        },
      },
    })

    if (error) {
      setAuthError(
        error.message.includes('already registered')
          ? 'Este celular ya está registrado. Cambia a "Ya tengo cuenta".'
          : `Error: ${error.message}`,
      )
      setAuthLoading(false)
      return
    }

    fireEvent('REGISTRO_DESDE_FUNNEL', { monto, plazo })
    saveAndRedirect()
  }

  async function handleLogin(e) {
    e.preventDefault()
    setAuthError('')

    const telLimpio = loginForm.celular.replace(/\D/g, '')
    if (telLimpio.length !== 10) { setAuthError('El celular debe tener 10 dígitos.'); return }

    setAuthLoading(true)

    // Login en el servidor (H3): bloqueo por intentos aplicado antes de autenticar
    try {
      const res  = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ celular: telLimpio, password: loginForm.password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setAuthError(data.error || 'Celular o contraseña incorrectos.')
        setAuthLoading(false)
        return
      }
    } catch {
      setAuthError('No pudimos conectar con el servidor. Intenta de nuevo.')
      setAuthLoading(false)
      return
    }

    fireEvent('LOGIN_DESDE_FUNNEL', { monto, plazo })
    saveAndRedirect()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-navy-950/60 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Cerrar modal"
      />

      {/* Panel */}
      <div className="relative bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-2xl max-h-[92vh] sm:max-h-[88vh] overflow-y-auto animate-fade-in">

        {/* Progress bar */}
        <div className="h-1 bg-slate-100 rounded-tl-3xl rounded-tr-3xl overflow-hidden">
          <div
            className="h-full bg-accent-500 transition-all duration-500 ease-out"
            style={{ width: `${(step / 4) * 100}%` }}
          />
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 bg-slate-100 hover:bg-slate-200 rounded-full flex items-center justify-center transition-colors"
          aria-label="Cerrar"
          type="button"
        >
          <X className="w-4 h-4 text-slate-600" />
        </button>

        <div className="p-6 sm:p-8">

          {/* ── STEP 1: COTIZADOR ─────────────────────────────────── */}
          {step === 1 && (
            <div className="animate-fade-in">
              <p className="text-xs font-bold text-accent-500 uppercase tracking-wider mb-1">Paso 1 de 4</p>
              <h2 className="text-2xl sm:text-3xl font-bold text-navy-900">¿Cuánto necesitas?</h2>
              <p className="text-slate-500 text-sm sm:text-base mt-1 mb-6">Ajusta el monto y plazo que se adapten a tu negocio.</p>

              <div className="space-y-6">
                <div>
                  <div className="flex justify-between items-baseline mb-2">
                    <label className="font-semibold text-slate-700 text-sm sm:text-base">Monto a solicitar</label>
                    <span className="font-bold text-navy-900 text-xl sm:text-2xl tracking-tight">{formatCOP(monto)}</span>
                  </div>
                  <input
                    type="range" min={MONTO_MIN} max={MONTO_MAX} step="50000" value={monto}
                    onChange={e => setMonto(Number(e.target.value))}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-orange-500"
                  />
                  <div className="flex justify-between text-base font-semibold text-slate-500 mt-2">
                    <span>{formatCOP(MONTO_MIN)}</span><span>{formatCOP(MONTO_MAX)}</span>
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 text-sm block mb-2">Plazo</label>
                  <div className="flex gap-2">
                    {PLAZOS.map(m => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setPlazo(m)}
                        className={`flex-1 py-2.5 rounded-xl border-2 font-bold text-sm transition-all ${
                          plazo === m
                            ? 'border-accent-500 bg-accent-50 text-accent-600'
                            : 'border-slate-200 text-slate-600 hover:border-accent-300'
                        }`}
                      >
                        {m} meses
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-gradient-to-br from-slate-900 to-blue-900 rounded-2xl p-6 sm:p-7 text-white">
                  <span className="text-blue-200 text-sm font-medium">Cuota mensual estimada</span>
                  <p className="text-4xl sm:text-5xl font-extrabold text-orange-400 mt-1.5 tracking-tight">{formatCOP(cuotaMensual)}</p>
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/10 text-blue-200 text-base gap-3">
                    <span>Intereses: <strong className="text-white">{formatCOP(totalIntereses)}</strong></span>
                    <span>Total: <strong className="text-white">{formatCOP(totalPagar)}</strong></span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setStep(2)}
                className="mt-6 w-full flex items-center justify-center gap-2 bg-accent-500 hover:bg-accent-600 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-accent-500/20"
              >
                Continuar <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* ── STEP 2: PRECALIFICACIÓN ───────────────────────────── */}
          {step === 2 && (
            <div className="animate-fade-in">
              <p className="text-xs font-bold text-accent-500 uppercase tracking-wider mb-1">Paso 2 de 4</p>
              <h2 className="text-2xl font-bold text-navy-900">Cuéntanos sobre ti</h2>
              <p className="text-slate-500 text-sm mt-1 mb-6">3 preguntas rápidas para evaluar tu perfil.</p>

              <div className="space-y-6">
                {PRE_PREGUNTAS.map((p, idx) => (
                  <div key={p.id}>
                    <p className="font-semibold text-slate-800 text-sm mb-2">{idx + 1}. {p.label}</p>
                    <div className="grid grid-cols-1 gap-2">
                      {p.opciones.map(op => {
                        const selected = preRespuestas[p.id] === op.valor
                        return (
                          <button
                            key={op.valor}
                            type="button"
                            onClick={() => setPreRespuestas(prev => ({ ...prev, [p.id]: op.valor }))}
                            className={`text-left px-4 py-3 rounded-xl border text-sm font-medium transition-all flex items-center gap-2 ${
                              selected
                                ? 'border-accent-500 bg-accent-50 text-accent-700'
                                : 'border-slate-200 hover:border-accent-300 text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <CheckCircle className={`w-4 h-4 shrink-0 transition-opacity ${selected ? 'text-accent-500 opacity-100' : 'opacity-0'}`} />
                            {op.texto}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex items-center gap-1 text-slate-500 hover:text-slate-700 font-medium py-3 px-4 rounded-xl transition-all text-sm"
                >
                  <ArrowLeft className="w-4 h-4" /> Atrás
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  disabled={!precalCompleta}
                  className="flex-1 flex items-center justify-center gap-2 bg-accent-500 hover:bg-accent-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-accent-500/20 disabled:shadow-none"
                >
                  Ver mi resultado <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 3: RESULTADO SOFT ────────────────────────────── */}
          {step === 3 && (
            <div className="animate-fade-in">
              <p className="text-xs font-bold text-accent-500 uppercase tracking-wider mb-1">Paso 3 de 4</p>
              <h2 className="text-2xl sm:text-3xl font-bold text-navy-900 mb-5">Tu resultado</h2>

              <div className={`border rounded-2xl p-6 sm:p-7 text-center mb-5 ${softResult.bg}`}>
                <div className="text-5xl mb-3">{softResult.emoji}</div>
                <h3 className={`font-bold text-lg sm:text-xl mb-2 ${softResult.color}`}>{softResult.title}</h3>
                <p className="text-slate-600 text-sm sm:text-base leading-relaxed">{softResult.desc}</p>
              </div>

              {/* Resumen del crédito */}
              <div className="bg-slate-50 rounded-xl p-5 sm:p-6 mb-5">
                <p className="font-semibold text-slate-800 text-base mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-accent-500" />
                  Tu crédito estimado
                </p>
                <div className="space-y-3 text-base text-slate-600">
                  <div className="flex justify-between items-baseline">
                    <span>Monto</span>
                    <strong className="text-slate-900 text-lg">{formatCOP(monto)}</strong>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span>Plazo</span>
                    <strong className="text-slate-900 text-lg">{plazo} meses</strong>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span>Cuota estimada</span>
                    <strong className="text-accent-600 text-lg">{formatCOP(cuotaMensual)}</strong>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="flex items-center gap-1 text-slate-500 hover:text-slate-700 font-medium py-3 px-4 rounded-xl transition-all text-sm"
                >
                  <ArrowLeft className="w-4 h-4" /> Atrás
                </button>

                {softResult.tipo === 'baja' ? (
                  // Baja: show both options — close or continue anyway
                  <div className="flex-1 flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={handleContinueFromResult}
                      className="w-full flex items-center justify-center gap-2 bg-accent-500 hover:bg-accent-600 text-white font-bold py-3 rounded-xl transition-all text-sm"
                    >
                      {checkingUser ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Intentarlo de todas formas'}
                    </button>
                    <button
                      type="button"
                      onClick={onClose}
                      className="w-full py-2.5 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-700 font-medium text-sm transition-all"
                    >
                      Entendido, cerrar
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleContinueFromResult}
                    disabled={checkingUser}
                    className="flex-1 flex items-center justify-center gap-2 bg-accent-500 hover:bg-accent-600 disabled:bg-accent-300 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-accent-500/20"
                  >
                    {checkingUser
                      ? <Loader2 className="w-5 h-5 animate-spin" />
                      : <>{currentUser ? 'Continuar al formulario' : '¡Quiero continuar!'} <ArrowRight className="w-5 h-5" /></>
                    }
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── STEP 4: AUTH ─────────────────────────────────────── */}
          {step === 4 && (
            <div className="animate-fade-in">
              <p className="text-xs font-bold text-accent-500 uppercase tracking-wider mb-1">Paso 4 de 4</p>
              <h2 className="text-2xl sm:text-3xl font-bold text-navy-900 mt-1">
                {authMode === 'registro' ? 'Crea tu cuenta' : 'Inicia sesión'}
              </h2>
              <p className="text-slate-500 text-sm sm:text-base mt-1 mb-5">
                {authMode === 'registro'
                  ? 'Un paso más para completar tu solicitud.'
                  : 'Ingresa tus datos para continuar con tu solicitud.'}
              </p>

              {/* Tabs */}
              <div className="flex bg-slate-100 rounded-xl p-1 mb-5 gap-1">
                <button
                  type="button"
                  onClick={() => switchAuthMode('registro')}
                  className={`flex-1 py-2.5 rounded-lg text-base font-semibold transition-all ${
                    authMode === 'registro' ? 'bg-white shadow text-navy-900' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Registrarme
                </button>
                <button
                  type="button"
                  onClick={() => switchAuthMode('login')}
                  className={`flex-1 py-2.5 rounded-lg text-base font-semibold transition-all ${
                    authMode === 'login' ? 'bg-white shadow text-navy-900' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Ya tengo cuenta
                </button>
              </div>

              {authError && (
                <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-sm text-red-700 animate-fade-in">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <p>{authError}</p>
                </div>
              )}

              {/* ── REGISTRO FORM ── */}
              {authMode === 'registro' && (
                <form onSubmit={handleRegistro} className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'primer_nombre',    label: 'Primer nombre *',    placeholder: 'Juan',   required: true },
                      { id: 'segundo_nombre',   label: 'Segundo nombre',     placeholder: 'Opcional', required: false },
                      { id: 'primer_apellido',  label: 'Primer apellido *',  placeholder: 'Pérez',  required: true },
                      { id: 'segundo_apellido', label: 'Segundo apellido',   placeholder: 'Opcional', required: false },
                    ].map(f => (
                      <div key={f.id}>
                        <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">{f.label}</label>
                        <input
                          type="text"
                          value={regForm[f.id]}
                          onChange={e => {
                            const clean = e.target.value.replace(/[0-9]/g, '')
                            if (clean !== e.target.value) showHint(f.id, 'No debe contener números')
                            setRegForm(prev => ({ ...prev, [f.id]: clean }))
                          }}
                          placeholder={f.placeholder}
                          required={f.required}
                          className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-accent-400 text-slate-900"
                        />
                        {hints[f.id] && <p className="text-xs text-amber-500 mt-1 ml-1 animate-fade-in">⚠ {hints[f.id]}</p>}
                      </div>
                    ))}
                  </div>
                  {[
                    { id: 'email',    label: 'Correo electrónico',       type: 'email', inputMode: undefined,   icon: <Mail size={16} />,   placeholder: 'tucorreo@ejemplo.com' },
                    { id: 'dni',      label: 'Documento (CC)',           type: 'text',  inputMode: 'numeric',   icon: <IdCard size={16} />, placeholder: 'Ej. 1020304050', maxLength: 12 },
                    { id: 'telefono', label: 'Celular (10 dígitos)',     type: 'tel',   inputMode: 'numeric',   icon: <Phone size={16} />,  placeholder: 'Ej. 3001234567', maxLength: 10 },
                  ].map(f => (
                    <div key={f.id} className="relative">
                      <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">{f.label}</label>
                      <div className="absolute left-3 top-[36px] -translate-y-1/2 text-slate-400">{f.icon}</div>
                      <input
                        type={f.type}
                        inputMode={f.inputMode}
                        value={regForm[f.id]}
                        onChange={e => {
                          let val = e.target.value
                          if (f.id === 'dni' || f.id === 'telefono') {
                            const clean = val.replace(/\D/g, '')
                            if (clean !== val) showHint(f.id, 'Solo se permiten números en este campo')
                            val = clean
                          }
                          setRegForm(prev => ({ ...prev, [f.id]: val }))
                        }}
                        placeholder={f.placeholder}
                        required
                        maxLength={f.maxLength}
                        className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-accent-400 text-slate-900"
                      />
                      {hints[f.id] && <p className="text-xs text-amber-500 mt-1 ml-1 animate-fade-in">⚠ {hints[f.id]}</p>}
                    </div>
                  ))}

                  <div className="relative">
                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Contraseña</label>
                    <div className="absolute left-3 top-[36px] -translate-y-1/2 text-slate-400"><Lock size={16} /></div>
                    <input
                      type={showPwd ? 'text' : 'password'}
                      value={regForm.password}
                      onChange={e => setRegForm(prev => ({ ...prev, password: e.target.value }))}
                      placeholder="Mínimo 6 caracteres"
                      required minLength={6}
                      className="w-full pl-9 pr-10 py-2.5 border border-slate-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-accent-400 text-slate-900"
                    />
                    <button type="button" onClick={() => setShowPwd(v => !v)}
                      className="absolute right-3 top-[36px] -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>

                  <div className="relative">
                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Repetir contraseña</label>
                    <div className="absolute left-3 top-[36px] -translate-y-1/2 text-slate-400"><Lock size={16} /></div>
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      value={regForm.confirmPassword}
                      onChange={e => setRegForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                      placeholder="Repite tu contraseña"
                      required minLength={6}
                      className="w-full pl-9 pr-10 py-2.5 border border-slate-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-accent-400 text-slate-900"
                    />
                    <button type="button" onClick={() => setShowConfirm(v => !v)}
                      className="absolute right-3 top-[36px] -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>

                  <label className="flex items-start gap-2 cursor-pointer mt-1">
                    <input
                      type="checkbox"
                      checked={regForm.aceptaTerminos}
                      onChange={e => setRegForm(prev => ({ ...prev, aceptaTerminos: e.target.checked }))}
                      className="mt-0.5 accent-accent-600 w-4 h-4 shrink-0"
                    />
                    <span className="text-slate-500 text-xs leading-relaxed">
                      Acepto la política de tratamiento de datos personales (Ley 1581/2012)
                    </span>
                  </label>

                  <div className="flex gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => setStep(3)}
                      className="flex items-center gap-1 text-slate-500 hover:text-slate-700 font-medium py-3 px-3 rounded-xl transition-all text-sm"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="submit"
                      disabled={authLoading}
                      className="flex-1 flex items-center justify-center gap-2 bg-accent-500 hover:bg-accent-600 disabled:bg-accent-300 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-accent-500/20 text-sm"
                    >
                      {authLoading
                        ? <Loader2 className="w-5 h-5 animate-spin" />
                        : 'Crear cuenta y continuar'}
                    </button>
                  </div>
                </form>
              )}

              {/* ── LOGIN FORM ── */}
              {authMode === 'login' && (
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="relative">
                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Celular</label>
                    <div className="absolute left-3 top-[36px] -translate-y-1/2 text-slate-400"><Phone size={16} /></div>
                    <input
                      type="tel"
                      inputMode="numeric"
                      value={loginForm.celular}
                      onChange={e => {
                        const raw = e.target.value
                        const clean = raw.replace(/\D/g, '')
                        if (raw !== clean) showHint('loginCelular', 'Solo se permiten números en este campo')
                        setLoginForm(prev => ({ ...prev, celular: clean }))
                      }}
                      placeholder="Ej. 3001234567"
                      required maxLength={10}
                      className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-accent-400 text-slate-900"
                    />
                    {hints.loginCelular && <p className="text-xs text-amber-500 mt-1 ml-1 animate-fade-in">⚠ {hints.loginCelular}</p>}
                  </div>

                  <div className="relative">
                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Contraseña</label>
                    <div className="absolute left-3 top-[36px] -translate-y-1/2 text-slate-400"><Lock size={16} /></div>
                    <input
                      type={showPwd ? 'text' : 'password'}
                      value={loginForm.password}
                      onChange={e => setLoginForm(prev => ({ ...prev, password: e.target.value }))}
                      placeholder="Tu contraseña"
                      required
                      className="w-full pl-9 pr-10 py-2.5 border border-slate-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-accent-400 text-slate-900"
                    />
                    <button type="button" onClick={() => setShowPwd(v => !v)}
                      className="absolute right-3 top-[36px] -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setStep(3)}
                      className="flex items-center gap-1 text-slate-500 hover:text-slate-700 font-medium py-3 px-3 rounded-xl transition-all text-sm"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="submit"
                      disabled={authLoading}
                      className="flex-1 flex items-center justify-center gap-2 bg-accent-500 hover:bg-accent-600 disabled:bg-accent-300 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-accent-500/20 text-sm"
                    >
                      {authLoading
                        ? <Loader2 className="w-5 h-5 animate-spin" />
                        : 'Ingresar y continuar'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
