/* ==========================================================================
 * ARCHIVO: page.js
 * RUTA: apps/web/app/admin/clientes/[id]/page.js
 * DESCRIPCIÓN: Ficha de cliente (ADMIN). Solo información, sin panel de cliente.
 * ========================================================================== */
import FichaClienteStaff from '@/components/cliente/FichaClienteStaff'

export const dynamic = 'force-dynamic'

export default async function AdminDetalleClientePage({ params }) {
  const { id } = await params
  return <FichaClienteStaff clienteId={id} backHref="/admin/clientes" puedeEditarCelular />
}
