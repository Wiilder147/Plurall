'use client'

/* ==========================================================================
 * ARCHIVO: page.js
 * RUTA: apps/web/app/dashboard/creditos/solicitar/page.js
 * DESCRIPCIÓN: Formulario de solicitud de crédito del CLIENTE (4 pasos).
 * FUNCIONALIDAD:
 *   Paso 1 — Cotizador: el cliente ajusta monto y plazo con sliders.
 *   Paso 2 — Cuestionario: preguntas de perfil cargadas desde la BD.
 *   Paso 3 — Documentos KYC: sube fotos de cédula frontal y trasera.
 *   Paso 4 — Resumen: confirma y envía la solicitud.
 *   Resultado: muestra si fue pre-aprobado, en revisión o rechazado.
 * ========================================================================== */

import { useState, useMemo, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import {
  ArrowRight, ArrowLeft, UploadCloud, CheckCircle,
  Calculator, FileText, CheckSquare, ClipboardList,
  Loader2, AlertTriangle, ChevronDown, XCircle, Clock,
} from 'lucide-react'
import { calcularAmortizacion, formatCOP } from '@/lib/calculadora'
import { MONTO_MIN, MONTO_MAX, PLAZOS } from '@/lib/producto'
import { createClient } from '@/lib/supabase/client'

// LocationPicker carga solo en el cliente (ssr: false) para evitar errores con Leaflet
const LocationPicker = dynamic(() => import('@/components/LocationPicker'), {
  ssr: false,
  loading: () => <div className="h-24 bg-slate-100 rounded-xl animate-pulse" />,
})

const TASA_ANUAL_DEFAULT = 28

// LISTA DE BANCOS Y BILLETERAS de respaldo — la fuente principal es la tabla
// `banco` en la BD (db/14_catalogos.sql); esto solo se usa si la consulta falla
const BANCOS_FALLBACK = [
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

// TIPOS DE DOCUMENTO ADICIONAL que el cliente puede adjuntar como soporte
// Los códigos coinciden con documento_cliente.tipo_documento en la BD
const TIPOS_DOC_ADICIONAL = [
  { codigo: 'RECIBO_PUBLICO',    label: 'Recibo de servicio público' },
  { codigo: 'FOTO_NEGOCIO',      label: 'Foto del negocio' },
  { codigo: 'RUT',               label: 'RUT' },
  { codigo: 'EXTRACTO_BANCARIO', label: 'Extracto bancario' },
  { codigo: 'CAMARA_COMERCIO',   label: 'Cámara de comercio' },
  { codigo: 'OTRO_COMPROBANTE',  label: 'Otro comprobante' },
]
const MAX_DOCS_ADICIONALES = 8
// Tope para "¿Cuántas personas dependen económicamente de usted?"
const MAX_DEPENDIENTES = 30

function esPreguntaDependientes(p) {
  return /dependen económicamente/i.test(p?.enunciado ?? '')
}

function maxNumericoPregunta(p) {
  if (esPreguntaDependientes(p)) return MAX_DEPENDIENTES
  return null
}

// CONFIGURACIÓN DE LOS PASOS DEL FORMULARIO
// Para cambiar el nombre o ícono de un paso: modifica este array
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
  const [supabase] = useState(() => createClient())
  const topRef   = useRef(null)

  const [step,         setStep]         = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError,  setSubmitError]  = useState('')
  const [resultado,    setResultado]    = useState(null)
  const [bloqueo,      setBloqueo]      = useState({ isLoading: true, isBlocked: false, message: '' })
  const [fromFunnel,   setFromFunnel]   = useState(false)

  const [monto, setMonto] = useState(500000)
  const [plazo, setPlazo] = useState(12)

  const [preguntas,  setPreguntas]  = useState([])
  const [respuestas, setRespuestas] = useState({})
  const [cargandoQ,  setCargandoQ]  = useState(false)
  const [bancos,     setBancos]     = useState(BANCOS_FALLBACK)

  const [cedulaFrontal, setCedulaFrontal] = useState(null)
  const [cedulaTrasera, setCedulaTrasera] = useState(null)
  const [docsAdicionales, setDocsAdicionales] = useState([]) // [{ id, file, tipo }]
  const [tipoDocNuevo,    setTipoDocNuevo]    = useState(TIPOS_DOC_ADICIONAL[0].codigo)

  const { cuotaMensual, totalPagar, totalIntereses } = useMemo(
    () => calcularAmortizacion(monto, TASA_ANUAL_DEFAULT, plazo),
    [monto, plazo],
  )

  useEffect(() => {
    try {
      const raw = localStorage.getItem('plurall_resume_funnel')
      if (!raw) return
      const { monto: m, plazo: p, prequalificado, ts } = JSON.parse(raw)
      if (Date.now() - ts < 1_800_000) {
        if (Number.isFinite(m) && m >= MONTO_MIN && m <= MONTO_MAX) setMonto(m)
        if (PLAZOS.includes(p)) setPlazo(p)
        if (prequalificado === true) setFromFunnel(true)
      }
    } catch { } finally {
      localStorage.removeItem('plurall_resume_funnel')
    }
  }, [])

  useEffect(() => {
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [step, resultado])

  // Elegibilidad desde el endpoint único (misma regla que aplica el backend
  // al crear la solicitud — ver fn_verificar_elegibilidad en la BD)
  useEffect(() => {
    async function verificarElegibilidad() {
      try {
        const res  = await fetch('/api/creditos/elegibilidad')
        const data = await res.json()
        if (res.ok && data.elegible === false) {
          trackEvent(
            data.codigo === 'CREDITO_ACTIVO' ? 'BLOQUEADO_CREDITO_ACTIVO' : 'BLOQUEADO_COOLDOWN_90',
            data.dias_restantes ? { dias_restantes: data.dias_restantes } : {},
          )
          return setBloqueo({ isLoading: false, isBlocked: true, message: data.mensaje })
        }
      } catch { /* si la consulta falla no bloqueamos: la RPC revalida al enviar */ }
      setBloqueo({ isLoading: false, isBlocked: false, message: '' })
      trackEvent('INICIO_CALCULADORA')
    }
    verificarElegibilidad()
  }, [])

  useEffect(() => {
    if (step !== 2 || preguntas.length > 0) return
    async function cargarPreguntas() {
      setCargandoQ(true)
      const [{ data }, { data: bancosDb }] = await Promise.all([
        supabase
          .from('pregunta')
          .select('id_pregunta, enunciado, tipo_pregunta, tipo_input, obligatoria, opcion_pregunta ( id_opcion, texto_opcion, valor_puntos, orden )')
          .eq('activo', true).order('orden', { ascending: true }),
        supabase
          .from('banco')
          .select('nombre, tipo')
          .eq('activo', true)
          .order('orden', { ascending: true }),
      ])
      setPreguntas(data ?? [])
      if (bancosDb?.length) {
        setBancos([
          { grupo: 'Bancos',              opciones: bancosDb.filter(b => b.tipo === 'BANCO').map(b => b.nombre) },
          { grupo: 'Billeteras digitales', opciones: bancosDb.filter(b => b.tipo === 'BILLETERA').map(b => b.nombre) },
        ].filter(g => g.opciones.length > 0))
      }
      setCargandoQ(false)
    }
    cargarPreguntas()
  }, [step, preguntas.length, supabase])

  function goTo(next) { setStep(next) }

  function handleRespuesta(idPregunta, campo, valor) {
    setRespuestas(prev => ({ ...prev, [idPregunta]: { ...prev[idPregunta], [campo]: valor } }))
  }

  function handleFileChange(e, tipo) {
    const file = e.target.files[0]
    if (!file) return
    if (tipo === 'frontal') { setCedulaFrontal(file); trackEvent('SUBIO_CEDULA_FRONTAL') }
    if (tipo === 'trasera') { setCedulaTrasera(file); trackEvent('SUBIO_CEDULA_TRASERA') }
  }

  // Agrega uno o varios archivos de soporte con el tipo seleccionado
  function agregarDocsAdicionales(e) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setDocsAdicionales(prev => [
      ...prev,
      ...files.map(f => ({ id: `${Date.now()}_${f.name}_${Math.random().toString(36).slice(2)}`, file: f, tipo: tipoDocNuevo })),
    ].slice(0, MAX_DOCS_ADICIONALES))
    trackEvent('SUBIO_DOC_ADICIONAL', { tipo: tipoDocNuevo, cantidad: files.length })
    e.target.value = '' // permite volver a seleccionar el mismo archivo
  }

  function quitarDocAdicional(id) {
    setDocsAdicionales(prev => prev.filter(d => d.id !== id))
  }

  // Las preguntas MONEDA y NUMERO alimentan el score, por eso su respuesta
  // debe ser un número válido y no negativo; las abiertas aceptan texto libre
  function esPreguntaNumerica(p) {
    return p.tipo_input === 'MONEDA' || p.tipo_input === 'NUMERO'
  }

  function respuestaNumericaValida(r, p) {
    if (r?.respuesta_texto == null || r.respuesta_texto === '') return false
    const n = Number(r.respuesta_texto)
    if (!Number.isFinite(n) || n < 0) return false
    const max = maxNumericoPregunta(p)
    if (max != null && n > max) return false
    return true
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
      if (esPreguntaNumerica(p)) return respuestaNumericaValida(r, p)
      return !!(r?.id_opcion || r?.respuesta_texto)
    })
  }

  const MAX_FILE_BYTES = 10 * 1024 * 1024 // 10 MB

  async function subirArchivo(file, sufijo, userId) {
    if (file.size > MAX_FILE_BYTES) {
      throw new Error(`El archivo "${file.name}" supera el límite de 10 MB. Comprime la imagen e inténtalo de nuevo.`)
    }
    const ext  = file.name.split('.').pop().toLowerCase()
    const name = `${userId}_${sufijo}_${Date.now()}.${ext}`
    const { data, error } = await supabase.storage
      .from('documentos_kyc')
      .upload(name, file, { contentType: file.type, upsert: false })
    if (error) {
      const msg = error.message?.toLowerCase() ?? ''
      if (msg.includes('policy') || msg.includes('permission') || msg.includes('not authorized')) {
        throw new Error('Sin permiso para subir archivos. Contacta a soporte (error: storage policy).')
      }
      if (msg.includes('bucket')) {
        throw new Error('El almacenamiento no está configurado. Contacta a soporte (error: bucket).')
      }
      const etiqueta = sufijo === 'frontal' ? 'cédula frontal' : sufijo === 'trasera' ? 'cédula trasera' : `documento (${file.name})`
      throw new Error(`Error al subir ${etiqueta}: ${error.message}`)
    }
    return data.path
  }

  async function handleFinalSubmit() {
    setIsSubmitting(true)
    setSubmitError('')
    trackEvent('ENVIO_SOLICITUD', { monto, plazo })
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No estás autenticado')

      let frontUrl = null, backUrl = null

      if (cedulaFrontal) frontUrl = await subirArchivo(cedulaFrontal, 'frontal', user.id)
      if (cedulaTrasera) backUrl  = await subirArchivo(cedulaTrasera, 'trasera', user.id)

      // Documentos adicionales de soporte (recibo público, fotos del negocio, etc.)
      const extraDocs = []
      for (const d of docsAdicionales) {
        const path = await subirArchivo(d.file, d.tipo.toLowerCase(), user.id)
        extraDocs.push({ tipo: d.tipo, url: path, mime: d.file.type || null, tamanio: d.file.size || null })
      }

      const respuestasArray = Object.entries(respuestas).map(([id_pregunta, r]) => {
        const preg  = preguntas.find(p => p.id_pregunta === id_pregunta)
        const esNum = preg ? esPreguntaNumerica(preg) : false
        const max   = preg ? maxNumericoPregunta(preg) : null
        let texto   = r.respuesta_texto || null
        let num     = Number(texto)
        if (esNum && Number.isFinite(num) && max != null && num > max) {
          num = max
          texto = String(max)
        }
        return {
          id_pregunta,
          id_opcion:          r.id_opcion || null,
          respuesta_texto:    texto,
          // respuesta_numerica permite usar el valor en cálculos de score y métricas
          respuesta_numerica: esNum && texto !== '' && Number.isFinite(num) ? num : null,
        }
      })

      const res  = await fetch('/api/creditos/solicitar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monto, plazo, frontUrl, backUrl, extraDocs, respuestas: respuestasArray }),
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

  // ── PANTALLA DE CARGA ──────────────────────────────────────────────────────
  if (bloqueo.isLoading) {
    return (
      // CENTRADO, pt-20 (80px arriba)
      <div className="w-full max-w-3xl mx-auto flex flex-col items-center justify-center pt-20 gap-4">
        {/* SPINNER — text-orange-500 (naranja), w-10 h-10 (40x40px), animate-spin */}
        <Loader2 className="w-10 h-10 animate-spin text-orange-500" />
        {/* TEXTO — text-slate-500, font-medium */}
        <p className="text-slate-500 font-medium">Validando perfil crediticio…</p>
      </div>
    )
  }

  // ── PANTALLA DE BLOQUEO (crédito activo o cooldown 90 días) ───────────────
  if (bloqueo.isBlocked) {
    return (
      <div className="w-full max-w-3xl mx-auto pb-12">
        {/* TARJETA DE BLOQUEO
            COLOR FONDO: bg-orange-50 (naranja muy claro)
            BORDE: border border-orange-200 (naranja claro)
            BORDES: rounded-3xl (24px), PADDING: p-8 (32px)
            MARGEN SUPERIOR: mt-10 (40px), centrado */}
        <div className="bg-orange-50 border border-orange-200 p-8 rounded-3xl mt-10 text-center flex flex-col items-center">
          {/* CÍRCULO CON ÍCONO
              COLOR FONDO: bg-white (blanco), BORDE: border border-orange-100
              TAMAÑO: w-16 h-16 (64x64px), SOMBRA: shadow-sm
              ÍCONO: w-8 h-8 (32x32px), text-orange-500 (naranja) */}
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm border border-orange-100">
            <AlertTriangle className="w-8 h-8 text-orange-500" />
          </div>
          {/* TÍTULO — text-2xl (24px), font-bold, text-slate-800 */}
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Solicitud No Disponible</h2>
          {/* MENSAJE — text-slate-600, mb-6 (24px abajo), max-w-md */}
          <p className="text-slate-600 mb-6 max-w-md">{bloqueo.message}</p>
          {/* BOTÓN "Volver al Inicio"
              COLOR: bg-slate-900 (casi negro), hover:bg-slate-800
              PADDING: px-6 py-2.5, BORDES: rounded-xl (12px) */}
          <button onClick={() => router.push('/dashboard/inicio')}
            className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-2.5 rounded-xl font-medium transition-colors">
            Volver al Inicio
          </button>
        </div>
      </div>
    )
  }

  // ── PANTALLA DE RESULTADO ──────────────────────────────────────────────────
  if (resultado) {
    // CONFIGURACIÓN POR TIPO DE RESULTADO
    const cfg = {
      aprobado: {
        icon: <CheckCircle className="w-14 h-14 text-emerald-500" />,
        // FONDO VERDE CLARO + BORDE VERDE
        bg: 'bg-emerald-50 border-emerald-200',
        title: '¡Felicitaciones, estás pre-aprobado!',
        desc: 'Tu solicitud fue evaluada positivamente. Un asesor de PLURALL te llamará en las próximas horas para verificar tus datos y coordinar el desembolso. ¡Mantén tu celular disponible!',
        extra: '¿Tienes dudas? Llámanos y te atendemos de inmediato.',
        btnLabel: 'Ver mis créditos',
        btnHref: '/dashboard/creditos',
        // BOTÓN VERDE — bg-emerald-600 hover:bg-emerald-500
        btnCls: 'bg-emerald-600 hover:bg-emerald-500',
      },
      revision: {
        icon: <Clock className="w-14 h-14 text-blue-500" />,
        // FONDO AZUL CLARO
        bg: 'bg-blue-50 border-blue-200',
        title: 'Tu solicitud está en evaluación',
        desc: 'Nuestro equipo está revisando tu información. Un asesor te contactará en máximo 24 horas hábiles para darte una respuesta. Asegúrate de tener tu celular activo.',
        extra: null,
        btnLabel: 'Ir al inicio',
        btnHref: '/dashboard/inicio',
        // BOTÓN AZUL
        btnCls: 'bg-blue-700 hover:bg-blue-600',
      },
      rechazado: {
        icon: <XCircle className="w-14 h-14 text-red-400" />,
        // FONDO ROJO CLARO
        bg: 'bg-red-50 border-red-200',
        title: 'Solicitud no aprobada por ahora',
        desc: 'En este momento tu perfil no cumple los criterios de riesgo requeridos. Puedes volver a intentarlo en 90 días. Si crees que hubo un error, comunícate con nosotros.',
        extra: null,
        btnLabel: 'Entendido',
        btnHref: '/dashboard/inicio',
        // BOTÓN OSCURO
        btnCls: 'bg-slate-800 hover:bg-slate-700',
      },
    }[resultado.tipo]

    return (
      <div ref={topRef} className="w-full max-w-3xl mx-auto pb-12 animate-fade-in">
        {/* TARJETA DE RESULTADO
            COLOR FONDO: viene de cfg.bg (verde, azul o rojo según resultado)
            BORDE: border, BORDES: rounded-3xl (24px), PADDING: p-10 (40px)
            MARGEN SUPERIOR: mt-6 (24px), centrado */}
        <div className={`border p-10 rounded-3xl mt-6 text-center flex flex-col items-center gap-4 ${cfg.bg}`}>
          {/* CÍRCULO BLANCO CON ÍCONO
              COLOR FONDO: bg-white, SOMBRA: shadow-md
              TAMAÑO: w-24 h-24 (96x96px), BORDES: rounded-full */}
          <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-md">
            {cfg.icon}
          </div>
          {/* TÍTULO — text-2xl (24px), font-bold, text-slate-800 */}
          <h2 className="text-2xl font-bold text-slate-800">{cfg.title}</h2>
          {/* DESCRIPCIÓN — text-slate-600, max-w-md, leading-relaxed */}
          <p className="text-slate-600 max-w-md leading-relaxed">{cfg.desc}</p>
          {/* TEXTO EXTRA (solo en aprobado) — text-sm, font-medium, text-slate-500, italic */}
          {cfg.extra && (
            <p className="text-sm font-medium text-slate-500 italic">{cfg.extra}</p>
          )}
          {/* BOTÓN DE ACCIÓN
              COLOR: viene de cfg.btnCls
              PADDING: px-8 py-3 (32px horizontal, 12px vertical)
              BORDES: rounded-xl (12px), font-bold */}
          <button onClick={() => router.push(cfg.btnHref)}
            className={`mt-2 text-white px-8 py-3 rounded-xl font-bold transition-colors ${cfg.btnCls}`}>
            {cfg.btnLabel}
          </button>
        </div>
      </div>
    )
  }

  // ── FLUJO PRINCIPAL (4 pasos) ──────────────────────────────────────────────
  return (
    // CONTENEDOR — max-w-5xl (1024px), centrado, pb-12 (48px abajo)
    <div ref={topRef} className="w-full max-w-5xl mx-auto pb-12">

      {/* ENCABEZADO
          TÍTULO: text-3xl (30px), text-slate-900, font-bold
          MARGEN INFERIOR: mb-8 (32px) */}
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Nueva Solicitud de Crédito</h1>
        <p className="text-slate-500 mt-2">
          {fromFunnel
            ? 'Continuaste desde tu pre-calificación. Solo faltan 3 pasos.'
            : `Completa los ${PASOS.length} pasos para enviar tu solicitud`}
        </p>
      </header>

      {/* ── STEPPER (indicador de pasos) ──
          LÍNEA DE FONDO: bg-slate-200 (gris — representa pasos no completados)
          LÍNEA DE PROGRESO: bg-orange-500 (naranja — representa pasos completados)
          ANCHO DE LA LÍNEA: calculado dinámicamente según el paso actual */}
      <div className="flex items-center justify-between mb-8 relative">
        {/* LÍNEA BASE — absolute, gris, z-index negativo */}
        <div className="absolute left-0 top-5 w-full h-0.5 bg-slate-200 -z-10" />
        {/* LÍNEA DE PROGRESO — naranja, ancho porcentual según el paso */}
        <div className="absolute left-0 top-5 h-0.5 bg-orange-500 -z-10 transition-all duration-500"
          style={{ width: `${((step - 1) / (PASOS.length - 1)) * 100}%` }} />

        {PASOS.map(s => {
          const isDone    = step > s.num
          const isActive  = step === s.num
          return (
            <div key={s.num} className="flex flex-col items-center gap-1.5 bg-slate-50 px-1">
              {/* CÍRCULO DEL PASO
                  COMPLETADO: bg-orange-500 border-orange-500 text-white (naranja sólido)
                  ACTIVO: bg-white border-orange-500 text-orange-500 shadow-md (naranja contorno)
                  INACTIVO: bg-white border-slate-300 text-slate-400 (gris)
                  TAMAÑO: w-10 h-10 (40x40px), BORDES: rounded-full
                  BORDE: border-2 (2px) */}
              <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                isDone   ? 'bg-orange-500 border-orange-500 text-white' :
                isActive ? 'bg-white border-orange-500 text-orange-500 shadow-md shadow-orange-500/20' :
                           'bg-white border-slate-300 text-slate-400'
              }`}>
                {isDone ? <CheckCircle className="w-5 h-5" /> : <s.icon className="w-5 h-5" />}
              </div>
              {/* ETIQUETA DEL PASO
                  COLOR ACTIVO/COMPLETADO: text-orange-600 (naranja)
                  COLOR INACTIVO: text-slate-400 (gris)
                  TAMAÑO: text-xs (12px), font-semibold */}
              <span className={`text-xs font-semibold transition-colors ${step >= s.num ? 'text-orange-600' : 'text-slate-400'}`}>
                {s.title}
              </span>
            </div>
          )
        })}
      </div>

      {/* ── TARJETA CONTENEDORA DE CADA PASO ──
          COLOR FONDO: bg-white (blanco)
          BORDE: border border-slate-200
          BORDES: rounded-3xl (24px), overflow-hidden
          SOMBRA: shadow-sm
          animate-fade-in — key={step} fuerza remount con animación entre pasos */}
      <div key={step} className="bg-white border border-slate-200 shadow-sm rounded-3xl overflow-hidden animate-fade-in">

        {/* ════════════════ PASO 1: COTIZADOR ════════════════ */}
        {step === 1 && (
          // PADDING: p-8 (32px)
          <div className="p-8">
            {/* TÍTULO DEL PASO — text-xl (20px), font-bold, text-slate-900 */}
            <h2 className="text-xl font-bold text-slate-900 mb-1">Cotiza tu Crédito Plurall</h2>
            <p className="text-slate-500 text-sm mb-4">Ajusta el monto y plazo que necesitas.</p>

            {/* BANNER PRE-CALIFICADO (visible si viene del funnel)
                COLOR FONDO: bg-emerald-50 (verde muy claro)
                BORDE: border border-emerald-200 (verde claro)
                BORDES: rounded-xl (12px), PADDING: px-4 py-3 */}
            {fromFunnel && (
              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 mb-6 text-sm text-emerald-700">
                <CheckCircle className="w-4 h-4 shrink-0" />
                Ya completaste tu pre-calificación. El cuestionario de perfil será omitido automáticamente.
              </div>
            )}

            {/* COTIZADOR EN 2 COLUMNAS — izquierda: monto+plazo · derecha: tarjeta de cuota */}
            <div className="grid lg:grid-cols-2 gap-8 items-stretch">
              {/* COLUMNA IZQUIERDA */}
              <div className="flex flex-col justify-between gap-8">
              {/* SLIDER DE MONTO */}
              <div className="mt-6">
                <div className="flex justify-between mb-4">
                  {/* ETIQUETA — font-semibold, text-slate-700 */}
                  <label className="font-semibold text-slate-850 text-sm sm:text-base">Monto a solicitar</label>
                  {/* VALOR ACTUAL — text-xl/2xl, font-bold, text-blue-900 */}
                  <span className="text-xl sm:text-2xl font-bold text-blue-900 tracking-tight">{formatCOP(monto)}</span>
                </div>
                {/* INPUT RANGE (slider)
                    ALTURA: h-2 (8px), FONDO: bg-slate-200 (gris)
                    BORDES: rounded-lg
                    COLOR DEL THUMB: accent-orange-500 (naranja — para cambiar: accent-blue-500)
                    RANGO: lib/producto.js (MONTO_MIN–MONTO_MAX) en pasos de 50.000 */}
                <input type="range" min={MONTO_MIN} max={MONTO_MAX} step="50000" value={monto}
                  onChange={e => { setMonto(Number(e.target.value)); trackEvent('AJUSTO_MONTO', { monto: Number(e.target.value) }) }}
                  className="w-full h-2 mt-20 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-orange-500" />
                <div className="flex justify-between text-base font-semibold text-slate-500 mt-2">
                  <span>{formatCOP(MONTO_MIN)}</span><span>{formatCOP(MONTO_MAX)}</span>
                </div>
              </div>

              {/* BOTONES DE PLAZO
                  ACTIVO: border-orange-500 bg-orange-50 text-orange-600 (naranja)
                  INACTIVO: border-slate-200 text-slate-600 hover:border-orange-300
                  PADDING: py-3 (12px vertical), BORDES: rounded-xl (12px)
                  TAMAÑO FUENTE: text-sm (14px), font-bold */}
              <div>
                <label className="font-semibold text-slate-700 block mb-3">Plazo</label>
                <div className="flex gap-3">
                  {PLAZOS.map(m => (
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

              </div>{/* ── fin COLUMNA IZQUIERDA ── */}

              {/* COLUMNA DERECHA — tarjeta de cuota + botón continuar (la acción junto a la cotización) */}
              <div className="flex flex-col gap-5">
                <div className="bg-gradient-to-br from-slate-900 to-blue-900 p-6 sm:p-8 rounded-2xl text-white flex flex-col justify-center flex-1">
                  <span className="text-blue-200 text-sm sm:text-base font-medium">Cuota mensual estimada</span>
                  <p className="text-4xl sm:text-5xl font-extrabold text-orange-400 mt-1.5 tracking-tight">{formatCOP(cuotaMensual)}</p>
                  <p className="text-blue-300 text-xs sm:text-sm mt-1">TEA {TASA_ANUAL_DEFAULT}% · sujeto a evaluación</p>
                  <div className="mt-5 pt-5 border-t border-white/10 text-base text-blue-200 space-y-2.5">
                    <p className="flex justify-between gap-4">Intereses: <strong className="text-white">{formatCOP(totalIntereses)}</strong></p>
                    <p className="flex justify-between gap-4">Total a pagar: <strong className="text-white">{formatCOP(totalPagar)}</strong></p>
                  </div>
                </div>
                {/* BOTÓN CONTINUAR — ancho completo de la columna, debajo de la cuota */}
                <button onClick={() => { trackEvent('INICIO_CUESTIONARIO', { monto, plazo }); goTo(2) }}
                  className="w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-400 text-white font-semibold py-3.5 rounded-xl transition-all shadow-lg shadow-orange-500/20">
                  Continuar <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════ PASO 2: CUESTIONARIO ════════════════ */}
        {step === 2 && (
          <div className="p-8">
            <h2 className="text-xl font-bold text-slate-900 mb-1">Cuestionario de Perfil</h2>
            <p className="text-slate-500 text-sm mb-6">
              Tus respuestas nos ayudan a evaluar tu solicitud. Los campos con <span className="text-red-500">*</span> son obligatorios.
            </p>

            {cargandoQ ? (
              // SPINNER DE CARGA — centrado, text-orange-500
              <div className="flex items-center justify-center py-16 gap-3 text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin text-orange-500" /> Cargando cuestionario…
              </div>
            ) : preguntas.length === 0 ? (
              // ESTADO VACÍO (sin preguntas configuradas)
              <div className="text-center py-12 text-slate-400">
                <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">No hay preguntas configuradas aún. Puedes continuar.</p>
              </div>
            ) : (
              // LISTA DE PREGUNTAS — gap-5 (20px entre preguntas)
              <div className="flex flex-col gap-5">
                {preguntas.map((p, idx) => {
                  const tieneOpciones = p.opcion_pregunta?.length > 0
                  const respActual    = respuestas[p.id_pregunta]
                  const maxNum        = maxNumericoPregunta(p)
                  const respondida    = p.tipo_input === 'UBICACION'
                    ? (() => { try { const u = JSON.parse(respActual?.respuesta_texto ?? 'null'); return !!(u?.departamento && u?.ciudad && u?.direccion) } catch { return false } })()
                    : esPreguntaNumerica(p)
                    ? respuestaNumericaValida(respActual, p)
                    : !!(respActual?.id_opcion || respActual?.respuesta_texto)

                  return (
                    // TARJETA DE PREGUNTA
                    // RESPONDIDA: border-emerald-200 bg-emerald-50/50 (verde muy claro)
                    // SIN RESPONDER: border-slate-100 (gris muy claro)
                    // BORDES: rounded-2xl (16px), PADDING: p-5 (20px)
                    <div key={p.id_pregunta} className={`border rounded-2xl p-5 transition-colors ${
                      respondida ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-100'
                    }`}>
                      {/* ENUNCIADO DE LA PREGUNTA
                          COLOR: text-slate-800 (casi negro), font-semibold, text-sm
                          * ROJO: text-red-500, inline
                          CHECK VERDE: cuando está respondida — text-emerald-500 */}
                      <label className="block font-semibold text-slate-800 mb-3 text-sm">
                        {idx + 1}. {p.enunciado}
                        {p.obligatoria && <span className="text-red-500 ml-1">*</span>}
                        {respondida && <CheckCircle className="inline w-4 h-4 text-emerald-500 ml-2" />}
                      </label>

                      {p.tipo_input === 'UBICACION' ? (
                        // UBICACIÓN — componente LocationPicker (mapa de Leaflet)
                        <LocationPicker
                          value={respActual?.respuesta_texto ?? null}
                          onChange={json => handleRespuesta(p.id_pregunta, 'respuesta_texto', json)}
                        />
                      ) : p.tipo_input === 'BANCO' ? (
                        // SELECT DE BANCO/BILLETERA
                        // BORDE: border border-slate-200, BORDES: rounded-xl (12px)
                        // PADDING: px-4 py-2.5, TAMAÑO: text-sm (14px)
                        // FOCUS: focus:ring-2 focus:ring-orange-400 (anillo naranja al enfocar)
                        <div className="relative">
                          <select
                            value={respActual?.respuesta_texto ?? ''}
                            onChange={e => handleRespuesta(p.id_pregunta, 'respuesta_texto', e.target.value || null)}
                            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 appearance-none focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white">
                            <option value="">— Selecciona banco o billetera —</option>
                            {bancos.map(grupo => (
                              <optgroup key={grupo.grupo} label={grupo.grupo}>
                                {grupo.opciones.map(op => (
                                  <option key={op} value={op}>{op}</option>
                                ))}
                              </optgroup>
                            ))}
                          </select>
                          {/* ÍCONO CHEVRON — w-4 h-4 (16x16px), text-slate-400 */}
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        </div>
                      ) : tieneOpciones ? (
                        // SELECT DE OPCIONES (preguntas con respuestas predefinidas)
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
                        // INPUT DE MONEDA (con $ a la izquierda)
                        <div className="relative">
                          {/* SÍMBOLO $ — absolute left-4, centrado vertical, text-slate-400 */}
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-sm pointer-events-none">$</span>
                          {/* type="text" + filtrado de no-dígitos: type="number" dejaba
                              escribir letras (p.ej. "el6542"); aquí solo se aceptan números */}
                          <input
                            type="text" inputMode="numeric"
                            value={respActual?.respuesta_texto ?? ''}
                            onChange={e => handleRespuesta(p.id_pregunta, 'respuesta_texto', e.target.value.replace(/\D/g, ''))}
                            placeholder="0"
                            className="w-full border border-slate-200 rounded-xl pl-8 pr-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-400" />
                        </div>
                      ) : p.tipo_input === 'NUMERO' ? (
                        // INPUT NUMÉRICO (solo dígitos; dependientes limitado a MAX_DEPENDIENTES)
                        <div>
                          <input
                            type="text" inputMode="numeric"
                            value={respActual?.respuesta_texto ?? ''}
                            onChange={e => {
                              let v = e.target.value.replace(/\D/g, '')
                              if (maxNum != null && v !== '' && Number(v) > maxNum) v = String(maxNum)
                              handleRespuesta(p.id_pregunta, 'respuesta_texto', v)
                            }}
                            placeholder={maxNum != null ? `0 a ${maxNum}` : 'Solo números…'}
                            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-400" />
                          {maxNum != null && (
                            <p className="mt-1.5 text-xs text-slate-400">Máximo {maxNum} personas</p>
                          )}
                        </div>
                      ) : (
                        // INPUT DE TEXTO LIBRE
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

            {/* BOTONES ATRÁS / CONTINUAR */}
            <div className="mt-8 flex justify-between">
              {/* BOTÓN "Atrás" — text-slate-500 (gris), sin fondo */}
              <button onClick={() => goTo(1)}
                className="flex items-center gap-2 text-slate-500 hover:text-slate-700 font-medium py-3 px-4 rounded-xl transition-all">
                <ArrowLeft className="w-5 h-5" /> Atrás
              </button>
              {/* BOTÓN "Continuar" — naranja, deshabilitado si cuestionario incompleto
                  disabled: bg-slate-300 cursor-not-allowed (gris, no clicable) */}
              <button onClick={() => { trackEvent('COMPLETO_CUESTIONARIO'); trackEvent('INICIO_DOCUMENTOS'); goTo(3) }}
                disabled={preguntas.length > 0 && !cuestionarioCompleto()}
                className="flex items-center gap-2 bg-orange-500 hover:bg-orange-400 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-xl transition-all shadow-lg shadow-orange-500/20 disabled:shadow-none">
                Continuar <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* ════════════════ PASO 3: DOCUMENTOS KYC ════════════════ */}
        {step === 3 && (
          <div className="p-8">
            <h2 className="text-xl font-bold text-slate-900 mb-1">Valida tu Identidad</h2>
            <p className="text-slate-500 text-sm mb-6">Sube una foto clara de tu cédula por ambos lados. JPG, PNG o PDF.</p>

            {/* GRID DE CARGA DE ARCHIVOS — 1 columna móvil, 2 desktop */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                { tipo: 'frontal', label: 'Cédula Frontal', file: cedulaFrontal },
                { tipo: 'trasera', label: 'Cédula Trasera', file: cedulaTrasera },
              ].map(({ tipo, label, file }) => (
                // ÁREA DE CARGA (label clickeable que abre el input file)
                // SIN ARCHIVO: border-slate-300 bg-slate-50 hover:border-orange-400 bg-orange-50/30
                // CON ARCHIVO: border-emerald-400 bg-emerald-50 (verde cuando ya se subió)
                // BORDES: border-2 border-dashed rounded-2xl (16px)
                // PADDING: p-6 (24px), centrado verticalmente
                <label key={tipo}
                  className={`group border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all ${
                    file ? 'border-emerald-400 bg-emerald-50' : 'border-slate-300 hover:border-orange-400 bg-slate-50 hover:bg-orange-50/30'
                  }`}>
                  {/* INPUT FILE OCULTO */}
                  <input type="file" accept="image/*,.pdf" className="hidden" onChange={e => handleFileChange(e, tipo)} />

                  {file ? (
                    <>
                      {/* CHECK VERDE cuando el archivo está cargado — w-12 h-12 (48x48px) */}
                      <CheckCircle className="w-12 h-12 text-emerald-500" />
                      {/* NOMBRE DEL ARCHIVO — text-sm (14px), font-semibold */}
                      <span className="text-slate-800 font-semibold text-center text-sm">{file.name}</span>
                      {/* BADGE "Cargado ✓"
                          COLOR FONDO: bg-emerald-100 (verde claro), COLOR TEXTO: text-emerald-700
                          PADDING: px-3 py-1, BORDES: rounded-full, TAMAÑO: text-xs (12px) */}
                      <span className="text-xs text-emerald-700 font-bold bg-emerald-100 px-3 py-1 rounded-full">Cargado ✓</span>
                    </>
                  ) : (
                    <>
                      {/* ÍCONO SUBIR ARCHIVO
                          CÍRCULO: w-14 h-14 (56x56px), bg-white (blanco), shadow-sm
                          ÍCONO: w-7 h-7 (28x28px), text-slate-400, group-hover:text-orange-500 */}
                      <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-sm group-hover:bg-orange-50 transition-colors">
                        <UploadCloud className="w-7 h-7 text-slate-400 group-hover:text-orange-500 transition-colors" />
                      </div>
                      {/* ETIQUETA — text-slate-700, font-semibold */}
                      <span className="text-slate-700 font-semibold">{label}</span>
                      {/* HINT — text-xs (12px), text-slate-400 */}
                      <span className="text-xs text-slate-400">Toca para seleccionar</span>
                    </>
                  )}
                </label>
              ))}
            </div>

            {/* ── DOCUMENTOS ADICIONALES (opcional) ──
                Permite adjuntar varios soportes: recibo público, fotos del negocio,
                RUT, extractos u otros comprobantes que respalden la solicitud */}
            <div className="mt-8 border-t border-slate-100 pt-6">
              <h3 className="font-bold text-slate-900">Documentos adicionales <span className="text-slate-400 font-medium text-sm">(opcional)</span></h3>
              <p className="text-slate-500 text-sm mt-1 mb-4">
                Si tienes recibos de servicios públicos, fotos de tu negocio u otros comprobantes, adjúntalos aquí: ayudan a evaluar mejor tu solicitud. Máximo {MAX_DOCS_ADICIONALES} archivos de 10 MB cada uno.
              </p>

              {/* SELECTOR DE TIPO + BOTÓN AGREGAR */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <select value={tipoDocNuevo} onChange={e => setTipoDocNuevo(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 appearance-none focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white">
                    {TIPOS_DOC_ADICIONAL.map(t => <option key={t.codigo} value={t.codigo}>{t.label}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
                <label className={`flex items-center justify-center gap-2 border-2 border-dashed rounded-xl px-5 py-2.5 text-sm font-semibold transition-all ${
                  docsAdicionales.length >= MAX_DOCS_ADICIONALES
                    ? 'border-slate-200 text-slate-300 cursor-not-allowed'
                    : 'border-slate-300 text-slate-600 hover:border-orange-400 hover:text-orange-600 cursor-pointer'
                }`}>
                  <input type="file" accept="image/*,.pdf" multiple className="hidden"
                    disabled={docsAdicionales.length >= MAX_DOCS_ADICIONALES}
                    onChange={agregarDocsAdicionales} />
                  <UploadCloud className="w-4 h-4" /> Agregar archivo(s)
                </label>
              </div>

              {/* LISTA DE ARCHIVOS ADJUNTOS */}
              {docsAdicionales.length > 0 && (
                <ul className="mt-4 space-y-2">
                  {docsAdicionales.map(d => (
                    <li key={d.id} className="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 text-sm animate-fade-in">
                      <FileText className="w-4 h-4 text-orange-500 shrink-0" />
                      <span className="font-medium text-slate-800 truncate">{d.file.name}</span>
                      <span className="text-xs text-slate-500 bg-slate-200/60 px-2 py-0.5 rounded-full shrink-0">
                        {TIPOS_DOC_ADICIONAL.find(t => t.codigo === d.tipo)?.label ?? d.tipo}
                      </span>
                      <button type="button" onClick={() => quitarDocAdicional(d.id)}
                        aria-label={`Quitar ${d.file.name}`}
                        className="ml-auto text-slate-400 hover:text-red-500 transition-colors shrink-0">
                        <XCircle className="w-4 h-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* BOTONES ATRÁS / VER RESUMEN */}
            <div className="mt-8 flex justify-between">
              <button onClick={() => goTo(2)}
                className="flex items-center gap-2 text-slate-500 hover:text-slate-700 font-medium py-3 px-4 rounded-xl transition-all">
                <ArrowLeft className="w-5 h-5" /> Atrás
              </button>
              {/* disabled si faltan archivos — bg-slate-300 gris cuando deshabilitado */}
              <button onClick={() => { trackEvent('INICIO_RESUMEN'); goTo(4) }}
                disabled={!cedulaFrontal || !cedulaTrasera}
                className="flex items-center gap-2 bg-orange-500 hover:bg-orange-400 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-xl transition-all shadow-lg shadow-orange-500/20 disabled:shadow-none">
                Ver resumen <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* ════════════════ PASO 4: RESUMEN + ENVÍO ════════════════ */}
        {step === 4 && (
          <div className="p-8">
            <h2 className="text-xl font-bold text-slate-900 mb-6">Confirma tu Solicitud</h2>

            {/* TABLA RESUMEN
                COLOR FONDO: bg-slate-50 (gris muy claro)
                BORDE: border border-slate-100, BORDES: rounded-2xl (16px)
                PADDING: p-6 (24px), MARGEN INFERIOR: mb-6 */}
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
                  ['Documentos adicionales',  docsAdicionales.length > 0 ? `${docsAdicionales.length} adjunto${docsAdicionales.length > 1 ? 's' : ''}` : 'Ninguno'],
                ].map(([label, value]) => (
                  // FILA DE RESUMEN — borde inferior entre filas (excepto la última)
                  // ETIQUETA: text-slate-500 (gris), VALOR: font-bold text-slate-900
                  <li key={label} className="flex justify-between items-center border-b border-slate-200 pb-3 last:border-0 last:pb-0">
                    <span className="text-slate-500">{label}</span>
                    <span className="font-bold text-slate-900">{value}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* TEXTO LEGAL — text-xs (12px), text-slate-400, mb-6 */}
            <p className="text-xs text-slate-400 mb-6">
              Al confirmar, autorizas a PLURALL a consultar tu historial crediticio y procesar tu solicitud
              según nuestra política de tratamiento de datos (Ley 1581/2012).
            </p>

            {/* ERROR DE ENVÍO (visible si submitError tiene contenido)
                COLOR FONDO: bg-red-50, BORDE: border border-red-200
                BORDES: rounded-xl (12px), PADDING: p-4 (16px)
                COLOR TEXTO: text-red-700 (rojo oscuro), text-sm (14px) */}
            {submitError && (
              <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4 mb-5 text-sm text-red-700 animate-fade-in">
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                <p>{submitError}</p>
              </div>
            )}

            {/* BOTONES ATRÁS / CONFIRMAR Y ENVIAR */}
            <div className="flex justify-between">
              <button onClick={() => goTo(3)}
                className="flex items-center gap-2 text-slate-500 hover:text-slate-700 font-medium py-3 px-4 rounded-xl transition-all">
                <ArrowLeft className="w-5 h-5" /> Atrás
              </button>
              {/* BOTÓN "Confirmar y Enviar"
                  COLOR: bg-orange-500, disabled:bg-orange-300 (naranja claro cuando cargando)
                  PADDING: py-3 px-8, BORDES: rounded-xl, SOMBRA: shadow-lg shadow-orange-500/25
                  TAMAÑO: text-base (16px — más grande que los otros botones), font-bold */}
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
