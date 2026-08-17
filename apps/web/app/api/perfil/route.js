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

  // El form sigue enviando estos nombres de campo; ahora se escriben en el
  // modelo normalizado (no existen ya como columnas de `cliente`).
  const norm = (v) => (v === '' || v === undefined ? null : v)
  const telefonoIn    = body.telefono
  const direccionIn   = norm(body.direccion)
  const ciudadIn      = norm(body.ciudad)
  const departamentoIn = norm(body.departamento)
  const nombreNegocioIn = norm(body.nombre_negocio)
  const descNegocioIn = norm(body.descripcion_negocio)
  const antiguedadIn  = norm(body.antiguedad_negocio_meses)

  const tocaTelefono  = 'telefono' in body
  const tocaNegocio   = ['nombre_negocio', 'descripcion_negocio', 'antiguedad_negocio_meses'].some((c) => c in body)
  const tocaUbicacion = ['direccion', 'ciudad', 'departamento'].some((c) => c in body)

  if (!tocaTelefono && !tocaNegocio && !tocaUbicacion) {
    return NextResponse.json({ error: 'No hay campos válidos para actualizar' }, { status: 400 })
  }

  // ── Validar teléfono ─────────────────────────────────────────
  let telefono
  if (tocaTelefono && telefonoIn) {
    const telLimpio = String(telefonoIn).replace(/\D/g, '')
    if (telLimpio.length !== 10) {
      return NextResponse.json({ error: 'El teléfono debe tener exactamente 10 dígitos' }, { status: 422 })
    }
    telefono = telLimpio
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
  const idCliente = clienteRow.id_cliente

  // ── Identidad: en `cliente` solo vive el teléfono (columnas de negocio/
  //    ubicación/score fueron migradas a las tablas normalizadas, mig. 27) ──
  if (telefono) {
    const { error: updateErr } = await supabase
      .from('cliente')
      .update({ telefono, updated_at: new Date().toISOString() })
      .eq('id_cliente', idCliente)
    if (updateErr) {
      console.error('[Perfil] Error al actualizar teléfono:', updateErr)
      return NextResponse.json({ error: 'Error al guardar los cambios' }, { status: 500 })
    }
  }

  try {
    // ── Negocio → negocio_cliente (1:N: edita el primero o lo crea) ──
    if (tocaNegocio) {
      const negocioPatch = {
        nombre_negocio: nombreNegocioIn,
        descripcion: descNegocioIn,
        antiguedad_meses: antiguedadIn ? parseInt(antiguedadIn) : null,
      }
      const { data: negocioExistente } = await supabase
        .from('negocio_cliente')
        .select('id_negocio')
        .eq('id_cliente', idCliente)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()

      if (negocioExistente) {
        await supabase.from('negocio_cliente').update(negocioPatch).eq('id_negocio', negocioExistente.id_negocio)
      } else if (negocioPatch.nombre_negocio) {
        await supabase.from('negocio_cliente').insert({ id_cliente: idCliente, ...negocioPatch })
      }
    }

    // ── Ubicación → direccion (NEGOCIO). linea = dirección; id_municipio por
    //    lookup de ciudad+departamento contra el catálogo municipio ──
    if (tocaUbicacion) {
      const idMunicipio = await buscarMunicipio(supabase, ciudadIn, departamentoIn)
      await supabase.from('direccion')
        .upsert(
          { id_cliente: idCliente, tipo: 'NEGOCIO', linea: direccionIn, id_municipio: idMunicipio },
          { onConflict: 'id_cliente,tipo' }
        )
    }
  } catch (espejoErr) {
    console.error('[Perfil] Error al guardar negocio/ubicación:', espejoErr)
    return NextResponse.json({ error: 'Error al guardar los cambios' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

/**
 * Resuelve id_municipio a partir de ciudad + departamento (texto del form).
 * Aplica los mismos alias que la migración 26 para los nombres que no calzan
 * 1:1 con el catálogo. Devuelve null si no hay match (id_municipio queda NULL).
 */
async function buscarMunicipio(supabase, ciudad, departamento) {
  if (!ciudad) return null
  const alias = {
    'bogotá': 'Bogotá D.C.', 'bogota': 'Bogotá D.C.',
    'cartagena': 'Cartagena de Indias',
  }
  const ciudadNorm = alias[String(ciudad).trim().toLowerCase()] || String(ciudad).trim()

  // Preferir match por (ciudad, departamento); si falla, por ciudad sola.
  if (departamento) {
    const { data } = await supabase
      .from('municipio')
      .select('id_municipio, departamento!inner ( nombre )')
      .ilike('nombre', ciudadNorm)
      .ilike('departamento.nombre', String(departamento).trim())
      .limit(1)
      .maybeSingle()
    if (data?.id_municipio) return data.id_municipio
  }
  const { data } = await supabase
    .from('municipio')
    .select('id_municipio')
    .ilike('nombre', ciudadNorm)
    .limit(1)
    .maybeSingle()
  return data?.id_municipio ?? null
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
