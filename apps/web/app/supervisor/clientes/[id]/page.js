/* ==========================================================================
 * ARCHIVO: page.js
 * RUTA: apps/web/app/supervisor/clientes/[id]/page.js
 * DESCRIPCIÓN: Ficha de cliente (SUPERVISOR). Solo información, sin panel de cliente.
 * ========================================================================== */
import FichaClienteStaff from '@/components/cliente/FichaClienteStaff'

export const dynamic = 'force-dynamic'

export default async function SupervisorDetalleClientePage({ params }) {
  const { id } = await params
  return <FichaClienteStaff clienteId={id} backHref="/supervisor/clientes" puedeEditarCelular />
}
