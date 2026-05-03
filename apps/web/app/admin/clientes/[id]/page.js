import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatCOP } from '@/lib/calculadora'
import {
  ArrowLeft, User, Phone, Mail, Hash, MapPin, Store,
  CreditCard, CheckCircle2, XCircle, Clock, AlertTriangle,
  TrendingUp, Wallet, FileText, BarChart3, Shield, Calendar,
} from 'lucide-react'

export const dynamic = 'force-dynamic'

const ESTADO_CREDITO_UI = {
  ACTIVO:    { label: 'Activo',    cls: 'bg-emerald-100 text-emerald-700' },
  EN_MORA:   { label: 'En mora',   cls: 'bg-red-100 text-red-700' },
  CANCELADO: { label: 'Cancelado', cls: 'bg-slate-100 text-slate-500' },
  CASTIGADO: { label: 'Castigado', cls: 'bg-gray-100 text-gray-500' },
}

const ESTADO_SOL_UI = {
  PENDIENTE:    { label: 'Pendiente',   cls: 'bg-yellow-500/10 text-yellow-400',   icon: Clock },
  EN_ESTUDIO:   { label: 'En estudio',  cls: 'bg-blue-500/10 text-blue-400',       icon: Clock },
  APROBADA:     { label: 'Aprobada',    cls: 'bg-emerald-500/10 text-emerald-400', icon: CheckCircle2 },
  DESEMBOLSADA: { label: 'Desembolsada',cls: 'bg-green-500/10 text-green-400',     icon: TrendingUp },
  RECHAZADA:    { label: 'Rechazada',   cls: 'bg-red-500/10 text-red-400',         icon: XCircle },
  CANCELADA:    { label: 'Cancelada',   cls: 'bg-slate-500/10 text-slate-400',     icon: XCircle },
}

export default async function AdminDetalleClientePage({ params }) {
  const supabase = await createClient()

  // ── Verificar rol admin/analista ─────────────────────────────
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: perfil } = await supabase
    .from('perfil_usuario')
    .select('rol ( nombre_rol )')
    .eq('id', user.id)
    .single()

  const rol = perfil?.rol?.nombre_rol?.toUpperCase()
  if (!['ADMIN', 'ANALISTA'].includes(rol)) redirect('/dashboard/inicio')

  const { id: clienteId } = await params

  // ── Cargar datos del cliente en paralelo ─────────────────────
  const [
    { data: cliente },
    { data: detalle },
    { data: documentos },
    { data: solicitudes },
    { data: creditos },
  ] = await Promise.all([
    supabase
      .from('cliente')
      .select('*, estado_cliente ( nombre ), tipo_negocio ( nombre )')
      .eq('id_cliente', clienteId)
      .single(),
    supabase
      .from('detalle_cliente')
      .select('*')
      .eq('id_cliente', clienteId)
      .single(),
    supabase
      .from('documento_cliente')
      .select('tipo_documento, estado_verificacion, created_at')
      .eq('id_cliente', clienteId)
      .order('created_at', { ascending: false }),
    supabase
      .from('solicitud_credito')
      .select('id_solicitud, monto_solicitado, plazo_meses, fecha_solicitud, estado_solicitud ( nombre )')
      .eq('id_cliente', clienteId)
      .order('fecha_solicitud', { ascending: false }),
    supabase
      .from('credito')
      .select('id_credito, monto_desembolsado, cuota_fija, saldo_pendiente, estado_credito, fecha_desembolso, numero_cuotas, cuotas_pagadas')
      .eq('id_cliente', clienteId)
      .order('fecha_desembolso', { ascending: false }),
  ])

  if (!cliente) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 text-center">
        <User className="w-12 h-12 text-slate-600" />
        <p className="text-slate-400">Cliente no encontrado.</p>
        <Link href="/admin/clientes" className="text-orange-400 hover:underline">← Volver</Link>
      </div>
    )
  }

  const nombre        = cliente.nombre_completo
  const estadoCliente = cliente.estado_cliente?.nombre?.toUpperCase()
  const creditoActivo = creditos?.find(c => ['ACTIVO', 'EN_MORA'].includes(c.estado_credito))
  const totalDesemb   = creditos?.reduce((s, c) => s + (c.monto_desembolsado || 0), 0) ?? 0
  const docsAprobados = documentos?.filter(d => d.estado_verificacion === 'APROBADO').length ?? 0

  return (
    <div className="flex flex-col gap-6 pb-10 max-w-5xl">

      {/* ── Header ── */}
      <header>
        <Link href="/admin/clientes" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-orange-400 transition-colors mb-3">
          <ArrowLeft className="w-4 h-4" /> Volver a clientes
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-orange-500 rounded-2xl flex items-center justify-center text-white text-2xl font-black shrink-0">
              {nombre.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{nombre}</h1>
              <p className="text-slate-400 text-sm">CC {cliente.dni} · {cliente.telefono}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`px-3 py-1.5 rounded-full text-xs font-bold ${
              estadoCliente === 'ACTIVO'    ? 'bg-emerald-500/10 text-emerald-400' :
              estadoCliente === 'BLOQUEADO' ? 'bg-red-500/10 text-red-400' :
              'bg-slate-500/10 text-slate-400'
            }`}>
              {estadoCliente || 'ACTIVO'}
            </span>
            {cliente.score_credito > 0 && (
              <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-blue-500/10 text-blue-400">
                Score: {cliente.score_credito}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* ── KPIs rápidos ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Solicitudes',       value: solicitudes?.length ?? 0,    icon: FileText,   color: 'text-yellow-400 bg-yellow-500/10' },
          { label: 'Créditos totales',  value: creditos?.length ?? 0,       icon: CreditCard, color: 'text-blue-400 bg-blue-500/10' },
          { label: 'Total desembolsado',value: formatCOP(totalDesemb),       icon: Wallet,     color: 'text-orange-400 bg-orange-500/10' },
          { label: 'Docs aprobados',    value: `${docsAprobados}/${documentos?.length ?? 0}`, icon: Shield, color: 'text-emerald-400 bg-emerald-500/10' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${color}`}>
              <Icon className="w-4 h-4" />
            </div>
            <p className="text-xl font-extrabold text-white">{value}</p>
            <p className="text-slate-400 text-xs mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* ── Datos personales ── */}
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
          <h2 className="font-semibold text-slate-300 mb-4 flex items-center gap-2 text-sm">
            <User className="w-4 h-4 text-orange-400" /> Datos personales
          </h2>
          <div className="flex flex-col gap-3 text-sm">
            <Campo icon={Hash}     label="Cédula"    value={cliente.dni} />
            <Campo icon={Phone}    label="Celular"   value={cliente.telefono} />
            <Campo icon={Mail}     label="Email"     value={cliente.email} />
            <Campo icon={MapPin}   label="Ciudad"    value={[cliente.ciudad, cliente.departamento].filter(Boolean).join(', ')} />
            <Campo icon={MapPin}   label="Dirección" value={cliente.direccion} />
          </div>
        </div>

        {/* ── Negocio ── */}
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
          <h2 className="font-semibold text-slate-300 mb-4 flex items-center gap-2 text-sm">
            <Store className="w-4 h-4 text-orange-400" /> Negocio
          </h2>
          <div className="flex flex-col gap-3 text-sm">
            <Campo icon={Store}    label="Nombre"      value={cliente.nombre_negocio} />
            <Campo icon={BarChart3} label="Tipo"       value={cliente.tipo_negocio?.nombre} />
            <Campo icon={Calendar} label="Antigüedad"  value={
              cliente.antiguedad_negocio_meses
                ? `${Math.floor(cliente.antiguedad_negocio_meses / 12)}a ${cliente.antiguedad_negocio_meses % 12}m`
                : null
            } />
            {detalle && (
              <>
                <Campo icon={TrendingUp} label="Ingresos/mes"  value={detalle.ingresos_mensuales ? formatCOP(detalle.ingresos_mensuales) : null} />
                <Campo icon={Wallet}     label="Egresos/mes"   value={detalle.egresos_mensuales  ? formatCOP(detalle.egresos_mensuales)  : null} />
                <Campo icon={CreditCard} label="Otras deudas"  value={detalle.otras_obligaciones ? formatCOP(detalle.otras_obligaciones) : null} />
              </>
            )}
          </div>
        </div>

        {/* ── Documentos KYC ── */}
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
          <h2 className="font-semibold text-slate-300 mb-4 flex items-center gap-2 text-sm">
            <FileText className="w-4 h-4 text-orange-400" /> Documentos KYC
          </h2>
          {!documentos?.length ? (
            <p className="text-slate-500 text-xs">Sin documentos subidos.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {documentos.map((doc) => (
                <div key={doc.tipo_documento} className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">{doc.tipo_documento.replace(/_/g, ' ')}</span>
                  <span className={`font-semibold ${
                    doc.estado_verificacion === 'APROBADO'  ? 'text-emerald-400' :
                    doc.estado_verificacion === 'RECHAZADO' ? 'text-red-400' : 'text-yellow-400'
                  }`}>
                    {doc.estado_verificacion}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Crédito activo ── */}
      {creditoActivo && (
        <div className={`border rounded-2xl p-5 ${
          creditoActivo.estado_credito === 'EN_MORA'
            ? 'bg-red-500/5 border-red-500/20'
            : 'bg-emerald-500/5 border-emerald-500/20'
        }`}>
          <h2 className="font-semibold text-slate-300 mb-4 flex items-center gap-2 text-sm">
            {creditoActivo.estado_credito === 'EN_MORA'
              ? <AlertTriangle className="w-4 h-4 text-red-400" />
              : <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            }
            Crédito activo — {creditoActivo.estado_credito}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {[
              ['Monto desembolsado', formatCOP(creditoActivo.monto_desembolsado)],
              ['Saldo pendiente',    formatCOP(creditoActivo.saldo_pendiente)],
              ['Cuota mensual',      formatCOP(creditoActivo.cuota_fija)],
              ['Avance',             `${creditoActivo.cuotas_pagadas}/${creditoActivo.numero_cuotas} cuotas`],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-slate-500 text-xs">{label}</p>
                <p className="text-slate-200 font-semibold mt-0.5">{value}</p>
              </div>
            ))}
          </div>
          {/* Barra de progreso */}
          <div className="mt-4">
            <div className="w-full bg-slate-700 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${creditoActivo.estado_credito === 'EN_MORA' ? 'bg-red-500' : 'bg-emerald-500'}`}
                style={{ width: `${Math.round((creditoActivo.cuotas_pagadas / creditoActivo.numero_cuotas) * 100)}%` }}
              />
            </div>
            <p className="text-slate-500 text-xs mt-1">
              {Math.round((creditoActivo.cuotas_pagadas / creditoActivo.numero_cuotas) * 100)}% pagado
            </p>
          </div>
        </div>
      )}

      {/* ── Historial de solicitudes ── */}
      {solicitudes?.length > 0 && (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-700">
            <h2 className="font-semibold text-slate-300 text-sm flex items-center gap-2">
              <FileText className="w-4 h-4 text-orange-400" /> Historial de solicitudes
            </h2>
          </div>
          <div className="divide-y divide-slate-700/50">
            {solicitudes.map((sol) => {
              const estadoNombre = sol.estado_solicitud?.nombre?.toUpperCase() || 'PENDIENTE'
              const ui = ESTADO_SOL_UI[estadoNombre] ?? ESTADO_SOL_UI.PENDIENTE
              const IconEstado = ui.icon
              return (
                <Link
                  key={sol.id_solicitud}
                  href={`/admin/solicitudes/${sol.id_solicitud}`}
                  className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-700/40 transition-colors"
                >
                  <div>
                    <p className="text-slate-300 text-sm font-semibold">{formatCOP(sol.monto_solicitado)} — {sol.plazo_meses} meses</p>
                    <p className="text-slate-500 text-xs">
                      {new Date(sol.fecha_solicitud).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${ui.cls}`}>
                    <IconEstado className="w-3 h-3" /> {ui.label}
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
      )}

    </div>
  )
}

// ── Campo de solo lectura ────────────────────────────────────────────────────
function Campo({ icon: Icon, label, value }) {
  return (
    <div>
      <p className="text-slate-500 text-xs flex items-center gap-1 mb-0.5">
        <Icon className="w-3 h-3" /> {label}
      </p>
      <p className="text-slate-200 font-medium">{value || <span className="text-slate-600 font-normal">—</span>}</p>
    </div>
  )
}
