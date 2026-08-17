/* ==========================================================================
 * ARCHIVO: route.js
 * RUTA: apps/web/app/api/perfil/route.js
 * DESCRIPCIÓN: Endpoint de API (Backend) para manejar la lógica de perfil
 * FUNCIONALIDAD: Este archivo define la lógica y estructura para su respectivo módulo.
 * ========================================================================== */
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'

/**
 * PATCH /api/perfil
 * Actualiza los datos editables del cliente autenticado.
 * Campos permitidos: telefono, direccion, ciudad, departamento,
 *                    nombre_negocio, descripcion_negocio, antiguedad_negocio_meses
 * Campos NO editables por el cliente: dni, email, score_credito, estado
 */
export async function PATCH(request) {
  const supabase = await createClient()

  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const body = await request.json()

  // ── Whitelist de campos editables ────────────────────────────
  const CAMPOS_PERMITIDOS = [
    'telefono',
    'direccion',
    'ciudad',
    'departamento',
    'nombre_negocio',
    'descripcion_negocio',
    'antiguedad_negocio_meses',
  ]

  const actualizacion = {}
  for (const campo of CAMPOS_PERMITIDOS) {
    if (body[campo] !== undefined) {
      actualizacion[campo] = body[campo] === '' ? null : body[campo]
    }
  }

  if (Object.keys(actualizacion).length === 0) {
    return NextResponse.json({ error: 'No hay campos válidos para actualizar' }, { status: 400 })
  }

  // ── Validar teléfono si viene en el body ─────────────────────
  if (actualizacion.telefono) {
    const telLimpio = String(actualizacion.telefono).replace(/\D/g, '')
    if (telLimpio.length !== 10) {
      return NextResponse.json({ error: 'El teléfono debe tener exactamente 10 dígitos' }, { status: 422 })
    }
    actualizacion.telefono = telLimpio
  }

  // ── Obtener id_cliente del usuario ───────────────────────────
  const { data: clienteRow, error: cliErr } = await supabase
    .from('cliente')
    .select('id_cliente')
    .eq('id_usuario_cuenta', user.id)
    .single()

  if (cliErr || !clienteRow) {
    return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
  }

  // ── Actualizar cliente ───────────────────────────────────────
  // Dual-write (fase EXPAND de la normalización): seguimos escribiendo las
  // columnas legacy de `cliente` Y espejamos negocio/ubicación a las tablas
  // normalizadas (`negocio_cliente`, `direccion`). El DROP de las columnas
  // legacy llega en la migración 26 (CONTRACT), cuando ya nadie las lea.
  const { data: clienteActualizado, error: updateErr } = await supabase
    .from('cliente')
    .update({ ...actualizacion, updated_at: new Date().toISOString() })
    .eq('id_cliente', clienteRow.id_cliente)
    .select('telefono, direccion, ciudad, departamento, nombre_negocio, descripcion_negocio, antiguedad_negocio_meses')
    .single()

  if (updateErr) {
    console.error('[Perfil] Error al actualizar:', updateErr)
    return NextResponse.json({ error: 'Error al guardar los cambios' }, { status: 500 })
  }

  // ── Espejo a tablas normalizadas (best-effort, no rompe el guardado) ──
  const idCliente = clienteRow.id_cliente
  const tocaNegocio = ['nombre_negocio', 'descripcion_negocio', 'antiguedad_negocio_meses']
    .some((c) => c in actualizacion)
  const tocaUbicacion = ['direccion', 'ciudad', 'departamento'].some((c) => c in actualizacion)

  try {
    if (tocaNegocio) {
      const negocioPatch = {
        nombre_negocio: clienteActualizado.nombre_negocio,
        descripcion: clienteActualizado.descripcion_negocio,
        antiguedad_meses: clienteActualizado.antiguedad_negocio_meses,
      }
      // negocio_cliente es 1:N (sin UNIQUE): actualiza el negocio existente o crea el primero.
      const { data: negocioExistente } = await supabase
        .from('negocio_cliente')
        .select('id_negocio')
        .eq('id_cliente', idCliente)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()

      if (negocioExistente) {
        await supabase.from('negocio_cliente')
          .update(negocioPatch)
          .eq('id_negocio', negocioExistente.id_negocio)
      } else if (negocioPatch.nombre_negocio) {
        await supabase.from('negocio_cliente')
          .insert({ id_cliente: idCliente, ...negocioPatch })
      }
    }

    if (tocaUbicacion) {
      // `direccion` guarda una línea de texto libre (dirección, ciudad, departamento)
      // + FK municipio (pendiente de mapear). Una fila NEGOCIO por cliente (UNIQUE).
      const linea = [clienteActualizado.direccion, clienteActualizado.ciudad, clienteActualizado.departamento]
        .map((s) => (s ? String(s).trim() : ''))
        .filter(Boolean)
        .join(', ') || null
      await supabase.from('direccion')
        .upsert({ id_cliente: idCliente, tipo: 'NEGOCIO', linea }, { onConflict: 'id_cliente,tipo' })
    }
  } catch (espejoErr) {
    // No abortar el guardado del cliente si el espejo falla; queda log para reparar.
    console.error('[Perfil] Error al espejar a tablas normalizadas:', espejoErr)
  }

  return NextResponse.json({ ok: true, data: clienteActualizado })
}

/**
 * DELETE /api/perfil
 * Elimina permanentemente la cuenta del usuario autenticado.
 * Regla de negocio: bloquea la eliminación si tiene un crédito activo o en mora.
 * Usa el SERVICE_ROLE_KEY para poder llamar a auth.admin.deleteUser().
 */
export async function DELETE() {
  const supabase = await createClient()

  // ── 1. Verificar sesión activa ────────────────────────────────
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  // ── 2. Verificar que no tenga créditos activos ────────────────
  const { data: clienteRow } = await supabase
    .from('cliente')
    .select('id_cliente')
    .eq('id_usuario_cuenta', user.id)
    .single()

  if (clienteRow) {
    const { count } = await supabase
      .from('credito')
      .select('*', { count: 'exact', head: true })
      .eq('id_cliente', clienteRow.id_cliente)
      .in('estado_credito', ['ACTIVO', 'EN_MORA'])

    if (count > 0) {
      return NextResponse.json(
        { error: 'No puedes eliminar tu cuenta mientras tengas un crédito activo o en mora.' },
        { status: 409 }
      )
    }
  }

  // ── 3. Eliminar el usuario con permisos de administrador ──────
  const serviceClient = createServiceClient()
  const { error: deleteErr } = await serviceClient.auth.admin.deleteUser(user.id)

  if (deleteErr) {
    console.error('[Perfil] Error al eliminar usuario:', deleteErr)
    return NextResponse.json({ error: 'No se pudo eliminar la cuenta. Intenta más tarde.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
