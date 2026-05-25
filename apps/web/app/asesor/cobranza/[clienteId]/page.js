/* ==========================================================================
 * ARCHIVO: page.js
 * RUTA: apps/web/app/asesor/cobranza/[clienteId]/page.js
 * DESCRIPCIÓN: Vista del panel para el rol de asesor.
 * FUNCIONALIDAD: Este archivo define la lógica y estructura para su respectivo módulo.
 * ========================================================================== */
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatCOP } from '@/lib/calculadora'
import {
  ArrowLeft, Phone, Mail, CreditCard,
  AlertTriangle, CheckCircle2, Calendar, DollarSign,
} from 'lucide-react'
import RegistrarGestionForm from '@/components/RegistrarGestionForm'

export const dynamic = 'force-dynamic'

export default async function AsesorFichaClientePage({ params }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { clienteId } = await params

  // Verificar que este cliente esté asignado al asesor
  const { data: asignacion } = await supabase
    .from('asignacion_asesor')
    .select('id_asignacion')
    .eq('id_asesor', user.id)
    .eq('id_cliente', clienteId)
    .eq('activa', true)
    .single()

  if (!asignacion) redirect('/asesor/clientes')

  // Datos completos del cliente
  const [
    { data: cliente },
    { data: credito },
    { data: gestiones },
  ] = await Promise.all([
    supabase
      .from('cliente')
      .select('*, estado_cliente ( nombre )')
      .eq('id_cliente', clienteId)
      .single(),
    supabase
      .from('credito')
      .select(`
        id_credito, estado_credito, monto_desembolsado, saldo_pendiente,
        cuota_fija, numero_cuotas, cuotas_pagadas, cuotas_en_mora,
        dias_mora_maximo, fecha_desembolso, fecha_primera_cuota, fecha_ultima_cuota,
        plan_pago ( id_plan_pago )
      `)
      .eq('id_cliente', clienteId)
      .in('estado_credito', ['ACTIVO', 'EN_MORA'])
      .order('fecha_desembolso', { ascending: false })
      .limit(1)
      .single(),
    supabase
      .from('gestion_cobranza')
      .select('*')
      .eq('id_cliente', clienteId)
      .order('fecha_gestion', { ascending: false })
      .limit(20),
  ])

  if (!cliente) redirect('/asesor/clientes')

  // Cuotas vencidas
  let cuotasVencidas = []
  if (credito?.plan_pago?.id_plan_pago) {
    const { data: cv } = await supabase
      .from('cuota')
      .select('numero_cuota, monto_total_cuota, fecha_vencimiento')
      .eq('id_plan_pago', credito.plan_pago.id_plan_pago)
      .eq('estado_cuota', 'VENCIDA')
      .order('fecha_vencimiento', { ascending: true })
    cuotasVencidas = cv ?? []
  }

  const enMora       = credito?.estado_credito === 'EN_MORA'
  const montoVencido = cuotasVencidas.reduce((s, c) => s + (c.monto_total_cuota || 0), 0)
  const progreso     = credito ? Math.round((credito.cuotas_pagadas / credito.numero_cuotas) * 100) : 0

  return (
    <div className="flex flex-col gap-6 pb-10">
      <header>
        <Link href="/asesor/cobranza"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-teal-400 transition-colors mb-3">
          <ArrowLeft className="w-4 h-4" /> Volver a cobranza
        </Link>
        <div className="flex items-center gap-4">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white text-2xl font-black shrink-0 ${
            enMora ? 'bg-red-500/20 text-red-400' : 'bg-teal-500/20 text-teal-400'
          }`}>
            {cliente.nombre_completo?.charAt(0)?.toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">{cliente.nombre_completo}</h1>
            <p className="text-slate-400 text-sm">CC {cliente.dni} · {cliente.telefono}</p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Datos de contacto */}
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
          <h2 className="font-semibold text-slate-300 mb-4 text-sm flex items-center gap-2">
            <Phone className="w-4 h-4 text-teal-400" /> Contacto
          </h2>
          <div className="flex flex-col gap-3 text-sm">
            <div>
              <p className="text-slate-500 text-xs">Celular</p>
              <a href={`tel:${cliente.telefono}`}
                className="text-teal-400 font-semibold hover:text-teal-300 flex items-center gap-1.5 mt-0.5">
                <Phone className="w-3.5 h-3.5" /> {cliente.telefono}
              </a>
            </div>
            <div>
              <p className="text-slate-500 text-xs">WhatsApp</p>
              <a href={`https://wa.me/57${cliente.telefono}`} target="_blank" rel="noopener noreferrer"
                className="text-emerald-400 font-semibold hover:text-emerald-300 text-sm">
                Abrir chat →
              </a>
            </div>
            <div>
              <p className="text-slate-500 text-xs">Email</p>
              <p className="text-slate-300">{cliente.email || '—'}</p>
            </div>
            {cliente.ciudad && (
              <div>
                <p className="text-slate-500 text-xs">Ciudad</p>
                <p className="text-slate-300">{cliente.ciudad}</p>
              </div>
            )}
            {cliente.nombre_negocio && (
              <div className="bg-slate-700/50 rounded-lg p-3 mt-1">
                <p className="text-teal-400 text-xs font-medium">Negocio</p>
                <p className="text-slate-300 text-sm">{cliente.nombre_negocio}</p>
              </div>
            )}
          </div>
        </div>

        {/* Estado del crédito */}
        <div className={`border rounded-2xl p-5 ${
          enMora ? 'bg-red-500/5 border-red-500/20' : 'bg-slate-800 border-slate-700'
        }`}>
          <h2 className="font-semibold text-slate-300 mb-4 text-sm flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-teal-400" /> Crédito activo
          </h2>
          {!credito ? (
            <p className="text-slate-500 text-sm">Sin crédito activo.</p>
          ) : (
            <div className="flex flex-col gap-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Estado</span>
                <span className={`font-bold ${enMora ? 'text-red-400' : 'text-emerald-400'}`}>
                  {credito.estado_credito}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Saldo pendiente</span>
                <span className="text-slate-200 font-semibold">{formatCOP(credito.saldo_pendiente)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Cuota mensual</span>
                <span className="text-slate-200">{formatCOP(credito.cuota_fija)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Avance</span>
                <span className="text-slate-200">{credito.cuotas_pagadas}/{credito.numero_cuotas}</span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-1.5 mt-1">
                <div className={`h-1.5 rounded-full ${enMora ? 'bg-red-500' : 'bg-teal-500'}`}
                  style={{ width: `${progreso}%` }} />
              </div>
              {enMora && (
                <div className="mt-2 bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                  <p className="text-red-400 font-bold text-base">{credito.dias_mora_maximo} días de mora</p>
                  <p className="text-red-300 text-xs mt-0.5">
                    {cuotasVencidas.length} cuota{cuotasVencidas.length !== 1 ? 's' : ''} vencida{cuotasVencidas.length !== 1 ? 's' : ''} · {formatCOP(montoVencido)}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Cuotas vencidas */}
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
          <h2 className="font-semibold text-slate-300 mb-4 text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400" /> Cuotas vencidas ({cuotasVencidas.length})
          </h2>
          {cuotasVencidas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 gap-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              <p className="text-slate-400 text-sm">Sin cuotas vencidas</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {cuotasVencidas.map((c) => (
                <div key={c.numero_cuota} className="flex justify-between items-center text-xs bg-red-500/5 border border-red-500/10 rounded-lg px-3 py-2">
                  <span className="text-slate-400">Cuota #{c.numero_cuota}</span>
                  <span className="text-slate-500">
                    {new Date(c.fecha_vencimiento + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}
                  </span>
                  <span className="text-red-400 font-bold">{formatCOP(c.monto_total_cuota)}</span>
                </div>
              ))}
              <div className="flex justify-between text-xs font-bold border-t border-slate-700 pt-2 mt-1">
                <span className="text-slate-400">Total vencido</span>
                <span className="text-red-400">{formatCOP(montoVencido)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Formulario de gestión */}
      {credito && (
        <RegistrarGestionForm
          clienteId={clienteId}
          creditoId={credito.id_credito}
          clienteNombre={cliente.nombre_completo}
        />
      )}

      {/* Historial de gestiones */}
      {gestiones && gestiones.length > 0 && (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-700">
            <h2 className="font-semibold text-slate-300 text-sm flex items-center gap-2">
              <Calendar className="w-4 h-4 text-teal-400" /> Historial de gestiones ({gestiones.length})
            </h2>
          </div>
          <div className="divide-y divide-slate-700/50">
            {gestiones.map((g) => (
              <div key={g.id_gestion} className="px-5 py-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-slate-300 bg-slate-700 px-2 py-0.5 rounded">
                        {g.tipo_gestion}
                      </span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        ['EXITOSO','PAGO_RECIBIDO'].includes(g.resultado) ? 'bg-emerald-500/10 text-emerald-400' :
                        g.resultado === 'PROMESA'       ? 'bg-yellow-500/10 text-yellow-400' :
                        g.resultado === 'SIN_RESPUESTA' ? 'bg-slate-700 text-slate-400' :
                        'bg-red-500/10 text-red-400'
                      }`}>{g.resultado}</span>
                    </div>
                    {g.observaciones && <p className="text-slate-400 text-xs">{g.observaciones}</p>}
                    {g.monto_prometido && (
                      <p className="text-yellow-400 text-xs mt-0.5">
                        Promesa: {formatCOP(g.monto_prometido)} para el{' '}
                        {g.fecha_promesa ? new Date(g.fecha_promesa + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }) : '—'}
                      </p>
                    )}
                    {g.monto_recibido > 0 && (
                      <p className="text-emerald-400 text-xs mt-0.5">
                        Pago recibido: {formatCOP(g.monto_recibido)}
                      </p>
                    )}
                  </div>
                  <p className="text-slate-500 text-xs shrink-0">
                    {new Date(g.fecha_gestion).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
