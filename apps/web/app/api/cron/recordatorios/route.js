import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'
import { notificarRecordatorioCuota } from '@/lib/notificaciones'
import { registrarNotificacionCliente } from '@/lib/notificacionesInApp'
import { formatNombre } from '@/lib/nombre'

function getServiceClient() {
  return createServiceClient()
}

export async function GET(request) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const supabase = getServiceClient()
  const hoy = new Date()
  const en3dias = new Date(hoy)
  en3dias.setDate(en3dias.getDate() + 3)
  const fechaObjetivo = en3dias.toISOString().split('T')[0]

  const resumen = { recordatorios: 0, errores: [] }

  const { data: cuotas } = await supabase
    .from('cuota')
    .select(`
      id_cuota, numero_cuota, monto_total_cuota, fecha_vencimiento,
      plan_pago ( credito ( id_credito, id_cliente, numero_cuotas, cliente ( primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, email, id_usuario_cuenta ) ) )
    `)
    .eq('fecha_vencimiento', fechaObjetivo)
    .eq('estado_cuota', 'PENDIENTE')

  for (const cuota of cuotas ?? []) {
    const credito = cuota.plan_pago?.credito
    const cliente = credito?.cliente
    if (!cliente?.email) continue

    try {
      await notificarRecordatorioCuota({
        email: cliente.email,
        nombre: formatNombre(cliente),
        numeroCuota: cuota.numero_cuota,
        totalCuotas: credito.numero_cuotas,
        monto: cuota.monto_total_cuota,
        fechaVencimiento: cuota.fecha_vencimiento,
        creditoId: credito.id_credito,
      })
      await registrarNotificacionCliente({
        idCliente: credito.id_cliente,
        codigoTipo: 'RECORDATORIO_PAGO',
        destinatario: cliente.email,
        asunto: `Cuota #${cuota.numero_cuota} vence en 3 días`,
        cuerpo: `Recordatorio de pago por ${cuota.monto_total_cuota}`,
        idCredito: credito.id_credito,
      })
      resumen.recordatorios++
    } catch (e) {
      resumen.errores.push(e.message)
    }
  }

  return NextResponse.json({ ok: true, resumen })
}

export async function POST(request) {
  return GET(request)
}
