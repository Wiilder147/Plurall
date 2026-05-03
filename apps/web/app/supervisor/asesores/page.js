import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { formatCOP } from '@/lib/calculadora'
import { UserCheck, Users, TrendingUp, AlertTriangle } from 'lucide-react'
import AsignarAsesorBtn from '@/components/AsignarAsesorBtn'

export const dynamic = 'force-dynamic'

function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export default async function SupervisorAsesoresPage() {
  const supabase = await createClient()
  const service  = getServiceClient()

  // Obtener todos los asesores
  const { data: asesores } = await service
    .from('perfil_usuario')
    .select('id, nombre_completo, activo, rol ( nombre_rol )')
    .eq('activo', true)
    .in('id_rol',
      (await service.from('rol').select('id_rol').eq('nombre_rol', 'ASESOR')).data?.map(r => r.id_rol) ?? []
    )

  // Obtener asignaciones activas con datos del cliente y crédito
  const { data: asignaciones } = await service
    .from('asignacion_asesor')
    .select(`
      id_asignacion, id_asesor, activa, fecha_asignacion,
      cliente (
        id_cliente, nombre_completo, dni, telefono,
        credito ( estado_credito, saldo_pendiente, dias_mora_maximo )
      )
    `)
    .eq('activa', true)
    .order('fecha_asignacion', { ascending: false })

  // Obtener clientes sin asesor asignado y con crédito en mora
  const { data: clientesSinAsesor } = await service
    .from('credito')
    .select(`
      id_credito, saldo_pendiente, dias_mora_maximo,
      cliente ( id_cliente, nombre_completo, dni, telefono )
    `)
    .eq('estado_credito', 'EN_MORA')
    .not('id_cliente', 'in',
      `(${(asignaciones ?? []).map(a => `'${a.cliente?.id_cliente}'`).join(',') || "'00000000-0000-0000-0000-000000000000'"})`
    )

  // Agrupar asignaciones por asesor
  const asignacionesPorAsesor = {}
  asignaciones?.forEach(a => {
    if (!asignacionesPorAsesor[a.id_asesor]) asignacionesPorAsesor[a.id_asesor] = []
    asignacionesPorAsesor[a.id_asesor].push(a)
  })

  return (
    <div className="flex flex-col gap-8 pb-10">
      <header>
        <h1 className="text-3xl font-bold text-white tracking-tight">Gestión de Asesores</h1>
        <p className="text-slate-400 mt-1">Asignación de clientes en mora a asesores de cobranza.</p>
      </header>

      {/* Resumen */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Asesores activos',      value: asesores?.length ?? 0,          icon: UserCheck,    color: 'text-indigo-400 bg-indigo-500/10' },
          { label: 'Clientes asignados',    value: asignaciones?.length ?? 0,       icon: Users,        color: 'text-blue-400 bg-blue-500/10' },
          { label: 'Sin asesor (en mora)',  value: clientesSinAsesor?.length ?? 0,  icon: AlertTriangle,color: 'text-red-400 bg-red-500/10' },
          { label: 'Total en mora',         value: (asignaciones?.length ?? 0) + (clientesSinAsesor?.length ?? 0), icon: TrendingUp, color: 'text-orange-400 bg-orange-500/10' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${color}`}>
              <Icon className="w-4 h-4" />
            </div>
            <p className="text-2xl font-extrabold text-white">{value}</p>
            <p className="text-slate-400 text-sm mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Asesores y sus carteras */}
      {asesores && asesores.length > 0 ? (
        <div className="flex flex-col gap-4">
          {asesores.map((asesor) => {
            const misAsignaciones = asignacionesPorAsesor[asesor.id] ?? []
            const enMora = misAsignaciones.filter(a => a.cliente?.credito?.some(c => c.estado_credito === 'EN_MORA')).length
            return (
              <div key={asesor.id} className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-700 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center text-indigo-400 font-bold">
                      {asesor.nombre_completo?.charAt(0)?.toUpperCase() ?? 'A'}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-200">{asesor.nombre_completo}</p>
                      <p className="text-slate-500 text-xs">{misAsignaciones.length} clientes · {enMora} en mora</p>
                    </div>
                  </div>
                </div>
                {misAsignaciones.length === 0 ? (
                  <p className="text-slate-500 text-sm text-center py-6">Sin clientes asignados.</p>
                ) : (
                  <div className="divide-y divide-slate-700/40">
                    {misAsignaciones.map((a) => {
                      const creditoActivo = a.cliente?.credito?.find(c => ['ACTIVO','EN_MORA'].includes(c.estado_credito))
                      const esMora = creditoActivo?.estado_credito === 'EN_MORA'
                      return (
                        <div key={a.id_asignacion} className="px-5 py-3 flex items-center justify-between">
                          <div>
                            <p className="text-slate-300 text-sm font-medium">{a.cliente?.nombre_completo}</p>
                            <p className="text-slate-500 text-xs">{a.cliente?.telefono} · CC {a.cliente?.dni}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            {creditoActivo && (
                              <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                                esMora ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'
                              }`}>
                                {esMora ? `${creditoActivo.dias_mora_maximo}d mora` : 'Al día'}
                              </span>
                            )}
                            <span className="text-slate-400 text-xs">{formatCOP(creditoActivo?.saldo_pendiente ?? 0)}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8 text-center">
          <UserCheck className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 font-medium">No hay asesores registrados aún.</p>
          <p className="text-slate-500 text-sm mt-1">
            Para crear un asesor, registra un usuario y asígnale el rol <code className="text-indigo-400">ASESOR</code> en la BD.
          </p>
        </div>
      )}

      {/* Clientes sin asesor */}
      {clientesSinAsesor && clientesSinAsesor.length > 0 && (
        <div className="bg-slate-800 border border-red-500/20 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-red-500/20 bg-red-500/5">
            <h2 className="font-semibold text-red-400 text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Clientes en mora sin asesor asignado ({clientesSinAsesor.length})
            </h2>
          </div>
          <div className="divide-y divide-slate-700/40">
            {clientesSinAsesor.map((c) => (
              <div key={c.id_credito} className="px-5 py-3.5 flex items-center justify-between">
                <div>
                  <p className="text-slate-300 text-sm font-medium">{c.cliente?.nombre_completo}</p>
                  <p className="text-slate-500 text-xs">{c.cliente?.telefono} · Saldo: {formatCOP(c.saldo_pendiente)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-red-400 font-bold text-sm">{c.dias_mora_maximo}d mora</span>
                  {asesores && asesores.length > 0 && (
                    <AsignarAsesorBtn
                      clienteId={c.cliente?.id_cliente}
                      asesores={asesores.map(a => ({ id: a.id, nombre: a.nombre_completo }))}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
