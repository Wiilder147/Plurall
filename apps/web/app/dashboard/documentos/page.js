/* ==========================================================================
 * ARCHIVO: page.js
 * RUTA: apps/web/app/dashboard/documentos/page.js
 * DESCRIPCIÓN: Vista del panel de control del usuario.
 * FUNCIONALIDAD: Este archivo define la lógica y estructura para su respectivo módulo.
 * ========================================================================== */
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { formatCOP } from '@/lib/calculadora'
import {
  FileText,
  Download,
  FileCheck,
  Receipt,
  BarChart3,
  CreditCard,
  Info,
  Lock,
} from 'lucide-react'

export const dynamic = 'force-dynamic'

const ESTADO_UI = {
  ACTIVO:    { label: 'Activo',    color: 'bg-emerald-100 text-emerald-700' },
  EN_MORA:   { label: 'En mora',   color: 'bg-red-100 text-red-700' },
  PAGADO:    { label: 'Pagado',    color: 'bg-blue-100 text-blue-700' },
  CANCELADO: { label: 'Cancelado', color: 'bg-slate-100 text-slate-600' },
}

const DOCUMENTOS = [
  {
    key:     'contrato',
    label:   'Contrato de Crédito',
    desc:    'Documento oficial con términos, condiciones y obligaciones del crédito.',
    icon:    FileText,
    estados: ['ACTIVO', 'EN_MORA', 'CANCELADO'],
    accent:  'text-blue-600 bg-blue-50',
  },
  {
    key:     'plan-pagos',
    label:   'Plan de Pagos',
    desc:    'Tabla de amortización completa con capital, interés y saldo por cuota.',
    icon:    Receipt,
    estados: ['ACTIVO', 'EN_MORA', 'CANCELADO'],
    accent:  'text-orange-600 bg-orange-50',
  },
  {
    key:     'estado-cuenta',
    label:   'Estado de Cuenta',
    desc:    'Resumen actualizado de pagos realizados, saldo y cuotas pendientes.',
    icon:    BarChart3,
    estados: ['ACTIVO', 'EN_MORA', 'CANCELADO'],
    accent:  'text-purple-600 bg-purple-50',
  },
  {
    key:     'paz-y-salvo',
    label:   'Paz y Salvo',
    desc:    'Certificado que acredita la cancelación total del crédito.',
    icon:    FileCheck,
    estados: ['PAGADO', 'CANCELADO'],
    accent:  'text-emerald-600 bg-emerald-50',
  },
]

export default async function DocumentosPage() {
  const supabase = await createClient()

  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) redirect('/login')

  const { data: clienteRow } = await supabase
    .from('cliente')
    .select('id_cliente')
    .eq('id_usuario_cuenta', user.id)
    .single()

  let creditos = []

  if (clienteRow) {
    const { data } = await supabase
      .from('credito')
      .select(`
        id_credito,
        monto_desembolsado,
        numero_cuotas,
        cuota_fija,
        saldo_pendiente,
        cuotas_pagadas,
        estado_credito,
        fecha_desembolso
      `)
      .eq('id_cliente', clienteRow.id_cliente)
      .in('estado_credito', ['ACTIVO', 'EN_MORA', 'PAGADO', 'CANCELADO'])
      .order('fecha_desembolso', { ascending: false })

    if (data) creditos = data
  }

  return (
    <div className="flex flex-col gap-8 pb-10">

      {/* Encabezado */}
      <header>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Mis Documentos</h1>
        <p className="text-slate-500 mt-1">
          Descarga los documentos oficiales de cada uno de tus créditos con Plurall.
        </p>
      </header>

      {/* Sin créditos */}
      {creditos.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 flex flex-col items-center text-center gap-4">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center">
            <FileText className="w-8 h-8 text-slate-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-700">Sin documentos disponibles</h2>
            <p className="text-slate-500 text-sm mt-1 max-w-sm">
              Los documentos estarán disponibles una vez tengas un crédito desembolsado con Plurall.
            </p>
          </div>
        </div>
      )}

      {/* Lista de créditos */}
      {creditos.length > 0 && (
        <div className="flex flex-col gap-6">
          {creditos.map((credito) => {
            const ui        = ESTADO_UI[credito.estado_credito] ?? ESTADO_UI.ACTIVO
            const ref       = String(credito.id_credito).slice(-8).toUpperCase()
            const fechaDisp = credito.fecha_desembolso
              ? new Date(credito.fecha_desembolso).toLocaleDateString('es-CO', {
                  day: '2-digit', month: 'short', year: 'numeric',
                })
              : '—'

            return (
              <div
                key={credito.id_credito}
                className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden"
              >
                {/* Cabecera del crédito */}
                <div className="px-6 py-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-11 h-11 bg-orange-50 rounded-xl flex items-center justify-center shrink-0">
                      <CreditCard className="w-5 h-5 text-orange-500" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="font-bold text-slate-900">Crédito #{ref}</h2>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ui.color}`}>
                          {ui.label}
                        </span>
                      </div>
                      <p className="text-sm text-slate-500 mt-0.5">
                        {formatCOP(credito.monto_desembolsado)}
                        {' · '}{credito.numero_cuotas} cuotas de {formatCOP(credito.cuota_fija)}
                        {' · Desembolsado '}{fechaDisp}
                      </p>
                    </div>
                  </div>
                  {!['PAGADO', 'CANCELADO'].includes(credito.estado_credito) && (
                    <div className="text-right shrink-0">
                      <p className="text-xs text-slate-400 uppercase tracking-wide">Saldo pendiente</p>
                      <p className="text-lg font-bold text-slate-900">{formatCOP(credito.saldo_pendiente)}</p>
                    </div>
                  )}
                </div>

                {/* Grid de documentos */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                  {DOCUMENTOS.map((doc, idx) => {
                    const disponible = doc.estados.includes(credito.estado_credito)
                    const Icon       = doc.icon

                    return (
                      <div
                        key={doc.key}
                        className={[
                          'p-5 flex flex-col gap-3',
                          idx < DOCUMENTOS.length - 1 ? 'border-b lg:border-b-0 lg:border-r border-slate-100' : '',
                          !disponible ? 'bg-slate-50/40' : 'hover:bg-slate-50/60 transition-colors',
                        ].join(' ')}
                      >
                        {/* Icono + texto */}
                        <div className="flex items-start gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                            disponible ? doc.accent : 'text-slate-300 bg-slate-100'
                          }`}>
                            {disponible ? <Icon className="w-5 h-5" /> : <Lock className="w-4 h-4" />}
                          </div>
                          <div>
                            <p className={`font-semibold text-sm leading-snug ${disponible ? 'text-slate-800' : 'text-slate-400'}`}>
                              {doc.label}
                            </p>
                            <p className={`text-xs mt-0.5 leading-snug ${disponible ? 'text-slate-500' : 'text-slate-400'}`}>
                              {disponible ? doc.desc : 'Disponible solo cuando el crédito esté cancelado.'}
                            </p>
                          </div>
                        </div>

                        {/* Botón */}
                        {disponible ? (
                          <a
                            href={`/api/documentos/${doc.key}/${credito.id_credito}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-1.5 w-full text-xs font-semibold px-3 py-2.5 rounded-xl bg-slate-900 text-white hover:bg-slate-700 transition-colors mt-auto"
                          >
                            <Download className="w-3.5 h-3.5" />
                            Descargar
                          </a>
                        ) : (
                          <div className="inline-flex items-center justify-center gap-1.5 w-full text-xs font-semibold px-3 py-2.5 rounded-xl bg-slate-100 text-slate-400 mt-auto cursor-not-allowed">
                            <Lock className="w-3.5 h-3.5" />
                            No disponible
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Nota informativa */}
      <div className="flex items-start gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-500">
        <Info className="w-4 h-4 mt-0.5 shrink-0 text-slate-400" />
        <p>
          Los documentos se generan en tiempo real. Para guardarlos como PDF utiliza{' '}
          <strong>Archivo → Imprimir → Guardar como PDF</strong> en tu navegador, o presiona{' '}
          <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-200 font-mono text-xs">Ctrl + P</kbd>.
        </p>
      </div>

    </div>
  )
}
