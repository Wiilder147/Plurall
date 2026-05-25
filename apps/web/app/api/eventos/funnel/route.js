/* ==========================================================================
 * ARCHIVO: route.js
 * RUTA: apps/web/app/api/eventos/funnel/route.js
 * DESCRIPCIÓN: Endpoint de API (Backend) para manejar la lógica de funnel
 * FUNCIONALIDAD: Este archivo define la lógica y estructura para su respectivo módulo.
 * ========================================================================== */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/eventos/funnel
 * Body: { evento: string, metadata?: object, id_solicitud?: string }
 *
 * Receptor de eventos del embudo de conversión.
 * Fire-and-forget desde el frontend — no bloquea la UX.
 * Requiere sesión de usuario autenticado.
 */
export async function POST(request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // Solo usuarios autenticados pueden registrar eventos
    if (!user) {
      return NextResponse.json({ ok: false }, { status: 401 })
    }

    const body = await request.json()
    const { evento, metadata = {}, id_solicitud = null } = body

    if (!evento || typeof evento !== 'string') {
      return NextResponse.json({ error: 'evento requerido' }, { status: 400 })
    }

    // Insertar el evento — usamos service role para evitar problemas de RLS en insert
    const { error } = await supabase.from('evento_funnel').insert({
      id_usuario:   user.id,
      id_solicitud: id_solicitud || null,
      evento:       evento.toUpperCase(),
      metadata:     metadata,
    })

    if (error) {
      // No lanzamos error al cliente — es fire-and-forget
      console.error('[Funnel]', evento, error.message)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[Funnel] Error inesperado:', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}

/**
 * GET /api/eventos/funnel
 * Devuelve resumen del embudo agrupado por evento.
 * Solo accesible para supervisores/admin.
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    // Verificar rol
    const { data: perfil } = await supabase
      .from('perfil_usuario')
      .select('rol ( nombre_rol )')
      .eq('id', user.id)
      .single()

    const rol = perfil?.rol?.nombre_rol?.toUpperCase()
    if (!['ADMIN', 'ANALISTA', 'SUPERVISOR'].includes(rol)) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
    }

    // Conteo agrupado por evento
    const { data: eventos } = await supabase
      .from('evento_funnel')
      .select('evento, id_evento')

    if (!eventos) return NextResponse.json({ pasos: [] })

    // Orden del funnel
    const ORDEN_FUNNEL = [
      'INICIO_CALCULADORA',
      'AJUSTO_MONTO',
      'INICIO_CUESTIONARIO',
      'COMPLETO_CUESTIONARIO',
      'INICIO_DOCUMENTOS',
      'SUBIO_CEDULA_FRONTAL',
      'SUBIO_CEDULA_TRASERA',
      'INICIO_RESUMEN',
      'ENVIO_SOLICITUD',
      'SOLICITUD_APROBADA',
      'SOLICITUD_REVISION',
      'SOLICITUD_RECHAZADA',
    ]

    const conteo = {}
    for (const e of eventos) {
      conteo[e.evento] = (conteo[e.evento] || 0) + 1
    }

    const pasos = ORDEN_FUNNEL.map(key => ({
      evento:   key,
      cantidad: conteo[key] || 0,
      label:    key.replace(/_/g, ' ').toLowerCase()
        .replace(/^\w/, c => c.toUpperCase()),
    }))

    // Usuarios bloqueados
    const bloqueados = {
      credito_activo: conteo['BLOQUEADO_CREDITO_ACTIVO'] || 0,
      cooldown_90:    conteo['BLOQUEADO_COOLDOWN_90'] || 0,
    }

    return NextResponse.json({ pasos, bloqueados, total: eventos.length })
  } catch (err) {
    console.error('[Funnel GET] Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
