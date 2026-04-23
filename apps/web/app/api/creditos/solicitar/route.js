import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// MOCK DE EXPERIAN (Generador pseudo-aleatorio de riesgo crediticio)
function consultarExperian(dni) {
  // En la vida real aquí haríamos fetch a https://api.experian.com/...
  // Usaremos la longitud o un hash simple del DNI para asegurar un resultado "consistente" en demos
  const factor = Number(dni.substring(dni.length - 2) || '50')
  
  if (factor < 20) {
    return { score: 450, dictamen: 'RECHAZAR', motivo: 'Historial crediticio negativo en Datacrédito' }
  } else if (factor < 60) {
    return { score: 650, dictamen: 'REVISION_MANUAL', motivo: 'Capacidad de endeudamiento al límite' }
  } else {
    return { score: 850, dictamen: 'PRE_APROBADO', motivo: 'Excelente historial crediticio' }
  }
}

export async function POST(request) {
  try {
    const body = await request.json()
    const { monto, plazo, frontUrl, backUrl } = body

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // 1. OBTENER DATOS DEL CLIENTE
    const { data: cliente, error: cliErr } = await supabase
      .from('cliente')
      .select('id_cliente, dni')
      .eq('id_cliente', user.id)
      .single()

    if (cliErr) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })

    // 2.A VALIDAR CRÉDITO ÚNICO ACTIVO (Ninguna deuda vigente)
    const { data: creditoVigente } = await supabase
      .from('credito')
      .select('id_credito, saldo_pendiente')
      .eq('id_cliente', cliente.id_cliente)
      .gt('saldo_pendiente', 0)
      .limit(1)
      .single()

    if (creditoVigente) {
      return NextResponse.json({ 
        error: 'CREDITO_ACTIVO', 
        message: 'No puedes solicitar un nuevo crédito mientras mantengas saldo pendiente en un crédito activo.' 
      }, { status: 403 })
    }

    // 2.B VALIDAR REGLA TRIMESTRAL (Backend Fallback en caso de evadir UI)
    const { data: lastRequest } = await supabase
      .from('solicitud_credito')
      .select('fecha_solicitud')
      .eq('id_cliente', cliente.id_cliente)
      .order('fecha_solicitud', { ascending: false })
      .limit(1)
      .single()

    if (lastRequest) {
      const msDia = 1000 * 60 * 60 * 24
      const diffDias = (new Date() - new Date(lastRequest.fecha_solicitud)) / msDia
      if (diffDias < 90) {
        return NextResponse.json({ 
          error: 'BLOQUEO_TRIMESTRAL', 
          message: `Debes esperar ${Math.ceil(90 - diffDias)} días antes de volver a solicitar.` 
        }, { status: 403 })
      }
    }

    // 3. CONSUMO DEL BURÓ DE CRÉDITO (EXPERIAN MOCK)
    const experian = consultarExperian(cliente.dni)
    let estadoNombre = 'PENDIENTE' 
    let rechazoMotivo = null

    if (experian.dictamen === 'RECHAZAR') {
      estadoNombre = 'RECHAZADA'
      rechazoMotivo = experian.motivo
    }

    // 4. TRANSACCIÓN DIRECTA SEGURO EN BD
    // Buscar uuids
    const { data: estQ } = await supabase.from('estado_solicitud').select('id_estado_solicitud').eq('nombre', estadoNombre).single()
    const idEstado = estQ?.id_estado_solicitud
    
    let idMotivo = null
    if (rechazoMotivo) {
        // Buscamos si existe o inyectamos uno genérico (o buscamos por Like)
        const { data: motQ } = await supabase.from('motivo_rechazo').select('id_motivo').ilike('descripcion_motivo', '%Historial%').limit(1).single()
        idMotivo = motQ?.id_motivo || null
    }

    // Inyectamos documentos a BD paralela 
    await supabase.from('documento_cliente').upsert([
      { id_cliente: cliente.id_cliente, tipo_documento: 'CEDULA_FRONTAL', url_archivo: frontUrl },
      { id_cliente: cliente.id_cliente, tipo_documento: 'CEDULA_TRASERA', url_archivo: backUrl }
    ])

    const { data: newSolicitud, error: insErr } = await supabase.from('solicitud_credito').insert({
      id_cliente: cliente.id_cliente,
      id_estado_solicitud: idEstado,
      id_motivo_rechazo: idMotivo,
      monto_solicitado: monto,
      plazo_meses: plazo,
      proposito: `Perfilamiento Auto Experian: ${experian.score} pts`,
      canal_solicitud: 'WEB'
    }).select().single()

    if (insErr) throw insErr

    return NextResponse.json({ 
      success: true, 
      resultado_buro: experian.dictamen,
      score: experian.score
    })

  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
