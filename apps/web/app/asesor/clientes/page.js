/* ==========================================================================
 * ARCHIVO: page.js
 * RUTA: apps/web/app/asesor/clientes/page.js
 * DESCRIPCIÓN: Vista del panel para el rol de asesor.
 * FUNCIONALIDAD: Este archivo define la lógica y estructura para su respectivo módulo.
 * ========================================================================== */
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatCOP } from '@/lib/calculadora'
import { Users, ArrowRight, AlertTriangle, CheckCircle2, Search } from 'lucide-react'
import { formatNombre } from '@/lib/nombre'

export const dynamic = 'force-dynamic'

export default async function AsesorClientesPage({ searchParams }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const params  = await searchParams
  const buscar  = params?.q || ''

  const { data: asignaciones } = await supabase
    .from('asignacion_asesor')
    .select(`
      id_asignacion,
      cliente (
        id_cliente, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, dni, telefono, email, score_credito,
        credito ( id_credito, estado_credito, saldo_pendiente, cuotas_en_mora, dias_mora_maximo, cuota_fija, numero_cuotas, cuotas_pagadas )
      )
    `)
    .eq('id_asesor', user.id)
    .eq('activa', true)

  let clientes = asignaciones?.map(a => a.cliente).filter(Boolean) ?? []

  if (buscar) {
    const q = buscar.toLowerCase()
    clientes = clientes.filter(c =>
      formatNombre(c)?.toLowerCase().includes(q) ||
      c.dni?.includes(q) ||
      c.telefono?.includes(q)
    )
  }

  return (
    <div className="flex flex-col gap-6 pb-10">
      <header>
        <h1 className="text-3xl font-bold text-white tracking-tight">Mis Clientes</h1>
        <p className="text-slate-400 mt-1">{clientes.length} cliente{clientes.length !== 1 ? 's' : ''} asignado{clientes.length !== 1 ? 's' : ''}.</p>
      </header>

      {/* Buscador */}
      <form method="GET" className="relative max-w-md">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input name="q" type="text" defaultValue={buscar}
          placeholder="Buscar por nombre, cédula o celular…"
          className="w-full bg-slate-800 border border-slate-700 text-slate-200 placeholder-slate-500 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
      </form>

      {clientes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Users className="w-12 h-12 text-slate-600 mb-4" />
          <p className="text-slate-400">{buscar ? 'Sin resultados.' : 'No tienes clientes asignados aún.'}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {clientes.map((c) => {
            const creditoActivo = c.credito?.find(cr => ['ACTIVO','EN_MORA'].includes(cr.estado_credito))
            const enMora        = creditoActivo?.estado_credito === 'EN_MORA'
            const progreso      = creditoActivo
              ? Math.round((creditoActivo.cuotas_pagadas / creditoActivo.numero_cuotas) * 100)
              : 0

            return (
              <Link key={c.id_cliente} href={`/asesor/cobranza/${c.id_cliente}`}
                className="bg-slate-800 border border-slate-700 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 hover:border-teal-600/40 transition-colors">
                <div className="flex items-start gap-4">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-base shrink-0 ${
                    enMora ? 'bg-red-500/20 text-red-400' : 'bg-teal-500/20 text-teal-400'
                  }`}>
                    {formatNombre(c)?.charAt(0)?.toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-200">{formatNombre(c)}</p>
                    <p className="text-slate-500 text-xs">CC {c.dni} · {c.telefono}</p>
                    {creditoActivo && (
                      <div className="flex items-center gap-3 mt-1.5">
                        <div className="w-24 bg-slate-700 rounded-full h-1.5">
                          <div className={`h-1.5 rounded-full ${enMora ? 'bg-red-500' : 'bg-teal-500'}`}
                            style={{ width: `${progreso}%` }} />
                        </div>
                        <span className="text-slate-500 text-xs">{progreso}% pagado</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  {creditoActivo ? (
                    <div className="text-right">
                      <p className="text-slate-300 font-semibold text-sm">{formatCOP(creditoActivo.saldo_pendiente)}</p>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        enMora ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'
                      }`}>
                        {enMora ? `${creditoActivo.dias_mora_maximo}d mora` : 'Al día'}
                      </span>
                    </div>
                  ) : (
                    <span className="text-slate-600 text-xs">Sin crédito activo</span>
                  )}
                  <ArrowRight className="w-4 h-4 text-slate-600" />
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
