import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: perfil } = await supabase.from('perfil_usuario').select('rol(nombre_rol)').eq('id', user.id).single()
  if (perfil?.rol?.nombre_rol?.toUpperCase() !== 'ADMIN') {
    return NextResponse.json({ error: 'Solo admin' }, { status: 403 })
  }

  const svc = createServiceClient()
  const hoy = new Date().toISOString().split('T')[0]

  const [
    { count: cuotasVencidasHoy },
    { count: pagosHoy },
    { count: solicitudesHoy },
    { data: ultimoCronMora },
    { count: notifsPendientes },
    { count: webhooksRecientes },
  ] = await Promise.all([
    svc.from('cuota').select('*', { count: 'exact', head: true }).eq('estado_cuota', 'VENCIDA'),
    svc.from('pago').select('*', { count: 'exact', head: true }).gte('fecha_pago', `${hoy}T00:00:00`),
    svc.from('solicitud_credito').select('*', { count: 'exact', head: true }).gte('fecha_solicitud', `${hoy}T00:00:00`),
    svc.from('auditoria').select('fecha_evento').order('fecha_evento', { ascending: false }).limit(1).maybeSingle(),
    svc.from('notificacion').select('*', { count: 'exact', head: true }).eq('estado_envio', 'PENDIENTE'),
    svc.from('pago').select('*', { count: 'exact', head: true }).not('referencia_wompi', 'is', null).gte('fecha_pago', `${hoy}T00:00:00`),
  ])

  return NextResponse.json({
    ok: true,
    servicios: {
      supabase: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      resend: !!process.env.RESEND_API_KEY,
      wompi: !!process.env.NEXT_PUBLIC_WOMPI_PUBLIC_KEY,
      cron: !!process.env.CRON_SECRET,
      sentry: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
      upstash: !!process.env.UPSTASH_REDIS_REST_URL,
    },
    metricas: {
      cuotasVencidas: cuotasVencidasHoy ?? 0,
      pagosHoy: pagosHoy ?? 0,
      solicitudesHoy: solicitudesHoy ?? 0,
      notificacionesPendientes: notifsPendientes ?? 0,
      pagosWompiHoy: webhooksRecientes ?? 0,
      ultimaAuditoria: ultimoCronMora?.fecha_evento ?? null,
    },
    timestamp: new Date().toISOString(),
  })
}
