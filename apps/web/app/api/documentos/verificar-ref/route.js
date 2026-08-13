import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { docRef } from '@/lib/documentosLegal'
import { formatNombre } from '@/lib/nombre'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const ref = searchParams.get('ref')
  const creditoId = searchParams.get('credito')
  const tipo = searchParams.get('tipo')

  if (!ref || !creditoId) {
    return NextResponse.json({ valido: false, error: 'Parámetros incompletos' }, { status: 400 })
  }

  if (docRef(creditoId) !== ref.toUpperCase()) {
    return NextResponse.json({ valido: false, error: 'Referencia no coincide' }, { status: 404 })
  }

  const supabase = createServiceClient()
  const { data: credito } = await supabase
    .from('credito')
    .select('id_credito, estado_credito, cliente ( primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, dni)')
    .eq('id_credito', creditoId)
    .single()

  if (!credito) {
    return NextResponse.json({ valido: false, error: 'Crédito no encontrado' }, { status: 404 })
  }

  return NextResponse.json({
    valido: true,
    ref,
    tipo: tipo || 'documento',
    credito: credito.id_credito,
    titular: formatNombre(credito.cliente),
    dni: credito.cliente?.dni,
    estado: credito.estado_credito,
    verificado_at: new Date().toISOString(),
    emisor: 'PLURALL S.A.S.',
  })
}
