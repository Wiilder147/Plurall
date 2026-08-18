/* ==========================================================================
 * ARCHIVO: celular.js
 * RUTA: apps/web/lib/celular.js
 * DESCRIPCIÓN: Lógica compartida del cambio de celular de un cliente (server).
 * FUNCIONALIDAD: El celular es la identidad de acceso ({celular}@plurall.app).
 *                Al cambiarlo: registra el número anterior en historial_celular,
 *                actualiza el email de acceso en Auth (el número viejo deja de
 *                servir) y el teléfono del cliente. También detecta reúso de un
 *                número que ya tuvo otro cliente (para alertar al staff).
 * ========================================================================== */
import { crearNotificacionStaff } from '@/lib/notificacionesInApp'
import { formatNombre } from '@/lib/nombre'

/**
 * Consulta si el número ya fue usado por OTRO cliente. Devuelve la info del
 * cliente anterior o null.
 */
export async function alertaReusoCelular(service, nuevoCelular, idClienteActual) {
  const { data } = await service.rpc('celular_usado_antes', {
    cel: nuevoCelular,
    cliente_actual: idClienteActual ?? null,
  })
  const anterior = Array.isArray(data) ? data[0] : data
  if (!anterior?.id_cliente) return null
  return {
    idCliente:     anterior.id_cliente,
    nombre:        formatNombre(anterior),
    fechaLiberado: anterior.fecha_liberado,
  }
}

/**
 * Aplica el cambio de celular de un cliente.
 * @param service  cliente Supabase service role
 * @param opts.cliente       { id_cliente, id_usuario_cuenta, telefono }
 * @param opts.nuevoCelular  10 dígitos
 * @param opts.liberadoPor   id del staff que hace el cambio, o null si es el cliente
 * @param opts.motivo        texto
 * @returns { error, status } o { ok, celular, reuso }
 */
export async function aplicarCambioCelular(service, { cliente, nuevoCelular, liberadoPor = null, motivo = null }) {
  const cel = String(nuevoCelular || '').replace(/\D/g, '')
  if (cel.length !== 10) return { error: 'El celular debe tener 10 dígitos', status: 422 }
  if (cel === cliente.telefono) return { error: 'El número nuevo es igual al actual', status: 400 }

  const nuevoEmail = `${cel}@plurall.app`

  // Detectar reúso (informativo; no bloquea el cambio).
  const reuso = await alertaReusoCelular(service, cel, cliente.id_cliente)

  // 1. Cambiar la identidad de acceso en Auth (el número viejo deja de servir).
  if (cliente.id_usuario_cuenta) {
    const { error: authErr } = await service.auth.admin.updateUserById(cliente.id_usuario_cuenta, {
      email: nuevoEmail,
      email_confirm: true,
    })
    if (authErr) {
      const msg = authErr.message?.toLowerCase() || ''
      if (msg.includes('already') || msg.includes('exists') || msg.includes('registered')) {
        return { error: 'Ese celular ya está registrado en otra cuenta activa', status: 409 }
      }
      console.error('[Cambiar celular auth]', authErr)
      return { error: 'No se pudo actualizar el acceso del cliente', status: 500 }
    }
  }

  // 2. Registrar el número ANTERIOR en el historial de liberados.
  if (cliente.telefono) {
    await service.from('historial_celular').insert({
      celular:      cliente.telefono,
      id_cliente:   cliente.id_cliente,
      liberado_por: liberadoPor,
      motivo:       motivo ?? 'Cambio de celular',
    }).then(() => null, () => null)
  }

  // 3. Actualizar teléfono + email de contacto del cliente.
  const { error: updErr } = await service
    .from('cliente')
    .update({ telefono: cel, email: nuevoEmail, updated_at: new Date().toISOString() })
    .eq('id_cliente', cliente.id_cliente)
  if (updErr) {
    console.error('[Cambiar celular cliente]', updErr)
    return { error: 'No se pudo actualizar el teléfono', status: 500 }
  }

  // 4. Si hubo reúso, alertar al staff (admin/supervisor + asesor asignado).
  if (reuso) {
    try {
      const { data: rolAdmSup } = await service
        .from('rol').select('id_rol, nombre_rol').in('nombre_rol', ['ADMIN', 'SUPERVISOR'])
      const ids = (rolAdmSup ?? []).map(r => r.id_rol)
      if (ids.length) {
        const { data: staff } = await service.from('perfil_usuario').select('id').in('id_rol', ids).eq('activo', true)
        for (const s of staff ?? []) {
          await crearNotificacionStaff({
            idUsuario: s.id,
            codigoTipo: 'CELULAR_REUSO',
            titulo: 'Número reutilizado',
            mensaje: `El número ${cel} ya había sido usado por ${reuso.nombre}.`,
            metadata: { celular: cel, clienteAnterior: reuso.idCliente },
          }).catch(() => null)
        }
      }
    } catch { /* no bloquear el cambio si la alerta falla */ }
  }

  return { ok: true, celular: cel, reuso }
}
