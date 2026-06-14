/* ==========================================================================
 * ARCHIVO: page.js
 * RUTA: apps/web/app/dashboard/ayuda/page.js
 * DESCRIPCIÓN: Módulo "Ayuda" (USUARIO / cliente).
 * FUNCIONALIDAD: Centro de ayuda con preguntas frecuentes y canales de
 *                soporte de Plurall. Contenido informativo (estático).
 * ========================================================================== */
import { HelpCircle, Mail, Phone, MessageSquare, Globe } from 'lucide-react'

export const dynamic = 'force-dynamic'

const FAQS = [
  { q: '¿Cómo solicito un crédito?', a: 'Ingresa a "Mi Crédito" y pulsa "Solicitar crédito". Completa el formulario con la información de tu negocio y envía la solicitud; un asesor la revisará.' },
  { q: '¿Cuánto tarda la aprobación?', a: 'Tras enviar tu solicitud, un asesor verifica tus datos (preaprobación) y luego el supervisor la aprueba. El proceso suele tomar de 1 a 3 días hábiles.' },
  { q: '¿Cómo pago mis cuotas?', a: 'En "Plan de Pagos" verás tus cuotas. Pulsa "Pagar" en la cuota correspondiente y sigue el proceso de pago en línea.' },
  { q: '¿Qué pasa si me atraso en una cuota?', a: 'Se genera un interés de mora diario. Te recomendamos ponerte al día lo antes posible y, si tienes dificultades, crear una PQR para acordar una solución.' },
  { q: '¿Cómo actualizo mis datos?', a: 'Ve a "Mi Usuario" para editar tu información de contacto y de tu negocio.' },
]

export default function AyudaPage() {
  return (
    <div className="flex flex-col gap-8 pb-10">
      <header>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
          <HelpCircle className="w-7 h-7 text-orange-500" /> Centro de ayuda
        </h1>
        <p className="text-slate-500 mt-1">Resuelve tus dudas o contáctanos por el canal que prefieras.</p>
      </header>

      {/* Canales de contacto */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <a href="mailto:soporte@plurall.co" className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center shrink-0"><Mail className="w-5 h-5 text-orange-500" /></div>
          <div><p className="text-sm font-semibold text-slate-900">Correo</p><p className="text-xs text-slate-500">soporte@plurall.co</p></div>
        </a>
        <a href="tel:+576015551234" className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center shrink-0"><Phone className="w-5 h-5 text-orange-500" /></div>
          <div><p className="text-sm font-semibold text-slate-900">Teléfono</p><p className="text-xs text-slate-500">(601) 555 1234</p></div>
        </a>
        <a href="/dashboard/pqr" className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center shrink-0"><MessageSquare className="w-5 h-5 text-orange-500" /></div>
          <div><p className="text-sm font-semibold text-slate-900">Crear PQR</p><p className="text-xs text-slate-500">Petición, queja o reclamo</p></div>
        </a>
      </section>

      {/* Preguntas frecuentes */}
      <section>
        <h2 className="text-lg font-bold text-slate-900 mb-4">Preguntas frecuentes</h2>
        <div className="flex flex-col gap-3">
          {FAQS.map((f, i) => (
            <details key={i} className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden group">
              <summary className="cursor-pointer list-none p-5 font-semibold text-slate-900 text-sm flex items-center justify-between">
                {f.q}
                <span className="text-orange-500 group-open:rotate-45 transition-transform text-xl leading-none">+</span>
              </summary>
              <p className="px-5 pb-5 text-sm text-slate-500 leading-relaxed">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <a href="https://plurall.co" target="_blank" rel="noopener noreferrer"
        className="inline-flex items-center gap-2 text-sm font-semibold text-orange-600 hover:text-orange-700">
        <Globe className="w-4 h-4" /> Conoce más sobre Plurall
      </a>
    </div>
  )
}
