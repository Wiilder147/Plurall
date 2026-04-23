'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, ArrowLeft, UploadCloud, CheckCircle, Calculator, FileText, CheckSquare, Loader2, AlertTriangle } from 'lucide-react'
import { calcularAmortizacion, formatCOP } from '@/lib/calculadora'
import { createClient } from '@/lib/supabase/client'

export default function SolicitarCredito() {
  const router = useRouter()
  const supabase = createClient()
  
  // Estado del Stepper (1: Cotizar, 2: KYC, 3: Resumen)
  const [step, setStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [bloqueo, setBloqueo] = useState({ isLoading: true, isBlocked: false, message: '' })

  // Datos Cotización
  const [monto, setMonto] = useState(500000)
  const [plazo, setPlazo] = useState(6)
  const TASA_ANUAL_DEFAULT = 28 // 28% efectivo anual (Aprox 2.07% EM)

  // Datos de Subida de Archivos
  const [cedulaFrontal, setCedulaFrontal] = useState(null)
  const [cedulaTrasera, setCedulaTrasera] = useState(null)
  
  // Cálculo en vivo
  const { cuotaMensual, totalPagar, totalIntereses } = useMemo(() => {
    return calcularAmortizacion(monto, TASA_ANUAL_DEFAULT, plazo)
  }, [monto, plazo])

  // Handlers para archivos
  const handleFileChange = (e, tipo) => {
    const file = e.target.files[0]
    if (!file) return
    if (tipo === 'frontal') setCedulaFrontal(file)
    if (tipo === 'trasera') setCedulaTrasera(file)
  }

  // 0. Validar restricción trimestral al cargar
  useEffect(() => {
    const auditarHistorial = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return setBloqueo({ isLoading: false, isBlocked: false, message: '' })

      // Buscar id_cliente real desde la tabla cliente
      const { data: clienteRow } = await supabase
        .from('cliente')
        .select('id_cliente')
        .eq('id_usuario_cuenta', user.id)
        .single()

      const idCliente = clienteRow?.id_cliente

      // A. Validar Si tiene un crédito activo primero
      if (idCliente) {
        const { data: creditoActivo } = await supabase
          .from('credito')
          .select('id_credito, saldo_pendiente, estado_credito')
          .eq('id_cliente', idCliente)
          .in('estado_credito', ['ACTIVO', 'EN_MORA'])
          .limit(1)
          .single()
        
        if (creditoActivo) {
          return setBloqueo({ 
            isLoading: false, 
            isBlocked: true, 
            message: 'Actualmente tienes un crédito activo. Debes finalizar todos los pagos de tu crédito vigente antes de solicitar uno nuevo. Esta es una política estricta de Plurall.' 
          })
        }

        // B. Si no tiene crédito activo, mirar si tuvo solicitud reciente (90 días)
        const { data: lastRequest } = await supabase
          .from('solicitud_credito')
          .select('fecha_solicitud')
          .eq('id_cliente', idCliente)
          .order('fecha_solicitud', { ascending: false })
          .limit(1)
          .single()
        
        if (lastRequest) {
          const diffDias = (new Date() - new Date(lastRequest.fecha_solicitud)) / (1000 * 60 * 60 * 24)
          if (diffDias < 90) {
            setBloqueo({ 
              isLoading: false, 
              isBlocked: true, 
              message: `Por políticas internas, debes esperar ${Math.ceil(90 - diffDias)} días antes de realizar una nueva solicitud. Tu perfil de riesgo aún se encuentra en recalificación.` 
            })
            return
          }
        }
      }
      setBloqueo({ isLoading: false, isBlocked: false, message: '' })
    }
    auditarHistorial()
  }, [])

  // Finalizar Solicitud (Guardado real en Base de Datos y Supabase Storage)
  const handleFinalSubmit = async () => {
    setIsSubmitting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No estás autenticado para solicitar tu crédito')

      // 1. Subir a Supabase Storage KYC (documentos_kyc)
      let frontUrl = null
      let backUrl = null

      if (cedulaFrontal) {
        const fileExt = cedulaFrontal.name.split('.').pop()
        const fileName = `${user.id}_frontal_${Date.now()}.${fileExt}`
        const { data: frontData, error: frontError } = await supabase.storage
          .from('documentos_kyc')
          .upload(fileName, cedulaFrontal)
        if (frontError) throw new Error('Error al subir cédula frontal: ' + frontError.message)
        frontUrl = frontData.path
      }

      if (cedulaTrasera) {
        const fileExt = cedulaTrasera.name.split('.').pop()
        const fileName = `${user.id}_trasera_${Date.now()}.${fileExt}`
        const { data: backData, error: backError } = await supabase.storage
          .from('documentos_kyc')
          .upload(fileName, cedulaTrasera)
        if (backError) throw new Error('Error al subir cédula trasera: ' + backError.message)
        backUrl = backData.path
      }

      // 2. Transmitir data al API Orquestador (Que ejecuta la evaluación Experian y la BD)
      const res = await fetch('/api/creditos/solicitar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          monto, 
          plazo, 
          frontUrl, 
          backUrl
        })
      })

      const data = await res.json()
      
      if (!res.ok) {
        if (data.error === 'BLOQUEO_TRIMESTRAL') throw new Error(data.message)
        throw new Error('Error de Servidor: ' + data.error)
      }
      
      // Mostrar feedback si el API Experian lo rechazó o aprobo
      if (data.resultado_buro === 'RECHAZAR') {
        alert('Lamentablemente tu solicitud ha sido rechazada por políticas de nuestro comité de riesgo central.')
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

  if (bloqueo.isLoading) {
    return (
      <div className="max-w-3xl mx-auto pb-12 flex flex-col items-center justify-center pt-20">
        <Loader2 className="w-10 h-10 animate-spin text-orange-500 mb-4" />
        <p className="text-slate-500 font-medium">Validando perfil crediticio...</p>
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

  return (
    <div className="max-w-3xl mx-auto pb-12">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Nueva Solicitud de Crédito</h1>
        <p className="text-slate-500 mt-2">Diligencia tu solicitud en 3 simples pasos</p>
      </header>

      {/* STEPPER INDICATOR */}
      <div className="flex items-center justify-between mb-8 relative">
        <div className="absolute left-0 top-1/2 w-full h-0.5 bg-slate-200 -z-10"></div>
        <div className="absolute left-0 top-1/2 h-0.5 bg-orange-500 -z-10 transition-all duration-300" style={{ width: `${((step - 1) / 2) * 100}%` }}></div>
        
        {[
          { num: 1, title: 'Calculadora', icon: Calculator },
          { num: 2, title: 'Documentos', icon: FileText },
          { num: 3, title: 'Resumen', icon: CheckSquare }
        ].map(s => (
          <div key={s.num} className="flex flex-col items-center gap-2 bg-slate-50 relative">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold border-2 transition-all duration-300 ${step >= s.num ? 'bg-orange-500 border-orange-500 text-white' : 'bg-white border-slate-300 text-slate-400'}`}>
              <s.icon className="w-5 h-5" />
            </div>
            <span className={`text-xs font-semibold ${step >= s.num ? 'text-orange-600' : 'text-slate-400'}`}>{s.title}</span>
          </div>
        ))}
      </div>

      <div className="bg-white border border-slate-200 shadow-sm rounded-3xl overflow-hidden">
        
        {/* STEP 1: CALCULADORA */}
        {step === 1 && (
          <div className="p-8">
            <h2 className="text-xl font-bold text-slate-900 mb-6">Cotiza tu Crédito Plurall</h2>
            
            <div className="space-y-8">
              {/* Slider de Monto */}
              <div>
                <div className="flex justify-between mb-2">
                  <label className="font-semibold text-slate-700">Monto a solicitar</label>
                  <span className="text-xl font-bold text-blue-900">{formatCOP(monto)}</span>
                </div>
                <input 
                  type="range" min="100000" max="10000000" step="50000"
                  value={monto} onChange={(e) => setMonto(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-orange-500"
                />
                <div className="flex justify-between text-xs text-slate-400 mt-2">
                  <span>$100.000</span>
                  <span>$10.000.000</span>
                </div>
              </div>

              {/* Slider de Plazo */}
              <div>
                <div className="flex justify-between mb-2">
                  <label className="font-semibold text-slate-700">Plazo estimativo</label>
                  <span className="text-xl font-bold text-blue-900">{plazo} meses</span>
                </div>
                <input 
                  type="range" min="3" max="24" step="1"
                  value={plazo} onChange={(e) => setPlazo(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-orange-500"
                />
                <div className="flex justify-between text-xs text-slate-400 mt-2">
                  <span>3 meses</span>
                  <span>24 meses</span>
                </div>
              </div>

              {/* Resultado */}
              <div className="mt-8 bg-slate-50 p-6 rounded-2xl border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <span className="text-sm text-slate-500">Estimación de cuota mensual</span>
                  <p className="text-4xl font-extrabold text-orange-500">{formatCOP(cuotaMensual)}</p>
                  <p className="text-xs text-slate-400 mt-1">Sujeto a verificación y perfil de riesgo (TEA {TASA_ANUAL_DEFAULT}%)</p>
                </div>
              </div>
            </div>

            <div className="mt-10 flex justify-end">
              <button 
                onClick={() => setStep(2)}
                className="flex items-center gap-2 bg-blue-900 hover:bg-blue-800 text-white font-semibold py-3 px-6 rounded-xl transition-all"
              >
                Siguiente paso
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: DOCUMENTOS KYC */}
        {step === 2 && (
          <div className="p-8">
            <h2 className="text-xl font-bold text-slate-900 mb-6">Valida tu Identidad</h2>
            <p className="text-slate-500 mb-8">Por seguridad, necesitamos verificar que eres tú. Sube una foto clara de tu cédula por ambos lados.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Input Frontal */}
              <label className="group relative border-2 border-dashed border-slate-300 hover:border-orange-500 rounded-2xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors bg-slate-50">
                <input type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => handleFileChange(e, 'frontal')} />
                {cedulaFrontal ? (
                  <>
                    <CheckCircle className="w-10 h-10 text-emerald-500" />
                    <span className="text-slate-900 font-medium text-center">{cedulaFrontal.name}</span>
                    <span className="text-xs text-emerald-600 font-semibold bg-emerald-100 px-2 py-1 rounded">Cargado exitosamente</span>
                  </>
                ) : (
                  <>
                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm group-hover:bg-orange-50 transition-colors">
                      <UploadCloud className="w-6 h-6 text-slate-400 group-hover:text-orange-500" />
                    </div>
                    <span className="text-slate-700 font-medium mt-2">Cédula Frontal</span>
                    <span className="text-xs text-slate-400">Toca para explorar imágenes</span>
                  </>
                )}
              </label>

              {/* Input Trasera */}
              <label className="group relative border-2 border-dashed border-slate-300 hover:border-orange-500 rounded-2xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors bg-slate-50">
                <input type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => handleFileChange(e, 'trasera')} />
                {cedulaTrasera ? (
                  <>
                    <CheckCircle className="w-10 h-10 text-emerald-500" />
                    <span className="text-slate-900 font-medium text-center">{cedulaTrasera.name}</span>
                    <span className="text-xs text-emerald-600 font-semibold bg-emerald-100 px-2 py-1 rounded">Cargado exitosamente</span>
                  </>
                ) : (
                  <>
                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm group-hover:bg-orange-50 transition-colors">
                      <UploadCloud className="w-6 h-6 text-slate-400 group-hover:text-orange-500" />
                    </div>
                    <span className="text-slate-700 font-medium mt-2">Cédula Respaldo</span>
                    <span className="text-xs text-slate-400">Toca para explorar imágenes</span>
                  </>
                )}
              </label>
            </div>

            <div className="mt-10 flex justify-between">
              <button 
                onClick={() => setStep(1)}
                className="flex items-center gap-2 text-slate-500 hover:text-slate-700 font-medium py-3 px-4 rounded-xl transition-all"
              >
                <ArrowLeft className="w-5 h-5" /> Atrás
              </button>
              <button 
                onClick={() => setStep(3)}
                disabled={!cedulaFrontal || !cedulaTrasera}
                className="flex items-center gap-2 bg-blue-900 hover:bg-blue-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-xl transition-all"
              >
                Revisar resumen
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: RESUMEN */}
        {step === 3 && (
          <div className="p-8">
            <h2 className="text-xl font-bold text-slate-900 mb-6">Confirma tu Solicitud</h2>
            
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 mb-8">
              <ul className="space-y-4">
                <li className="flex justify-between items-center border-b border-slate-200 pb-4">
                  <span className="text-slate-500 font-medium">Capítal Solicitado</span>
                  <span className="font-bold text-slate-900">{formatCOP(monto)}</span>
                </li>
                <li className="flex justify-between items-center border-b border-slate-200 pb-4">
                  <span className="text-slate-500 font-medium">Plazo</span>
                  <span className="font-bold text-slate-900">{plazo} meses</span>
                </li>
                <li className="flex justify-between items-center border-b border-slate-200 pb-4">
                  <span className="text-slate-500 font-medium">Cuota Mensual Fija</span>
                  <span className="font-bold text-orange-500 text-xl">{formatCOP(cuotaMensual)}</span>
                </li>
                <li className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Total a Financiar (Incl. intereses)</span>
                  <span className="font-bold text-slate-900">{formatCOP(totalPagar)}</span>
                </li>
              </ul>
            </div>

            <div className="mt-10 flex justify-between">
              <button 
                onClick={() => setStep(2)}
                className="flex items-center gap-2 text-slate-500 hover:text-slate-700 font-medium py-3 px-4 rounded-xl transition-all"
              >
                <ArrowLeft className="w-5 h-5" /> Atrás
              </button>
              <button 
                onClick={handleFinalSubmit}
                disabled={isSubmitting}
                className="flex items-center gap-2 bg-orange-500 hover:bg-orange-400 disabled:bg-orange-300 text-white font-bold py-3 px-8 rounded-xl shadow-lg shadow-orange-500/20 transition-all text-lg"
              >
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                Confirmar y Enviar
              </button>
            </div>
          </div>
        )}
        
      </div>
    </div>
  )
}
