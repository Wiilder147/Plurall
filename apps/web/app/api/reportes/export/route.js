/* ==========================================================================
 * ARCHIVO: route.js
 * RUTA: apps/web/app/api/reportes/export/route.js
 * DESCRIPCIÓN: Endpoint de API (Backend) para manejar la lógica de export
 * FUNCIONALIDAD: Este archivo define la lógica y estructura para su respectivo módulo.
 * ========================================================================== */
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { formatNombre } from '@/lib/nombre'

/**
 * GET /api/reportes/export?tipo=clientes|creditos|pagos|solicitudes|mora
 *
 * Genera y descarga un archivo CSV con los datos del reporte solicitado.
 * Solo accesible para ADMIN y SUPERVISOR.
 */

function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// ── Helpers CSV ──────────────────────────────────────────────────────────────

/** Escapa un valor para CSV: envuelve en comillas si tiene comas, saltos o comillas */
function escaparCSV(valor) {
  if (valor === null || valor === undefined) return ''
  const str = String(valor)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

/** Convierte un array de objetos a string CSV */
function arrayToCSV(filas, columnas) {
  const encabezado = columnas.map(c => escaparCSV(c.label)).join(',')
  const cuerpo = filas.map(fila =>
    columnas.map(c => escaparCSV(c.valor(fila))).join(',')
  ).join('\n')
  return `${encabezado}\n${cuerpo}`
}

/** Formatea fecha ISO a dd/mm/yyyy hh:mm */
function fmtFecha(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`
}

/** Formatea número como moneda COP sin símbolo */
function fmtCOP(n) {
  if (!n && n !== 0) return ''
  return Number(n).toLocaleString('es-CO')
}

// ── Generadores por tipo ─────────────────────────────────────────────────────

async function exportarClientes(service) {
  const { data } = await service
    .from('cliente')
    .select(`
      primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, dni, email, telefono, ciudad, departamento,
      score_credito, created_at,
      estado_cliente ( nombre ),
      tipo_negocio ( nombre )
    `)
    .order('created_at', { ascending: false })

  const columnas = [
    { label: 'Nombre completo',    valor: r => formatNombre(r) },
    { label: 'Cédula',             valor: r => r.dni },
    { label: 'Email',              valor: r => r.email },
    { label: 'Teléfono',           valor: r => r.telefono },
    { label: 'Ciudad',             valor: r => r.ciudad },
    { label: 'Departamento',       valor: r => r.departamento },
    { label: 'Tipo de negocio',    valor: r => r.tipo_negocio?.nombre },
    { label: 'Score crediticio',   valor: r => r.score_credito },
    { label: 'Estado',             valor: r => r.estado_cliente?.nombre },
    { label: 'Fecha registro',     valor: r => fmtFecha(r.created_at) },
  ]

  return { csv: arrayToCSV(data ?? [], columnas), nombre: 'clientes' }
}

async function exportarCreditos(service) {
  const { data } = await service
    .from('credito')
    .select(`
      id_credito, estado_credito,
      monto_desembolsado, tasa_interes_anual, numero_cuotas,
      cuota_fija, saldo_pendiente, cuotas_pagadas, cuotas_en_mora,
      dias_mora_maximo, fecha_desembolso, fecha_primera_cuota, fecha_ultima_cuota,
      cliente ( primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, dni, telefono )
    `)
    .order('fecha_desembolso', { ascending: false })

  const columnas = [
    { label: 'ID crédito',         valor: r => r.id_credito },
    { label: 'Cliente',            valor: r => formatNombre(r.cliente) },
    { label: 'Cédula',             valor: r => r.cliente?.dni },
    { label: 'Teléfono',           valor: r => r.cliente?.telefono },
    { label: 'Estado',             valor: r => r.estado_credito },
    { label: 'Monto desembolsado', valor: r => fmtCOP(r.monto_desembolsado) },
    { label: 'Tasa EA (%)',        valor: r => Number(r.tasa_interes_anual).toFixed(2) },
    { label: 'Cuotas totales',     valor: r => r.numero_cuotas },
    { label: 'Cuota fija',         valor: r => fmtCOP(r.cuota_fija) },
    { label: 'Saldo pendiente',    valor: r => fmtCOP(r.saldo_pendiente) },
    { label: 'Cuotas pagadas',     valor: r => r.cuotas_pagadas },
    { label: 'Cuotas en mora',     valor: r => r.cuotas_en_mora },
    { label: 'Días mora máx.',     valor: r => r.dias_mora_maximo },
    { label: 'Fecha desembolso',   valor: r => fmtFecha(r.fecha_desembolso) },
    { label: 'Primera cuota',      valor: r => r.fecha_primera_cuota },
    { label: 'Última cuota',       valor: r => r.fecha_ultima_cuota },
  ]

  return { csv: arrayToCSV(data ?? [], columnas), nombre: 'creditos' }
}

async function exportarPagos(service) {
  const { data } = await service
    .from('pago')
    .select(`
      id_recibo, estado, metodo_pago, referencia_externa,
      monto_pagado, monto_capital, monto_interes, monto_mora,
      fecha_pago, created_at,
      credito ( id_credito, cliente ( primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, dni ) )
    `)
    .eq('estado', 'CONFIRMADO')
    .order('fecha_pago', { ascending: false })

  const columnas = [
    { label: 'ID recibo',          valor: r => r.id_recibo },
    { label: 'Cliente',            valor: r => formatNombre(r.credito?.cliente) },
    { label: 'Cédula',             valor: r => r.credito?.cliente?.dni },
    { label: 'ID crédito',         valor: r => r.credito?.id_credito },
    { label: 'Estado',             valor: r => r.estado },
    { label: 'Método de pago',     valor: r => r.metodo_pago },
    { label: 'Referencia',         valor: r => r.referencia_externa },
    { label: 'Monto pagado',       valor: r => fmtCOP(r.monto_pagado) },
    { label: 'Capital',            valor: r => fmtCOP(r.monto_capital) },
    { label: 'Interés',            valor: r => fmtCOP(r.monto_interes) },
    { label: 'Mora',               valor: r => fmtCOP(r.monto_mora) },
    { label: 'Fecha pago',         valor: r => fmtFecha(r.fecha_pago) },
  ]

  return { csv: arrayToCSV(data ?? [], columnas), nombre: 'pagos' }
}

async function exportarSolicitudes(service) {
  const { data } = await service
    .from('solicitud_credito')
    .select(`
      id_solicitud, monto_solicitado, plazo_meses, canal_solicitud,
      fecha_solicitud, fecha_decision,
      estado_solicitud ( nombre ),
      cliente ( primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, dni, telefono ),
      decision_solicitud ( resultado, monto_aprobado, plazo_aprobado, tasa_interes_aprobada )
    `)
    .order('fecha_solicitud', { ascending: false })

  const columnas = [
    { label: 'ID solicitud',       valor: r => r.id_solicitud },
    { label: 'Cliente',            valor: r => formatNombre(r.cliente) },
    { label: 'Cédula',             valor: r => r.cliente?.dni },
    { label: 'Teléfono',           valor: r => r.cliente?.telefono },
    { label: 'Monto solicitado',   valor: r => fmtCOP(r.monto_solicitado) },
    { label: 'Plazo (meses)',      valor: r => r.plazo_meses },
    { label: 'Canal',              valor: r => r.canal_solicitud },
    { label: 'Estado',             valor: r => r.estado_solicitud?.nombre },
    { label: 'Fecha solicitud',    valor: r => fmtFecha(r.fecha_solicitud) },
    { label: 'Fecha decisión',     valor: r => fmtFecha(r.fecha_decision) },
    { label: 'Resultado decisión', valor: r => r.decision_solicitud?.[0]?.resultado },
    { label: 'Monto aprobado',     valor: r => fmtCOP(r.decision_solicitud?.[0]?.monto_aprobado) },
    { label: 'Plazo aprobado',     valor: r => r.decision_solicitud?.[0]?.plazo_aprobado },
    { label: 'Tasa aprobada (%)',  valor: r => {
      const t = r.decision_solicitud?.[0]?.tasa_interes_aprobada
      return t ? (Number(t) * 100).toFixed(4) : ''
    }},
  ]

  return { csv: arrayToCSV(data ?? [], columnas), nombre: 'solicitudes' }
}

async function exportarMora(service) {
  const { data } = await service
    .from('credito')
    .select(`
      id_credito, estado_credito, saldo_pendiente,
      cuotas_en_mora, dias_mora_maximo, fecha_desembolso,
      cliente ( primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, dni, telefono, email )
    `)
    .in('estado_credito', ['EN_MORA'])
    .order('dias_mora_maximo', { ascending: false })

  const columnas = [
    { label: 'ID crédito',         valor: r => r.id_credito },
    { label: 'Cliente',            valor: r => formatNombre(r.cliente) },
    { label: 'Cédula',             valor: r => r.cliente?.dni },
    { label: 'Teléfono',           valor: r => r.cliente?.telefono },
    { label: 'Email',              valor: r => r.cliente?.email },
    { label: 'Saldo pendiente',    valor: r => fmtCOP(r.saldo_pendiente) },
    { label: 'Cuotas en mora',     valor: r => r.cuotas_en_mora },
    { label: 'Días mora máx.',     valor: r => r.dias_mora_maximo },
    { label: 'Tramo de riesgo',    valor: r => {
      const d = r.dias_mora_maximo
      if (d === 0)        return 'Al día'
      if (d <= 30)        return 'Mora temprana (1-30)'
      if (d <= 60)        return 'Mora media (31-60)'
      if (d <= 90)        return 'Mora alta (61-90)'
      return 'Cartera castigada (+90)'
    }},
    { label: 'Fecha desembolso',   valor: r => fmtFecha(r.fecha_desembolso) },
  ]

  return { csv: arrayToCSV(data ?? [], columnas), nombre: 'mora' }
}

// ── Handler principal ────────────────────────────────────────────────────────

export async function GET(request) {
  const supabase = await createClient()

  // Verificar sesión y rol
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: perfil } = await supabase
    .from('perfil_usuario')
    .select('rol ( nombre_rol )')
    .eq('id', user.id)
    .single()

  const rol = perfil?.rol?.nombre_rol?.toUpperCase()
  if (!['ADMIN', 'SUPERVISOR'].includes(rol)) {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const tipo = searchParams.get('tipo') || 'clientes'

  const service = getServiceClient()

  const generadores = {
    clientes:    exportarClientes,
    creditos:    exportarCreditos,
    pagos:       exportarPagos,
    solicitudes: exportarSolicitudes,
    mora:        exportarMora,
  }

  const generador = generadores[tipo]
  if (!generador) {
    return NextResponse.json(
      { error: `Tipo inválido. Opciones: ${Object.keys(generadores).join(', ')}` },
      { status: 400 }
    )
  }

  const { csv, nombre } = await generador(service)

  const fecha = new Date().toISOString().split('T')[0]
  const filename = `plurall_${nombre}_${fecha}.csv`

  // BOM UTF-8 para que Excel abra correctamente caracteres especiales
  const bom = '\uFEFF'

  return new Response(bom + csv, {
    headers: {
      'Content-Type':        'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control':       'no-store',
    },
  })
}
