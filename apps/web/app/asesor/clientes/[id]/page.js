/* ==========================================================================
 * ARCHIVO: page.js
 * RUTA: apps/web/app/asesor/clientes/[id]/page.js
 * DESCRIPCIÓN: Ficha de cliente (ASESOR). Solo información, sin panel de cliente.
 *              RLS limita al asesor a sus clientes asignados. El asesor no puede
 *              cambiar el celular (puedeEditarCelular=false).
 * ========================================================================== */
import FichaClienteStaff from '@/components/cliente/FichaClienteStaff'

export const dynamic = 'force-dynamic'

export default async function AsesorDetalleClientePage({ params }) {
  const { id } = await params
  return <FichaClienteStaff clienteId={id} backHref="/asesor/clientes" puedeEditarCelular={false} />
}
