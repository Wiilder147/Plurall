import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Search } from 'lucide-react'
import SupervisorCharts from '@/components/SupervisorCharts'

export const dynamic = 'force-dynamic'

export default async function SupervisorDashboard() {
  const supabase = await createClient()
  await supabase.auth.getUser()

  return (
    <div className="flex flex-col gap-6 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Panel Supervisor</h1>
          <p className="text-slate-400 mt-1">Visión ejecutiva de cartera, mora y solicitudes.</p>
        </div>
        <Link href="/supervisor/buscar"
          className="inline-flex items-center gap-2 bg-slate-800 border border-slate-700 hover:border-indigo-500/50 text-slate-400 hover:text-slate-200 px-4 py-2.5 rounded-xl text-sm transition-all">
          <Search className="w-4 h-4" /> Buscar cliente…
        </Link>
      </div>

      {/* Panel de gráficas interactivo (Client Component) */}
      <SupervisorCharts />
    </div>
  )
}
