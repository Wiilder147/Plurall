'use client'

import { useEffect, useState } from 'react'
import StaffPageShell from '@/components/dashboard/StaffPageShell'
import { Activity, CheckCircle2, XCircle, Server } from 'lucide-react'

export default function AdminSaludPage() {
  const [data, setData] = useState(null)

  useEffect(() => {
    fetch('/api/admin/salud').then(r => r.json()).then(setData)
  }, [])

  const servicios = data?.servicios ?? {}
  const metricas = data?.metricas ?? {}

  return (
    <StaffPageShell
      accent="orange"
      badge="Observabilidad"
      title="Salud del sistema"
      subtitle="Estado de integraciones, cron jobs y métricas operativas del día."
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="dash-panel bg-slate-800/80 border border-slate-700/80 rounded-2xl p-6">
          <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
            <Server className="w-5 h-5 text-orange-400" /> Integraciones
          </h2>
          <div className="flex flex-col gap-2">
            {Object.entries(servicios).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between py-2 border-b border-slate-700/50 last:border-0">
                <span className="text-slate-300 text-sm capitalize">{k}</span>
                {v ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <XCircle className="w-4 h-4 text-red-400" />}
              </div>
            ))}
          </div>
        </div>
        <div className="dash-panel bg-slate-800/80 border border-slate-700/80 rounded-2xl p-6">
          <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-orange-400" /> Métricas hoy
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              ['Cuotas vencidas', metricas.cuotasVencidas],
              ['Pagos hoy', metricas.pagosHoy],
              ['Solicitudes hoy', metricas.solicitudesHoy],
              ['Pagos Wompi hoy', metricas.pagosWompiHoy],
            ].map(([l, v]) => (
              <div key={l} className="bg-slate-700/40 rounded-xl p-3">
                <p className="text-2xl font-bold text-white">{v ?? '—'}</p>
                <p className="text-slate-500 text-xs">{l}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </StaffPageShell>
  )
}
