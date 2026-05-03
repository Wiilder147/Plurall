'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowRight, ArrowLeft, UploadCloud, CheckCircle,
  Calculator, FileText, CheckSquare, ClipboardList,
  Loader2, AlertTriangle, ChevronDown,
} from 'lucide-react'
import { calcularAmortizacion, formatCOP } from '@/lib/calculadora'
import { createClient } from '@/lib/supabase/client'

const TASA_ANUAL_DEFAULT = 28

// ── Pasos del stepper ────────────────────────────────────────────────────────
const PASOS = [
  { num: 1, title: 'Cotizador',    icon: Calculator    },
  { num: 2, title: 'Cuestionario', icon: ClipboardList },
  { num: 3, title: 'Documentos',   icon: FileText      },
  { num: 4, title: 'Resumen',      icon: CheckSquare   },
]

export default function SolicitarCredito() {
  const router   = useRouter()
  const supabase = createClient()

  const [step,         setStep]         = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [bloqueo,      setBloqueo]      = useState({ isLoading: true, isBlocked: false, message: '' })

  // Step 1 — Cotizador
  const [monto, setMonto] = useState(500000)
  const [plazo, setPlazo] = useState(6)

  // Step 2 — Cuestionario
  const [preguntas,   setPreguntas]   = useState([])   // filas de tabla pregunta + opciones
  const [respuestas,  setRespuestas]  = useState({})   // { id_pregunta: { id_opcion?, respuesta_texto? } }
  const [cargandoQ,   setCargandoQ]   = useState(false)

  // Step 3 — Documentos KYC
  const [cedulaFrontal, setCedulaFrontal] = useState(null)
  const [cedulaTrasera, setCedulaTrasera] = useState(null)

  // Cálculo en vivo
  const { cuotaMensual, totalPagar, totalIntereses } = useMemo(
    () => calcularAmortizacion(monto, TASA_ANUAL_DEFAULT, plazo),
    [monto, plazo],
  )

  // ── Validar restricciones al cargar ─────────────────────────
  useEffect(() => {
    async function auditar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return setBloqueo({ isLoading: false, isBlocked: false, message: '' })

      const { data: clienteRow } = await supabase
        .from('cliente').select('id_cliente').eq('id_usuario_cuenta', user.id).single()

      if (clienteRow) {
        // A. Crédito activo
        const { data: creditoActivo } = await supabase
          .from('credito')
          .select('id_credito')
          .eq('id_cliente', clienteRow.id_cliente)
          .in('estado_credito', ['ACTIVO', 'EN_MORA'])
          .limit(1).single()

        if (creditoActivo) {
          return setBloqueo({
            isLoading: false, isBlocked: true,
            message: 'Tienes un crédito activo. Debes finalizar todos los pagos antes de solicitar uno nuevo.',
          })
        }

        // B. Cooldown trimestral
        const { data: lastReq } = await supabase
          .from('solicitud_credito')
          .select('fecha_solicitud')
          .eq('id_cliente', clienteRow.id_cliente)
          .order('fecha_solicitud', { ascending: false })
          .limit(1).single()

        if (lastReq) {
          const diffDias = (Date.now() - new Date(lastReq.fecha_solicitud)) / 86400000
          if (diffDias < 90) {
            return setBloqueo({
              isLoading: false, isBlocked: true,
              message: `Debes esperar ${Math.ceil(90 - diffDias)} días antes de realizar una nueva solicitud.`,
            })
          }
        }
      }
      setBloqueo({ isLoading: false, isBlocked: false, message: '' })
    }
    auditar()
  }, [])

  // ── Cargar preguntas del cuestionario al entrar al step 2 ────
  useEffect(() => {
    if (step !== 2 || preguntas.length > 0) return
    async function cargarPreguntas() {
      setCargandoQ(true)
      const { data } = await supabase
        .from('pregunta')
        .select('id_pregunta, enunciado, tipo_pregunta, obligatoria, opcion_pregunta ( id_opcion, texto_opcion, valor_puntos, orden )')
        .eq('activo', true)
        .order('orden', { ascending: true })
      setPreguntas(data ?? [])
      setCargandoQ(false)
    }
    cargarPreguntas()
  }, [step])

  // ── Handlers ─────────────────────────────────────────────────
  function handleRespuesta(idPregunta, campo, valor) {
    setRespuestas(prev => ({
      ...prev,
      [idPregunta]: { ...prev[idPregunta], [campo]: valor },
    }))
  }

  function handleFileChange(e, tipo) {
    const file = e.target.files[0]
    if (!file) return
    if (tipo === 'frontal') setCedulaFrontal(file)
    if (tipo === 'trasera') setCedulaTrasera(file)
  }

  // Validar que todas las preguntas obligatorias tengan respuesta
  function cuestionarioCompleto() {
    return preguntas
      .filter(p => p.obligatoria)
      .every(p => {
        const r = respuestas[p.id_pregunta]
        return r?.id_opcion || r?.respuesta_texto
      })
  }

  // ── Envío final ───────────────────────────────────────────────
  async function handleFinalSubmit() {
    setIsSubmitting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No estás autenticado')

      // Subir documentos KYC a Storage
      let frontUrl = null
      let backUrl  = null

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

      // Preparar respuestas para la API
      const respuestasArray = Object.entries(respuestas).map(([id_pregunta, r]) => ({
        id_pregunta,
        id_opcion:       r.id_opcion       || null,
        respuesta_texto: r.respuesta_texto || null,
      }))

      const res = await fetch('/api/creditos/solicitar', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ monto, plazo, frontUrl, backUrl, respuestas: respuestasArray }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (data.error === 'BLOQUEO_TRIMESTRAL') throw new Error(data.message)
        throw new Error(data.error || 'Error del servidor')
      }

      if (data.resultado_buro === 'RECHAZAR') {
        alert('Tu solicitud fue rechazada por nuestro comité de riesgo. Puedes intentarlo nuevamente en 90 días.')
        router.push('/dashboard/inicio')
      } else {
        router.push('/dashboard/inicio?success=true')
      }
    } catch (err) {
      console.error(err)
      alert(err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Pantallas de carga / bloqueo ─────────────────────────────
  if (bloqueo.isLoading) {
    return (
      <div className="max-w-3xl mx-auto flex flex-col items-center justify-center pt-20 gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-orange-500" />
        <p className="text-slate-500 font-medium">Validando perfil crediticio…</p>
      </div>
    )
  }

  if (bloqueo.isBlocked) {
    return (
      <div className="max-w-3xl mx-auto pb-12">
        <div className="bg-orange-50 border border-orange-200 p-8 rounded-3xl mt-10 text-center flex flex-col items-center">
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm border border-orange-100">
            <AlertTriangle className="w-8 h-8 text-orange-500" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Solicitud No Disponible</h2>
          <p className="text-slate-600 mb-6 max-w-md">{bloqueo.message}</p>
          <button
            onClick={() => router.push('/dashboard/inicio')}
            className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-2.5 rounded-xl font-medium transition-colors"
          >
            Volver al Inicio
          </button>
        </div>
      </div>
    )
  }

  // ── Render principal ─────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto pb-12">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Nueva Solicitud de Crédito</h1>
        <p className="text-slate-500 mt-2">Completa los {PASOS.length} pasos para enviar tu solicitud</p>
      </header>

      {/* ── Stepper ── */}
      <div className="flex items-center justify-between mb-8 relative">
        <div className="absolute left-0 top-5 w-full h-0.5 bg-slate-200 -z-10" />
        <div
          className="absolute left-0 top-5 h-0.5 bg-orange-500 -z-10 transition-all duration-300"
          style={{ width: `${((step - 1) / (PASOS.length - 1)) * 100}%` }}
        />
        {PASOS.map(s => (
          <div key={s.num} className="flex flex-col items-center gap-1.5 bg-slate-50 px-1">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
              step >= s.num ? 'bg-orange-500 border-orange-500 text-white' : 'bg-white border-slate-300 text-slate-400'
            }`}>
              <s.icon className="w-5 h-5" />
            </div>
            <span className={`text-xs font-semibold ${step >= s.num ? 'text-orange-600' : 'text-slate-400'}`}>
              {s.title}
            </span>
          </div>
        ))}
      </div>

      <div className="bg-white border border-slate-200 shadow-sm rounded-3xl overflow-hidden">

        {/* ── STEP 1: COTIZADOR ── */}
        {step === 1 && (
          <div className="p-8">
            <h2 className="text-xl font-bold text-slate-900 mb-6">Cotiza tu Crédito Plurall</h2>
            <div className="space-y-8">
              <div>
                <div className="flex justify-between mb-2">
                  <label className="font-semibold text-slate-700">Monto a solicitar</label>
                  <span className="text-xl font-bold text-blue-900">{formatCOP(monto)}</span>
                </div>
                <input type="range" min="100000" max="10000000" step="50000"
                  value={monto} onChange={e => setMonto(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-orange-500"
                />
                <div className="flex justify-between text-xs text-slate-400 mt-1">
                  <span>$100.000</span><span>$10.000.000</span>
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <label className="font-semibold text-slate-700">Plazo</label>
                  <span className="text-xl font-bold text-blue-900">{plazo} meses</span>
                </div>
                <input type="range" min="3" max="24" step="1"
                  value={plazo} onChange={e => setPlazo(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-orange-500"
                />
                <div className="flex justify-between text-xs text-slate-400 mt-1">
                  <span>3 meses</span><span>24 meses</span>
                </div>
              </div>
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <span className="text-sm text-slate-500">Cuota mensual estimada</span>
                  <p className="text-4xl font-extrabold text-orange-500">{formatCOP(cuotaMensual)}</p>
                  <p className="text-xs text-slate-400 mt-1">TEA {TASA_ANUAL_DEFAULT}% · sujeto a evaluación</p>
                </div>
                <div className="text-right text-sm text-slate-500">
                  <p>Total intereses: <strong className="text-slate-700">{formatCOP(totalIntereses)}</strong></p>
                  <p>Total a pagar: <strong className="text-slate-700">{formatCOP(totalPagar)}</strong></p>
                </div>
              </div>
            </div>
            <div className="mt-8 flex justify-end">
              <button onClick={() => setStep(2)}
                className="flex items-center gap-2 bg-blue-900 hover:bg-blue-800 text-white font-semibold py-3 px-6 rounded-xl transition-all">
                Siguiente <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2: CUESTIONARIO ── */}
        {step === 2 && (
          <div className="p-8">
            <h2 className="text-xl font-bold text-slate-900 mb-2">Cuestionario de Perfil</h2>
            <p className="text-slate-500 text-sm mb-6">
              Tus respuestas nos ayudan a evaluar tu solicitud. Los campos marcados con <span className="text-red-500">*</span> son obligatorios.
            </p>

            {cargandoQ ? (
              <div className="flex items-center justify-center py-16 gap-3 text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
                Cargando cuestionario…
              </div>
            ) : preguntas.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">No hay preguntas configuradas aún.</p>
                <p className="text-xs mt-1">Puedes continuar sin completar el cuestionario.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                {preguntas.map((p, idx) => {
                  const tieneOpciones = p.opcion_pregunta?.length > 0
                  const respActual    = respuestas[p.id_pregunta]
                  return (
                    <div key={p.id_pregunta} className="border border-slate-100 rounded-2xl p-5">
                      <label className="block font-semibold text-slate-800 mb-3 text-sm">
                        {idx + 1}. {p.enunciado}
                        {p.obligatoria && <span className="text-red-500 ml-1">*</span>}
                        <span className="ml-2 text-xs font-normal text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                          {p.tipo_pregunta}
                        </span>
                      </label>

                      {tieneOpciones ? (
                        // Pregunta de selección — dropdown
                        <div className="relative">
                          <select
                            value={respActual?.id_opcion ?? ''}
                            onChange={e => handleRespuesta(p.id_pregunta, 'id_opcion', e.target.value || null)}
                            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 appearance-none focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
                          >
                            <option value="">— Selecciona una opción —</option>
                            {[...p.opcion_pregunta]
                              .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
                              .map(op => (
                                <option key={op.id_opcion} value={op.id_opcion}>
                                  {op.texto_opcion}
                                </option>
                              ))
                            }
                          </select>
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        </div>
                      ) : (
                        // Pregunta de texto libre
                        <input
                          type="text"
                          value={respActual?.respuesta_texto ?? ''}
                          onChange={e => handleRespuesta(p.id_pregunta, 'respuesta_texto', e.target.value)}
                          placeholder="Escribe tu respuesta…"
                          className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-400"
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            <div className="mt-8 flex justify-between">
              <button onClick={() => setStep(1)}
                className="flex items-center gap-2 text-slate-500 hover:text-slate-700 font-medium py-3 px-4 rounded-xl transition-all">
                <ArrowLeft className="w-5 h-5" /> Atrás
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={preguntas.length > 0 && !cuestionarioCompleto()}
                className="flex items-center gap-2 bg-blue-900 hover:bg-blue-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-xl transition-all"
              >
                Siguiente <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: DOCUMENTOS KYC ── */}
        {step === 3 && (
          <div className="p-8">
            <h2 className="text-xl font-bold text-slate-900 mb-2">Valida tu Identidad</h2>
            <p className="text-slate-500 text-sm mb-6">Sube una foto clara de tu cédula por ambos lados.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                { tipo: 'frontal', label: 'Cédula Frontal',  file: cedulaFrontal },
                { tipo: 'trasera', label: 'Cédula Trasera',  file: cedulaTrasera },
              ].map(({ tipo, label, file }) => (
                <label key={tipo}
                  className="group border-2 border-dashed border-slate-300 hover:border-orange-500 rounded-2xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors bg-slate-50">
                  <input type="file" accept="image/*,.pdf" className="hidden"
                    onChange={e => handleFileChange(e, tipo)} />
                  {file ? (
                    <>
                      <CheckCircle className="w-10 h-10 text-emerald-500" />
                      <span className="text-slate-900 font-medium text-center text-sm">{file.name}</span>
                      <span className="text-xs text-emerald-600 font-semibold bg-emerald-100 px-2 py-1 rounded">Cargado ✓</span>
                    </>
                  ) : (
                    <>
                      <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm group-hover:bg-orange-50 transition-colors">
                        <UploadCloud className="w-6 h-6 text-slate-400 group-hover:text-orange-500" />
                      </div>
                      <span className="text-slate-700 font-medium mt-1">{label}</span>
                      <span className="text-xs text-slate-400">JPG, PNG o PDF</span>
                    </>
                  )}
                </label>
              ))}
            </div>
            <div className="mt-8 flex justify-between">
              <button onClick={() => setStep(2)}
                className="flex items-center gap-2 text-slate-500 hover:text-slate-700 font-medium py-3 px-4 rounded-xl transition-all">
                <ArrowLeft className="w-5 h-5" /> Atrás
              </button>
              <button onClick={() => setStep(4)}
                disabled={!cedulaFrontal || !cedulaTrasera}
                className="flex items-center gap-2 bg-blue-900 hover:bg-blue-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-xl transition-all">
                Revisar resumen <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 4: RESUMEN ── */}
        {step === 4 && (
          <div className="p-8">
            <h2 className="text-xl font-bold text-slate-900 mb-6">Confirma tu Solicitud</h2>
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 mb-6">
              <ul className="space-y-4 text-sm">
                {[
                  ['Capital solicitado',          formatCOP(monto)],
                  ['Plazo',                        `${plazo} meses`],
                  ['Cuota mensual estimada',       formatCOP(cuotaMensual)],
                  ['Total intereses',              formatCOP(totalIntereses)],
                  ['Total a financiar',            formatCOP(totalPagar)],
                  ['Preguntas respondidas',        `${Object.keys(respuestas).length} de ${preguntas.length}`],
                  ['Documentos KYC',               `${[cedulaFrontal, cedulaTrasera].filter(Boolean).length} / 2 subidos`],
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
            <div className="flex justify-between">
              <button onClick={() => setStep(3)}
                className="flex items-center gap-2 text-slate-500 hover:text-slate-700 font-medium py-3 px-4 rounded-xl transition-all">
                <ArrowLeft className="w-5 h-5" /> Atrás
              </button>
              <button onClick={handleFinalSubmit} disabled={isSubmitting}
                className="flex items-center gap-2 bg-orange-500 hover:bg-orange-400 disabled:bg-orange-300 text-white font-bold py-3 px-8 rounded-xl shadow-lg shadow-orange-500/20 transition-all text-lg">
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
