import Link from 'next/link'
import { CheckCircle2, Banknote, Clock, Mail, ArrowRight } from 'lucide-react'
import { formatCOP } from '@/lib/calculadora'

const PASOS = [
  'Validamos tu información y documentos.',
  'Procesamos el desembolso en los próximos días hábiles.',
  'Te avisamos por correo cuando el dinero esté en camino.',
]

export default function SolicitudDesembolsoPendiente({ solicitud, variant = 'hero' }) {
  const ref = solicitud.idSolicitud.slice(0, 8).toUpperCase()
  const fechaAprobacion = solicitud.fechaDecision
    ? new Date(solicitud.fechaDecision).toLocaleDateString('es-CO', {
        day: 'numeric', month: 'long', year: 'numeric',
      })
    : null

  if (variant === 'card') {
    return (
      <div className="bg-gradient-to-br from-emerald-50 to-white border-2 border-emerald-200 rounded-3xl p-8 md:p-10 shadow-sm">
        <div className="flex flex-col items-center text-center gap-4">
          <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-md border border-emerald-100">
            <CheckCircle2 className="w-10 h-10 text-emerald-500" />
          </div>
          <div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 uppercase tracking-wide">
              <Clock className="w-3.5 h-3.5" /> Desembolso en proceso
            </span>
            <h3 className="text-2xl font-bold text-slate-900 mt-3">¡Tu crédito fue aprobado!</h3>
            <p className="text-slate-600 max-w-md mt-2 leading-relaxed">
              En los próximos días hábiles transferiremos el dinero a tu cuenta.
              Mantén tu celular y correo activos; te avisaremos en cuanto esté listo.
            </p>
          </div>

          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full max-w-lg text-left mt-2">
            {[
              ['Monto aprobado', formatCOP(solicitud.monto)],
              ['Plazo', `${solicitud.plazo} meses`],
              ['Cuota estimada', formatCOP(solicitud.cuotaEstimada)],
              ['Referencia', `#${ref}`],
            ].map(([label, value]) => (
              <div key={label} className="bg-white/80 border border-emerald-100 rounded-xl px-3 py-2.5">
                <dt className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{label}</dt>
                <dd className="text-sm font-bold text-slate-800 mt-0.5">{value}</dd>
              </div>
            ))}
          </dl>

          {solicitud.mensajeAnalista && (
            <p className="text-sm text-slate-500 italic max-w-md">
              Mensaje del analista: {solicitud.mensajeAnalista}
            </p>
          )}

          <Link
            href="/dashboard/inicio"
            className="inline-flex items-center gap-2 text-emerald-700 font-semibold text-sm hover:text-emerald-800 transition-colors mt-1"
          >
            Volver al inicio <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    )
  }

  return (
    <>
      <section className="bg-gradient-to-br from-emerald-600 to-emerald-900 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        <div className="absolute left-0 bottom-0 w-48 h-48 bg-emerald-400/20 rounded-full blur-2xl translate-y-1/4 -translate-x-1/4" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="flex flex-col gap-3">
            <span className="inline-flex items-center gap-2 w-fit px-3 py-1 rounded-full text-xs font-bold bg-white/15 text-emerald-100 border border-white/20 uppercase tracking-wide">
              <Banknote className="w-3.5 h-3.5" /> Desembolso en proceso
            </span>
            <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight">
              ¡Crédito aprobado!
            </h2>
            <p className="text-emerald-100/90 mt-1 max-w-lg text-sm leading-relaxed">
              Tu solicitud fue aprobada{fechaAprobacion ? ` el ${fechaAprobacion}` : ''}.
              En los próximos días hábiles procesaremos el desembolso de{' '}
              <strong className="text-white">{formatCOP(solicitud.monto)}</strong> en tu cuenta.
            </p>
            <p className="text-emerald-200/80 text-sm flex items-center gap-2">
              <Mail className="w-4 h-4 shrink-0" />
              Te notificaremos por correo cuando el dinero esté disponible.
            </p>
          </div>

          <div className="flex flex-col gap-2 bg-white/10 backdrop-blur-sm border border-white/15 rounded-2xl p-5 min-w-[200px]">
            <span className="text-emerald-200 text-xs font-semibold uppercase tracking-wide">Resumen</span>
            <p className="text-2xl font-bold">{formatCOP(solicitud.monto)}</p>
            <p className="text-emerald-100 text-sm">
              {solicitud.plazo} meses · ~{formatCOP(solicitud.cuotaEstimada)}/mes
            </p>
            <p className="text-emerald-200/70 text-xs">Ref. #{ref}</p>
          </div>
        </div>
      </section>

      <section className="bg-white border border-emerald-100 rounded-2xl p-6 shadow-sm">
        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-4">¿Qué sigue?</h3>
        <ol className="space-y-3">
          {PASOS.map((paso, i) => (
            <li key={paso} className="flex items-start gap-3 text-sm text-slate-600">
              <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center justify-center shrink-0">
                {i + 1}
              </span>
              {paso}
            </li>
          ))}
        </ol>
        {solicitud.mensajeAnalista && (
          <p className="mt-4 pt-4 border-t border-slate-100 text-sm text-slate-500">
            <span className="font-semibold text-slate-700">Nota del analista:</span>{' '}
            {solicitud.mensajeAnalista}
          </p>
        )}
      </section>
    </>
  )
}
