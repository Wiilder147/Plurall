/* ==========================================================================
 * ARCHIVO: FichaClienteStaff.js
 * RUTA: apps/web/components/cliente/FichaClienteStaff.js
 * DESCRIPCIÓN: Ficha de solo lectura de un cliente para el staff.
 * FUNCIONALIDAD: Muestra la información del cliente (datos, negocio, KYC,
 *                crédito activo, documentos, historial) SIN llevar al panel/flujo
 *                del cliente. La usan las vistas de detalle de cliente de admin,
 *                supervisor y asesor; cada panel conserva su propio layout y
 *                control de rol. `backHref` define a dónde vuelve.
 * ========================================================================== */
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatCOP } from '@/lib/calculadora'
import CambiarCelular from '@/components/CambiarCelular'
import { formatNombre } from '@/lib/nombre'
import { emailVisible } from '@/lib/email'
import {
  ArrowLeft, User, Phone, Mail, Hash, MapPin, Store,
  CreditCard, CheckCircle2, XCircle, Clock, AlertTriangle,
  TrendingUp, Wallet, FileText, BarChart3, Shield, Calendar,
  Download, Receipt, ExternalLink,
} from 'lucide-react'

const ESTADO_SOL_UI = {
  PENDIENTE:    { label: 'Pendiente',   cls: 'bg-yellow-500/10 text-yellow-400',   icon: Clock },
  EN_ESTUDIO:   { label: 'En estudio',  cls: 'bg-blue-500/10 text-blue-400',       icon: Clock },
  APROBADA:     { label: 'Aprobada',    cls: 'bg-emerald-500/10 text-emerald-400', icon: CheckCircle2 },
  DESEMBOLSADA: { label: 'Desembolsada',cls: 'bg-green-500/10 text-green-400',     icon: TrendingUp },
  RECHAZADA:    { label: 'Rechazada',   cls: 'bg-red-500/10 text-red-400',         icon: XCircle },
  CANCELADA:    { label: 'Cancelada',   cls: 'bg-slate-500/10 text-slate-400',     icon: XCircle },
}

// `puedeEditarCelular`: solo admin/supervisor pueden cambiar el celular.
export default async function FichaClienteStaff({ clienteId, backHref = '/', puedeEditarCelular = true }) {
  const supabase = await createClient()

  const [
    { data: cliente },
    { data: detalle },
    { data: negocio },
    { data: dir },
    { data: scoreRow },
    { data: documentos },
    { data: solicitudes },
    { data: creditos },
  ] = await Promise.all([
    supabase.from('cliente').select('*, estado_cliente ( nombre )').eq('id_cliente', clienteId).single(),
    supabase.from('perfil_financiero').select('*').eq('id_cliente', clienteId).maybeSingle(),
    supabase.from('negocio_cliente').select('nombre_negocio, descripcion, antiguedad_meses, tipo_negocio ( nombre )').eq('id_cliente', clienteId).order('created_at', { ascending: true }).limit(1).maybeSingle(),
    supabase.from('direccion').select('linea, tipo, municipio ( nombre, departamento ( nombre ) )').eq('id_cliente', clienteId).eq('tipo', 'NEGOCIO').maybeSingle(),
    supabase.from('vw_cliente_score').select('puntaje_total').eq('id_cliente', clienteId).maybeSingle(),
    supabase.from('documento_cliente').select('id_documento, tipo_documento, estado_verificacion, created_at, url_archivo').eq('id_cliente', clienteId).order('created_at', { ascending: false }),
    supabase.from('solicitud_credito').select('id_solicitud, monto_solicitado, plazo_meses, fecha_solicitud, estado_solicitud ( nombre )').eq('id_cliente', clienteId).order('fecha_solicitud', { ascending: false }),
    supabase.from('credito').select('id_credito, monto_desembolsado, cuota_fija, saldo_pendiente, estado_credito, fecha_desembolso, numero_cuotas, cuotas_pagadas').eq('id_cliente', clienteId).order('fecha_desembolso', { ascending: false }),
  ])

  if (!cliente) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 text-center">
        <User className="w-12 h-12 text-slate-600" />
        <p className="text-slate-400">Cliente no encontrado o sin acceso.</p>
        <Link href={backHref} className="text-orange-400 hover:underline">← Volver</Link>
      </div>
    )
  }

  const nombre        = formatNombre(cliente)
  const estadoCliente = cliente.estado_cliente?.nombre?.toUpperCase()
  const creditoActivo = creditos?.find(c => ['ACTIVO', 'EN_MORA'].includes(c.estado_credito))
  const totalDesemb   = creditos?.reduce((s, c) => s + (c.monto_desembolsado || 0), 0) ?? 0
  const docsAprobados = documentos?.filter(d => d.estado_verificacion === 'APROBADO').length ?? 0

  return (
    <div className="w-full flex flex-col gap-6 pb-10 max-w-5xl">
      <header>
        <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-orange-400 transition-colors mb-3">
          <ArrowLeft className="w-4 h-4" /> Volver
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-orange-500 rounded-2xl flex items-center justify-center text-white text-2xl font-black shrink-0">
              {nombre.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{nombre}</h1>
              <div className="flex items-center gap-2 flex-wrap mt-1">
                <span className="text-slate-400 text-sm">CC {cliente.dni}</span>
                <span className="text-slate-600">·</span>
                {puedeEditarCelular
                  ? <CambiarCelular idCliente={cliente.id_cliente} celularActual={cliente.telefono} />
                  : <span className="text-slate-400 text-sm">{cliente.telefono}</span>}
              </div>
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
            {(scoreRow?.puntaje_total ?? 0) > 0 && (
              <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-blue-500/10 text-blue-400">
                Score: {scoreRow.puntaje_total}
              </span>
            )}
          </div>
        </div>
      </header>

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
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
          <h2 className="font-semibold text-slate-300 mb-4 flex items-center gap-2 text-sm">
            <User className="w-4 h-4 text-orange-400" /> Datos personales
          </h2>
          <div className="flex flex-col gap-3 text-sm">
            <Campo icon={Hash}   label="Cédula"    value={cliente.dni} />
            <Campo icon={Phone}  label="Celular"   value={cliente.telefono} />
            <Campo icon={Mail}   label="Email"     value={emailVisible(cliente.email)} />
            <Campo icon={MapPin} label="Ciudad"    value={[dir?.municipio?.nombre, dir?.municipio?.departamento?.nombre].filter(Boolean).join(', ')} />
            <Campo icon={MapPin} label="Dirección" value={dir?.linea} />
          </div>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
          <h2 className="font-semibold text-slate-300 mb-4 flex items-center gap-2 text-sm">
            <Store className="w-4 h-4 text-orange-400" /> Negocio
          </h2>
          <div className="flex flex-col gap-3 text-sm">
            <Campo icon={Store}     label="Nombre"     value={negocio?.nombre_negocio} />
            <Campo icon={BarChart3} label="Tipo"       value={negocio?.tipo_negocio?.nombre} />
            <Campo icon={Calendar}  label="Antigüedad" value={negocio?.antiguedad_meses ? `${Math.floor(negocio.antiguedad_meses / 12)}a ${negocio.antiguedad_meses % 12}m` : null} />
            {detalle && (
              <>
                <Campo icon={TrendingUp} label="Ingresos/mes" value={detalle.ingresos_mensuales ? formatCOP(detalle.ingresos_mensuales) : null} />
                <Campo icon={Wallet}     label="Egresos/mes"  value={detalle.egresos_mensuales  ? formatCOP(detalle.egresos_mensuales)  : null} />
                <Campo icon={CreditCard} label="Otras deudas" value={detalle.otras_obligaciones ? formatCOP(detalle.otras_obligaciones) : null} />
              </>
            )}
          </div>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
          <h2 className="font-semibold text-slate-300 mb-4 flex items-center gap-2 text-sm">
            <FileText className="w-4 h-4 text-orange-400" /> Documentos KYC
          </h2>
          {!documentos?.length ? (
            <p className="text-slate-500 text-xs">Sin documentos subidos.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {documentos.map((doc) => (
                <div key={doc.id_documento} className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-slate-400">{doc.tipo_documento.replace(/_/g, ' ')}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`font-semibold ${
                      doc.estado_verificacion === 'APROBADO'  ? 'text-emerald-400' :
                      doc.estado_verificacion === 'RECHAZADO' ? 'text-red-400' : 'text-yellow-400'
                    }`}>{doc.estado_verificacion}</span>
                    {doc.url_archivo && (
                      <a href={`/api/documentos/ver/${doc.id_documento}`} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-orange-400 hover:text-orange-300 bg-orange-500/10 px-2 py-1 rounded-lg font-semibold">
                        Ver <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {creditoActivo && (
        <div className={`border rounded-2xl p-5 ${creditoActivo.estado_credito === 'EN_MORA' ? 'bg-red-500/5 border-red-500/20' : 'bg-emerald-500/5 border-emerald-500/20'}`}>
          <h2 className="font-semibold text-slate-300 mb-4 flex items-center gap-2 text-sm">
            {creditoActivo.estado_credito === 'EN_MORA' ? <AlertTriangle className="w-4 h-4 text-red-400" /> : <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
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
          <div className="mt-4">
            <div className="w-full bg-slate-700 rounded-full h-2">
              <div className={`h-2 rounded-full ${creditoActivo.estado_credito === 'EN_MORA' ? 'bg-red-500' : 'bg-emerald-500'}`}
                style={{ width: `${Math.round((creditoActivo.cuotas_pagadas / creditoActivo.numero_cuotas) * 100)}%` }} />
            </div>
            <p className="text-slate-500 text-xs mt-1">
              {Math.round((creditoActivo.cuotas_pagadas / creditoActivo.numero_cuotas) * 100)}% pagado
            </p>
          </div>
        </div>
      )}

      {creditos?.length > 0 && (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-700">
            <h2 className="font-semibold text-slate-300 text-sm flex items-center gap-2">
              <Receipt className="w-4 h-4 text-orange-400" /> Documentos del crédito (PDF)
            </h2>
          </div>
          <div className="divide-y divide-slate-700/50">
            {creditos.map((c) => {
              const ref = String(c.id_credito).slice(-8).toUpperCase()
              const docs = [
                { label: 'Contrato',        key: 'contrato' },
                { label: 'Plan de pagos',   key: 'plan-pagos' },
                { label: 'Estado de cuenta', key: 'estado-cuenta' },
                ...(c.estado_credito === 'CANCELADO' ? [{ label: 'Paz y salvo', key: 'paz-y-salvo' }] : []),
              ]
              return (
                <div key={c.id_credito} className="px-5 py-4">
                  <div className="flex items-center justify-between gap-3 mb-2.5">
                    <p className="text-slate-300 text-sm font-semibold">Crédito #{ref} <span className="text-slate-500 font-normal">· {formatCOP(c.monto_desembolsado)}</span></p>
                    <span className="text-xs text-slate-500">{c.estado_credito}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {docs.map((d) => (
                      <a key={d.key} href={`/api/documentos/${d.key}/${c.id_credito}`} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange-400 hover:text-orange-300 bg-orange-500/10 hover:bg-orange-500/20 px-3 py-1.5 rounded-lg transition-colors">
                        <Download className="w-3.5 h-3.5" /> {d.label}
                      </a>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

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
                <div key={sol.id_solicitud} className="flex items-center justify-between px-5 py-3.5">
                  <div>
                    <p className="text-slate-300 text-sm font-semibold">{formatCOP(sol.monto_solicitado)} — {sol.plazo_meses} meses</p>
                    <p className="text-slate-500 text-xs">
                      {new Date(sol.fecha_solicitud).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${ui.cls}`}>
                    <IconEstado className="w-3 h-3" /> {ui.label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

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
