'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import {
  ArrowRight, ArrowLeft, UploadCloud, CheckCircle,
  Calculator, FileText, CheckSquare, ClipboardList,
  Loader2, AlertTriangle, ChevronDown, XCircle, Clock,
} from 'lucide-react'
import { calcularAmortizacion, formatCOP } from '@/lib/calculadora'
import { createClient } from '@/lib/supabase/client'

const LocationPicker = dynamic(() => import('@/components/LocationPicker'), {
  ssr: false,
  loading: () => <div className="h-24 bg-slate-100 rounded-xl animate-pulse" />,
})

const TASA_ANUAL_DEFAULT = 28

const BANCOS = [
  { grupo: 'Bancos',
    opciones: [
      'Bancolombia','Banco de Bogotá','Davivienda','BBVA Colombia',
      'Banco Popular','Banco Caja Social','Banco de Occidente','Banco AV Villas',
      'Banco Agrario de Colombia','Scotiabank Colpatria','Itaú Colombia',
      'Banco GNB Sudameris','Banco Falabella','Banco Finandina',
      'Banco Mundo Mujer','Banco W','Bancamía','Mibanco Colombia',
      'Banco Cooperativo Coopcentral','Bancóldex',
    ],
  },
  { grupo: 'Billeteras digitales',
    opciones: [
      'Nequi','Daviplata','Movii','Tpaga','RappiPay',
      'Lulo Bank','Nubank Colombia','Ualá Colombia',
    ],
  },
]

const PASOS = [
  { num: 1, title: 'Cotizador',    icon: Calculator    },
  { num: 2, title: 'Cuestionario', icon: ClipboardList },
  { num: 3, title: 'Documentos',   icon: FileText      },
  { num: 4, title: 'Resumen',      icon: CheckSquare   },
]

function trackEvent(evento, metadata = {}) {
  fetch('/api/eventos/funnel', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ evento, metadata }),
  }).catch(() => null)
}

export default function SolicitarCredito() {
  const router   = useRouter()
  const supabase = createClient()
  const topRef   = useRef(null)

  const [step,         setStep]         = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError,  setSubmitError]  = useState('')
  const [resultado,    setResultado]    = useState(null) // { tipo, score }
  const [bloqueo,      setBloqueo]      = useState({ isLoading: true, isBlocked: false, message: '' })
  const [fromFunnel,   setFromFunnel]   = useState(false)

  const [monto, setMonto] = useState(500000)
  const [plazo, setPlazo] = useState(12)

  const [preguntas,  setPreguntas]  = useState([])
  const [respuestas, setRespuestas] = useState({})
  const [cargandoQ,  setCargandoQ]  = useState(false)

  const [cedulaFrontal, setCedulaFrontal] = useState(null)
  const [cedulaTrasera, setCedulaTrasera] = useState(null)

  const { cuotaMensual, totalPagar, totalIntereses } = useMemo(
    () => calcularAmortizacion(monto, TASA_ANUAL_DEFAULT, plazo),
    [monto, plazo],
  )

  // Pre-rellenar monto/plazo y detectar si viene del funnel (ya pre-calificado)
  useEffect(() => {
    try {
      const raw = localStorage.getItem('plurall_resume_funnel')
      if (!raw) return
      const { monto: m, plazo: p, prequalificado, ts } = JSON.parse(raw)
      if (Date.now() - ts < 1_800_000) { // válido por 30 min
        if (Number.isFinite(m) && m >= 100000 && m <= 10000000) setMonto(m)
        if ([12, 24, 30].includes(p))                            setPlazo(p)
        if (prequalificado === true)                              setFromFunnel(true)
      }
    } catch { /* datos corruptos — ignorar */ } finally {
      localStorage.removeItem('plurall_resume_funnel')
    }
  }, [])

  // Scroll al top en cada cambio de paso
  useEffect(() => {
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [step, resultado])

  // Validar restricciones al cargar
  useEffect(() => {
    async function auditar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return setBloqueo({ isLoading: false, isBlocked: false, message: '' })

      const { data: clienteRow } = await supabase
        .from('cliente').select('id_cliente').eq('id_usuario_cuenta', user.id).single()

      if (clienteRow) {
        const { data: creditoActivo } = await supabase
          .from('credito').select('id_credito')
          .eq('id_cliente', clienteRow.id_cliente)
          .in('estado_credito', ['ACTIVO', 'EN_MORA'])
          .limit(1).single()

        if (creditoActivo) {
          trackEvent('BLOQUEADO_CREDITO_ACTIVO')
          return setBloqueo({ isLoading: false, isBlocked: true,
            message: 'Tienes un crédito activo. Debes finalizar todos los pagos antes de solicitar uno nuevo.' })
        }

        const { data: lastReq } = await supabase
          .from('solicitud_credito').select('fecha_solicitud')
          .eq('id_cliente', clienteRow.id_cliente)
          .order('fecha_solicitud', { ascending: false })
          .limit(1).single()

        if (lastReq) {
          const diffDias = (Date.now() - new Date(lastReq.fecha_solicitud)) / 86400000
          if (diffDias < 90) {
            trackEvent('BLOQUEADO_COOLDOWN_90', { dias_restantes: Math.ceil(90 - diffDias) })
            return setBloqueo({ isLoading: false, isBlocked: true,
              message: `Debes esperar ${Math.ceil(90 - diffDias)} días antes de realizar una nueva solicitud.` })
          }
        }
      }
      setBloqueo({ isLoading: false, isBlocked: false, message: '' })
      trackEvent('INICIO_CALCULADORA')
    }
    auditar()
  }, [])

  // Cargar preguntas al entrar al paso 2
  useEffect(() => {
    if (step !== 2 || preguntas.length > 0) return
    async function cargarPreguntas() {
      setCargandoQ(true)
      const { data } = await supabase
        .from('pregunta')
        .select('id_pregunta, enunciado, tipo_pregunta, tipo_input, obligatoria, opcion_pregunta ( id_opcion, texto_opcion, valor_puntos, orden )')
        .eq('activo', true)
        .order('orden', { ascending: true })
      setPreguntas(data ?? [])
      setCargandoQ(false)
    }
    cargarPreguntas()
  }, [step])

  function goTo(next) {
    setStep(next)
  }

  function handleRespuesta(idPregunta, campo, valor) {
    setRespuestas(prev => ({ ...prev, [idPregunta]: { ...prev[idPregunta], [campo]: valor } }))
  }

  function handleFileChange(e, tipo) {
    const file = e.target.files[0]
    if (!file) return
    if (tipo === 'frontal') { setCedulaFrontal(file); trackEvent('SUBIO_CEDULA_FRONTAL') }
    if (tipo === 'trasera') { setCedulaTrasera(file); trackEvent('SUBIO_CEDULA_TRASERA') }
  }

  function cuestionarioCompleto() {
    return preguntas.filter(p => p.obligatoria).every(p => {
      const r = respuestas[p.id_pregunta]
      if (p.tipo_input === 'UBICACION') {
        try {
          const ub = JSON.parse(r?.respuesta_texto ?? 'null')
          return !!(ub?.departamento && ub?.ciudad && ub?.direccion)
        } catch { return false }
      }
      return !!(r?.id_opcion || r?.respuesta_texto)
    })
  }

  async function handleFinalSubmit() {
    setIsSubmitting(true)
    setSubmitError('')
    trackEvent('ENVIO_SOLICITUD', { monto, plazo })
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No estás autenticado')

      let frontUrl = null, backUrl = null

      if (cedulaFrontal) {
        const ext  = cedulaFrontal.name.split('.').pop()
        const name = `${user.id}_frontal_${Date.now()}.${ext}`
        const { data: fd, error: fe } = await supabase.storage
          .from('documentos_kyc').upload(name, cedulaFrontal)
        if (fe) throw new Error('Error al subir cédula frontal: ' + fe.message)
        frontUrl = fd.path
      }

      if (cedulaTrasera) {
        const ext  = cedulaTrasera.name.split('.').pop()
        const name = `${user.id}_trasera_${Date.now()}.${ext}`
        const { data: bd, error: be } = await supabase.storage
          .from('documentos_kyc').upload(name, cedulaTrasera)
        if (be) throw new Error('Error al subir cédula trasera: ' + be.message)
        backUrl = bd.path
      }

      const respuestasArray = Object.entries(respuestas).map(([id_pregunta, r]) => ({
        id_pregunta, id_opcion: r.id_opcion || null, respuesta_texto: r.respuesta_texto || null,
      }))

      const res  = await fetch('/api/creditos/solicitar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monto, plazo, frontUrl, backUrl, respuestas: respuestasArray }),
      })
      const data = await res.json()

      if (!res.ok) throw new Error(data.message || data.error || 'Error del servidor')

      if (data.resultado_buro === 'RECHAZAR') {
        trackEvent('SOLICITUD_RECHAZADA', { score: data.score })
        setResultado({ tipo: 'rechazado', score: data.score })
      } else {
        const tipo = data.resultado_buro === 'PRE_APROBADO' ? 'aprobado' : 'revision'
        trackEvent(tipo === 'aprobado' ? 'SOLICITUD_APROBADA' : 'SOLICITUD_REVISION', { score: data.score })
        setResultado({ tipo, score: data.score })
      }
    } catch (err) {
      setSubmitError(err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Pantalla de carga ────────────────────────────────────────────────────────
  if (bloqueo.isLoading) {
    return (
      <div className="w-full max-w-3xl mx-auto flex flex-col items-center justify-center pt-20 gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-orange-500" />
        <p className="text-slate-500 font-medium">Validando perfil crediticio…</p>
      </div>
    )
  }

  // ── Pantalla de bloqueo ──────────────────────────────────────────────────────
  if (bloqueo.isBlocked) {
    return (
      <div className="w-full max-w-3xl mx-auto pb-12">
        <div className="bg-orange-50 border border-orange-200 p-8 rounded-3xl mt-10 text-center flex flex-col items-center">
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm border border-orange-100">
            <AlertTriangle className="w-8 h-8 text-orange-500" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Solicitud No Disponible</h2>
          <p className="text-slate-600 mb-6 max-w-md">{bloqueo.message}</p>
          <button onClick={() => router.push('/dashboard/inicio')}
            className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-2.5 rounded-xl font-medium transition-colors">
            Volver al Inicio
          </button>
        </div>
      </div>
    )
  }

  // ── Pantalla de resultado (reemplaza redirect + alert) ───────────────────────
  if (resultado) {
    const cfg = {
      aprobado: {
        icon: <CheckCircle className="w-14 h-14 text-emerald-500" />,
        bg: 'bg-emerald-50 border-emerald-200',
        title: '¡Felicitaciones, estás pre-aprobado!',
        desc: 'Tu solicitud fue evaluada positivamente. Un asesor de PLURALL te llamará en las próximas horas para verificar tus datos y coordinar el desembolso. ¡Mantén tu celular disponible!',
        extra: '¿Tienes dudas? Llámanos y te atendemos de inmediato.',
        btnLabel: 'Ver mis créditos',
        btnHref: '/dashboard/creditos',
        btnCls: 'bg-emerald-600 hover:bg-emerald-500',
      },
      revision: {
        icon: <Clock className="w-14 h-14 text-blue-500" />,
        bg: 'bg-blue-50 border-blue-200',
        title: 'Tu solicitud está en evaluación',
        desc: 'Nuestro equipo está revisando tu información. Un asesor te contactará en máximo 24 horas hábiles para darte una respuesta. Asegúrate de tener tu celular activo.',
        extra: null,
        btnLabel: 'Ir al inicio',
        btnHref: '/dashboard/inicio',
        btnCls: 'bg-blue-700 hover:bg-blue-600',
      },
      rechazado: {
        icon: <XCircle className="w-14 h-14 text-red-400" />,
        bg: 'bg-red-50 border-red-200',
        title: 'Solicitud no aprobada por ahora',
        desc: 'En este momento tu perfil no cumple los criterios de riesgo requeridos. Puedes volver a intentarlo en 90 días. Si crees que hubo un error, comunícate con nosotros.',
        extra: null,
        btnLabel: 'Entendido',
        btnHref: '/dashboard/inicio',
        btnCls: 'bg-slate-800 hover:bg-slate-700',
      },
    }[resultado.tipo]

    return (
      <div ref={topRef} className="w-full max-w-3xl mx-auto pb-12 animate-fade-in">
        <div className={`border p-10 rounded-3xl mt-6 text-center flex flex-col items-center gap-4 ${cfg.bg}`}>
          <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-md">
            {cfg.icon}
          </div>
          <h2 className="text-2xl font-bold text-slate-800">{cfg.title}</h2>
          <p className="text-slate-600 max-w-md leading-relaxed">{cfg.desc}</p>
          {cfg.extra && (
            <p className="text-sm font-medium text-slate-500 italic">{cfg.extra}</p>
          )}
          <button onClick={() => router.push(cfg.btnHref)}
            className={`mt-2 text-white px-8 py-3 rounded-xl font-bold transition-colors ${cfg.btnCls}`}>
            {cfg.btnLabel}
          </button>
        </div>
      </div>
    )
  }

  // ── Flujo principal ──────────────────────────────────────────────────────────
  return (
    <div ref={topRef} className="w-full max-w-3xl mx-auto pb-12">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Nueva Solicitud de Crédito</h1>
        <p className="text-slate-500 mt-2">
          {fromFunnel
            ? 'Continuaste desde tu pre-calificación. Solo faltan 3 pasos.'
            : `Completa los ${PASOS.length} pasos para enviar tu solicitud`}
        </p>
      </header>

      {/* Stepper */}
      <div className="flex items-center justify-between mb-8 relative">
        <div className="absolute left-0 top-5 w-full h-0.5 bg-slate-200 -z-10" />
        <div className="absolute left-0 top-5 h-0.5 bg-orange-500 -z-10 transition-all duration-500"
          style={{ width: `${((step - 1) / (PASOS.length - 1)) * 100}%` }} />
        {PASOS.map(s => {
          const autoCompleted = fromFunnel && s.num === 2 && step >= 3
          const isDone        = step > s.num || autoCompleted
          const isActive      = step === s.num && !autoCompleted
          return (
            <div key={s.num} className="flex flex-col items-center gap-1.5 bg-slate-50 px-1">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                isDone   ? 'bg-orange-500 border-orange-500 text-white' :
                isActive ? 'bg-white border-orange-500 text-orange-500 shadow-md shadow-orange-500/20' :
                           'bg-white border-slate-300 text-slate-400'
              }`}>
                {isDone ? <CheckCircle className="w-5 h-5" /> : <s.icon className="w-5 h-5" />}
              </div>
              <span className={`text-xs font-semibold transition-colors ${step >= s.num || autoCompleted ? 'text-orange-600' : 'text-slate-400'}`}>
                {s.title}{autoCompleted ? ' ✓' : ''}
              </span>
            </div>
          )
        })}
      </div>

      {/* Contenido animado — key fuerza remount y dispara animate-fade-in */}
      <div key={step} className="bg-white border border-slate-200 shadow-sm rounded-3xl overflow-hidden animate-fade-in">

        {/* STEP 1: COTIZADOR */}
        {step === 1 && (
          <div className="p-8">
            <h2 className="text-xl font-bold text-slate-900 mb-1">Cotiza tu Crédito Plurall</h2>
            <p className="text-slate-500 text-sm mb-4">Ajusta el monto y plazo que necesitas.</p>
            {fromFunnel && (
              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 mb-6 text-sm text-emerald-700">
                <CheckCircle className="w-4 h-4 shrink-0" />
                Ya completaste tu pre-calificación. El cuestionario de perfil será omitido automáticamente.
              </div>
            )}
            <div className="space-y-8">
              <div>
                <div className="flex justify-between mb-3">
                  <label className="font-semibold text-slate-700">Monto a solicitar</label>
                  <span className="text-xl font-bold text-blue-900">{formatCOP(monto)}</span>
                </div>
                <input type="range" min="100000" max="10000000" step="50000" value={monto}
                  onChange={e => { setMonto(Number(e.target.value)); trackEvent('AJUSTO_MONTO', { monto: Number(e.target.value) }) }}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-orange-500" />
                <div className="flex justify-between text-xs text-slate-400 mt-1">
                  <span>$100.000</span><span>$10.000.000</span>
                </div>
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-3">Plazo</label>
                <div className="flex gap-3">
                  {[12, 24, 30].map(m => (
                    <button key={m} type="button" onClick={() => setPlazo(m)}
                      className={`flex-1 py-3 rounded-xl border-2 font-bold text-sm transition-all ${
                        plazo === m
                          ? 'border-orange-500 bg-orange-50 text-orange-600'
                          : 'border-slate-200 text-slate-600 hover:border-orange-300'
                      }`}>
                      {m} meses
                    </button>
                  ))}
                </div>
              </div>
              <div className="bg-gradient-to-br from-slate-900 to-blue-900 p-6 rounded-2xl text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <span className="text-blue-200 text-sm">Cuota mensual estimada</span>
                  <p className="text-4xl font-extrabold text-orange-400 mt-1">{formatCOP(cuotaMensual)}</p>
                  <p className="text-blue-300 text-xs mt-1">TEA {TASA_ANUAL_DEFAULT}% · sujeto a evaluación</p>
                </div>
                <div className="text-sm text-blue-200 md:text-right space-y-1">
                  <p>Intereses: <strong className="text-white">{formatCOP(totalIntereses)}</strong></p>
                  <p>Total a pagar: <strong className="text-white">{formatCOP(totalPagar)}</strong></p>
                </div>
              </div>
            </div>
            <div className="mt-8 flex justify-end">
              <button onClick={() => {
                  if (fromFunnel) { trackEvent('SALTO_CUESTIONARIO_FUNNEL', { monto, plazo }); goTo(3) }
                  else            { trackEvent('INICIO_CUESTIONARIO', { monto, plazo });        goTo(2) }
                }}
                className="flex items-center gap-2 bg-orange-500 hover:bg-orange-400 text-white font-semibold py-3 px-6 rounded-xl transition-all shadow-lg shadow-orange-500/20">
                Continuar <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: CUESTIONARIO */}
        {step === 2 && (
          <div className="p-8">
            <h2 className="text-xl font-bold text-slate-900 mb-1">Cuestionario de Perfil</h2>
            <p className="text-slate-500 text-sm mb-6">
              Tus respuestas nos ayudan a evaluar tu solicitud. Los campos con <span className="text-red-500">*</span> son obligatorios.
            </p>
            {cargandoQ ? (
              <div className="flex items-center justify-center py-16 gap-3 text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin text-orange-500" /> Cargando cuestionario…
              </div>
            ) : preguntas.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">No hay preguntas configuradas aún. Puedes continuar.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-5">
                {preguntas.map((p, idx) => {
                  const tieneOpciones = p.opcion_pregunta?.length > 0
                  const respActual    = respuestas[p.id_pregunta]
                  const respondida    = p.tipo_input === 'UBICACION'
                    ? (() => { try { const u = JSON.parse(respActual?.respuesta_texto ?? 'null'); return !!(u?.departamento && u?.ciudad && u?.direccion) } catch { return false } })()
                    : !!(respActual?.id_opcion || respActual?.respuesta_texto)
                  return (
                    <div key={p.id_pregunta} className={`border rounded-2xl p-5 transition-colors ${
                      respondida ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-100'
                    }`}>
                      <label className="block font-semibold text-slate-800 mb-3 text-sm">
                        {idx + 1}. {p.enunciado}
                        {p.obligatoria && <span className="text-red-500 ml-1">*</span>}
                        {respondida && <CheckCircle className="inline w-4 h-4 text-emerald-500 ml-2" />}
                      </label>
                      {p.tipo_input === 'UBICACION' ? (
                        <LocationPicker
                          value={respActual?.respuesta_texto ?? null}
                          onChange={json => handleRespuesta(p.id_pregunta, 'respuesta_texto', json)}
                        />
                      ) : p.tipo_input === 'BANCO' ? (
                        <div className="relative">
                          <select
                            value={respActual?.respuesta_texto ?? ''}
                            onChange={e => handleRespuesta(p.id_pregunta, 'respuesta_texto', e.target.value || null)}
                            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 appearance-none focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white">
                            <option value="">— Selecciona banco o billetera —</option>
                            {BANCOS.map(grupo => (
                              <optgroup key={grupo.grupo} label={grupo.grupo}>
                                {grupo.opciones.map(op => (
                                  <option key={op} value={op}>{op}</option>
                                ))}
                              </optgroup>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        </div>
                      ) : tieneOpciones ? (
                        <div className="relative">
                          <select value={respActual?.id_opcion ?? ''}
                            onChange={e => handleRespuesta(p.id_pregunta, 'id_opcion', e.target.value || null)}
                            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 appearance-none focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white">
                            <option value="">— Selecciona una opción —</option>
                            {[...p.opcion_pregunta].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
                              .map(op => <option key={op.id_opcion} value={op.id_opcion}>{op.texto_opcion}</option>)}
                          </select>
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        </div>
                      ) : p.tipo_input === 'MONEDA' ? (
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-sm pointer-events-none">$</span>
                          <input
                            type="number" min="0" step="1000"
                            value={respActual?.respuesta_texto ?? ''}
                            onChange={e => handleRespuesta(p.id_pregunta, 'respuesta_texto', e.target.value)}
                            placeholder="0"
                            className="w-full border border-slate-200 rounded-xl pl-8 pr-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-400" />
                        </div>
                      ) : (
                        <input type="text" value={respActual?.respuesta_texto ?? ''}
                          onChange={e => handleRespuesta(p.id_pregunta, 'respuesta_texto', e.target.value)}
                          placeholder="Escribe tu respuesta…"
                          className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-400" />
                      )}
                    </div>
                  )
                })}
              </div>
            )}
            <div className="mt-8 flex justify-between">
              <button onClick={() => goTo(1)}
                className="flex items-center gap-2 text-slate-500 hover:text-slate-700 font-medium py-3 px-4 rounded-xl transition-all">
                <ArrowLeft className="w-5 h-5" /> Atrás
              </button>
              <button onClick={() => { trackEvent('COMPLETO_CUESTIONARIO'); trackEvent('INICIO_DOCUMENTOS'); goTo(3) }}
                disabled={preguntas.length > 0 && !cuestionarioCompleto()}
                className="flex items-center gap-2 bg-orange-500 hover:bg-orange-400 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-xl transition-all shadow-lg shadow-orange-500/20 disabled:shadow-none">
                Continuar <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: DOCUMENTOS KYC */}
        {step === 3 && (
          <div className="p-8">
            <h2 className="text-xl font-bold text-slate-900 mb-1">Valida tu Identidad</h2>
            <p className="text-slate-500 text-sm mb-6">Sube una foto clara de tu cédula por ambos lados. JPG, PNG o PDF.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                { tipo: 'frontal', label: 'Cédula Frontal', file: cedulaFrontal },
                { tipo: 'trasera', label: 'Cédula Trasera', file: cedulaTrasera },
              ].map(({ tipo, label, file }) => (
                <label key={tipo}
                  className={`group border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all ${
                    file ? 'border-emerald-400 bg-emerald-50' : 'border-slate-300 hover:border-orange-400 bg-slate-50 hover:bg-orange-50/30'
                  }`}>
                  <input type="file" accept="image/*,.pdf" className="hidden" onChange={e => handleFileChange(e, tipo)} />
                  {file ? (
                    <>
                      <CheckCircle className="w-12 h-12 text-emerald-500" />
                      <span className="text-slate-800 font-semibold text-center text-sm">{file.name}</span>
                      <span className="text-xs text-emerald-700 font-bold bg-emerald-100 px-3 py-1 rounded-full">Cargado ✓</span>
                    </>
                  ) : (
                    <>
                      <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-sm group-hover:bg-orange-50 transition-colors">
                        <UploadCloud className="w-7 h-7 text-slate-400 group-hover:text-orange-500 transition-colors" />
                      </div>
                      <span className="text-slate-700 font-semibold">{label}</span>
                      <span className="text-xs text-slate-400">Toca para seleccionar</span>
                    </>
                  )}
                </label>
              ))}
            </div>
            <div className="mt-8 flex justify-between">
              <button onClick={() => goTo(fromFunnel ? 1 : 2)}
                className="flex items-center gap-2 text-slate-500 hover:text-slate-700 font-medium py-3 px-4 rounded-xl transition-all">
                <ArrowLeft className="w-5 h-5" /> Atrás
              </button>
              <button onClick={() => { trackEvent('INICIO_RESUMEN'); goTo(4) }}
                disabled={!cedulaFrontal || !cedulaTrasera}
                className="flex items-center gap-2 bg-orange-500 hover:bg-orange-400 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-xl transition-all shadow-lg shadow-orange-500/20 disabled:shadow-none">
                Ver resumen <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: RESUMEN + ENVÍO */}
        {step === 4 && (
          <div className="p-8">
            <h2 className="text-xl font-bold text-slate-900 mb-6">Confirma tu Solicitud</h2>

            {/* Resumen de datos */}
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 mb-6">
              <ul className="space-y-3 text-sm">
                {[
                  ['Capital solicitado',     formatCOP(monto)],
                  ['Plazo',                   `${plazo} meses`],
                  ['Cuota mensual estimada', formatCOP(cuotaMensual)],
                  ['Total intereses',         formatCOP(totalIntereses)],
                  ['Total a financiar',       formatCOP(totalPagar)],
                  ['Preguntas respondidas',  `${Object.keys(respuestas).length} de ${preguntas.length}`],
                  ['Documentos KYC',          `${[cedulaFrontal, cedulaTrasera].filter(Boolean).length} / 2 subidos`],
                ].map(([label, value]) => (
                  <li key={label} className="flex justify-between items-center border-b border-slate-200 pb-3 last:border-0 last:pb-0">
                    <span className="text-slate-500">{label}</span>
                    <span className="font-bold text-slate-900">{value}</span>
                  </li>
                ))}
              </ul>
            </div>

            <p className="text-xs text-slate-400 mb-6">
              Al confirmar, autorizas a PLURALL a consultar tu historial crediticio y procesar tu solicitud
              según nuestra política de tratamiento de datos (Ley 1581/2012).
            </p>

            {/* Error de envío inline */}
            {submitError && (
              <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4 mb-5 text-sm text-red-700 animate-fade-in">
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                <p>{submitError}</p>
              </div>
            )}

            <div className="flex justify-between">
              <button onClick={() => goTo(3)}
                className="flex items-center gap-2 text-slate-500 hover:text-slate-700 font-medium py-3 px-4 rounded-xl transition-all">
                <ArrowLeft className="w-5 h-5" /> Atrás
              </button>
              <button onClick={handleFinalSubmit} disabled={isSubmitting}
                className="flex items-center gap-2 bg-orange-500 hover:bg-orange-400 disabled:bg-orange-300 text-white font-bold py-3 px-8 rounded-xl shadow-lg shadow-orange-500/25 transition-all text-base">
                {isSubmitting
                  ? <><Loader2 className="w-5 h-5 animate-spin" /> Enviando…</>
                  : <><CheckCircle className="w-5 h-5" /> Confirmar y Enviar</>
                }
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
