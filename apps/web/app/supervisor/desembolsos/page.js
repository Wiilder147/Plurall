/* ==========================================================================
 * ARCHIVO: page.js
 * RUTA: apps/web/app/supervisor/desembolsos/page.js
 * DESCRIPCIÓN: Módulo "Desembolso" (SUPERVISOR).
 * FUNCIONALIDAD: Lista las solicitudes APROBADAS pendientes de desembolso y
 *                permite ejecutar el desembolso (crea crédito + plan + cuotas).
 * ========================================================================== */
import { createClient } from '@/lib/supabase/server'
import { formatCOP } from '@/lib/calculadora'
import { Banknote, User, Calendar } from 'lucide-react'
import BotonDesembolsar from './BotonDesembolsar'
import { formatNombre } from '@/lib/nombre'

export const dynamic = 'force-dynamic'

export default async function DesembolsosPage() {
  const supabase = await createClient()

  const { data: solicitudes } = await supabase
    .from('solicitud_credito')
    .select(`
      id_solicitud, monto_solicitado, plazo_meses, fecha_solicitud,
      estado_solicitud ( nombre ),
      cliente ( primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, dni )
    `)
    .order('fecha_solicitud', { ascending: false })

  const aprobadas = (solicitudes ?? []).filter(
    (s) => s.estado_solicitud?.nombre?.toUpperCase() === 'APROBADA'
  )

  return (
    <div className="flex flex-col gap-6 pb-10">
      <header>
        <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
          <Banknote className="w-7 h-7 text-indigo-400" /> Desembolso
        </h1>
        <p className="text-slate-400 mt-1">Solicitudes aprobadas listas para entregar el dinero al cliente.</p>
      </header>

      {aprobadas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Banknote className="w-12 h-12 text-slate-600 mb-4" />
          <p className="text-slate-400 font-medium">No hay solicitudes aprobadas pendientes de desembolso.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {aprobadas.map((s) => {
            const fecha = new Date(s.fecha_solicitud).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
            return (
              <div key={s.id_solicitud} className="bg-slate-800 border border-emerald-500/20 rounded-2xl p-5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-start gap-4 min-w-0">
                    <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center shrink-0">
                      <User className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-200 text-sm">{formatNombre(s.cliente) || '—'}</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-slate-500">
                        <span>CC {s.cliente?.dni ?? '—'}</span>
                        <span>{formatCOP(s.monto_solicitado)} — {s.plazo_meses} meses</span>
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {fecha}</span>
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0 pl-14 sm:pl-0">
                    <BotonDesembolsar solicitudId={s.id_solicitud} nombreCliente={formatNombre(s.cliente) || 'el cliente'} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
