/* ==========================================================================
 * ARCHIVO: route.js
 * RUTA: apps/web/app/api/creditos/solicitar/route.js
 * DESCRIPCIÓN: Endpoint de creación de solicitud de crédito.
 *
 * Toda la lógica de negocio (elegibilidad, validación de monto/plazo,
 * scoring por opciones y por rangos numéricos, estado final y documentos)
 * vive en la función Postgres `fn_crear_solicitud_completa`
 * (db/13_rpc_solicitud_atomica.sql). Esto garantiza que la solicitud se
 * crea de forma ATÓMICA: si algo falla, no quedan registros a medias.
 *
 * Regla clave: sin cuestionario nunca se pre-aprueba automáticamente —
 * la solicitud queda en revisión manual.
 * ========================================================================== */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { notificarSolicitudRecibida } from '@/lib/notificaciones'

// Códigos de negocio devueltos por la RPC → status HTTP
const STATUS_POR_ERROR = {
  CLIENTE_NO_ENCONTRADO:        404,
  CREDITO_ACTIVO:               403,
  BLOQUEO_TRIMESTRAL:           403,
  MONTO_INVALIDO:               400,
  PLAZO_INVALIDO:               400,
  RESPUESTA_NUMERICA_INVALIDA:  400,
}

export async function POST(request) {
  try {
    // IP del solicitante (compatible con proxies y CDN)
    const ip = (
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip') ??
      request.headers.get('cf-connecting-ip') ??
      null
    )

    const body = await request.json()
    // respuestas: [{ id_pregunta, id_opcion?, respuesta_texto?, respuesta_numerica? }]
    // extraDocs:  [{ tipo, url, mime?, tamanio? }]
    const { monto, plazo, frontUrl, backUrl, respuestas = [], extraDocs = [] } = body

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Consolidar documentos KYC + soportes adicionales
    const docs = []
    if (frontUrl) docs.push({ tipo: 'CEDULA_FRONTAL', url: frontUrl })
    if (backUrl)  docs.push({ tipo: 'CEDULA_TRASERA', url: backUrl })
    for (const d of (Array.isArray(extraDocs) ? extraDocs : []).slice(0, 10)) {
      if (d?.url && typeof d.url === 'string') {
        docs.push({ tipo: d.tipo, url: d.url, mime: d.mime ?? null, tamanio: d.tamanio ?? null })
      }
    }

    // Creación atómica en Postgres
    const { data, error } = await supabase.rpc('fn_crear_solicitud_completa', {
      p_monto:      monto,
      p_plazo:      plazo,
      p_respuestas: respuestas,
      p_docs:       docs,
      p_ip:         ip,
    })

    if (error) throw error

    if (data?.error) {
      return NextResponse.json(
        { error: data.error, message: data.message },
        { status: STATUS_POR_ERROR[data.error] ?? 400 },
      )
    }

    // Notificación por email — fuera de la transacción, no bloquea la respuesta
    if (data.resultado_buro !== 'RECHAZAR') {
      const { data: cliente } = await supabase
        .from('cliente')
        .select('nombre_completo, email')
        .eq('id_usuario_cuenta', user.id)
        .single()

      if (cliente?.email) {
        notificarSolicitudRecibida({
          email:       cliente.email,
          nombre:      cliente.nombre_completo,
          solicitudId: data.solicitudId,
          monto,
          plazo,
        }).catch(err => console.error('[Notif] Error email solicitud:', err))
      }
    }

    return NextResponse.json(data)

  } catch (error) {
    console.error('[API solicitar] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
