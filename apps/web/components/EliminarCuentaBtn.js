'use client'

/* ==========================================================================
 * ARCHIVO: EliminarCuentaBtn.js
 * RUTA: apps/web/components/EliminarCuentaBtn.js
 * DESCRIPCIÓN: Botón de eliminación de cuenta con modal de confirmación.
 * FUNCIONALIDAD: Llama a DELETE /api/perfil. Bloquea si hay crédito activo.
 *                Requiere que el usuario escriba "ELIMINAR" para confirmar.
 * ========================================================================== */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, AlertTriangle, X, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function EliminarCuentaBtn({ tieneCreditoActivo = false }) {
  const router = useRouter()
  const [modalAbierto, setModalAbierto] = useState(false)
  const [confirmacion, setConfirmacion]   = useState('')
  const [loading, setLoading]             = useState(false)
  const [error, setError]                 = useState('')

  function abrirModal() {
    if (tieneCreditoActivo) return // bloqueado: no abrir si hay crédito activo
    setConfirmacion('')
    setError('')
    setModalAbierto(true)
  }

  function cerrarModal() {
    if (loading) return
    setModalAbierto(false)
    setConfirmacion('')
    setError('')
  }

  async function handleEliminar() {
    if (confirmacion !== 'ELIMINAR') return
    setLoading(true)
    setError('')

    try {
      const res  = await fetch('/api/perfil', { method: 'DELETE' })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'No se pudo eliminar la cuenta.')
        setLoading(false)
        return
      }

      // Cerrar sesión en el cliente y redirigir al inicio
      const supabase = createClient()
      await supabase.auth.signOut()
      router.push('/?cuenta=eliminada')
      router.refresh()
    } catch {
      setError('Error de conexión. Intenta nuevamente.')
      setLoading(false)
    }
  }

  const puedeConfirmar = confirmacion === 'ELIMINAR' && !loading

  return (
    <>
      {/* ── BOTÓN DISPARADOR ──
          COLOR DE FONDO: bg-red-50 (rojo muy claro)
          BORDE: border border-red-200 (rojo claro)
          COLOR TEXTO: text-red-600 (rojo medio)
          HOVER: hover:bg-red-100 (rojo un poco más intenso)
          PADDING: px-5 py-2.5 (20px horizontal, 10px vertical)
          BORDES: rounded-xl (12px)
          TAMAÑO FUENTE: text-sm (14px), font-semibold
          ÍCONO: w-4 h-4 (16x16px) */}
      <button
        onClick={abrirModal}
        disabled={tieneCreditoActivo}
        title={tieneCreditoActivo ? 'No disponible mientras tengas un crédito activo o en mora' : undefined}
        className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors ${
          tieneCreditoActivo
            ? 'bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed'
            : 'bg-red-50 border border-red-200 text-red-600 hover:bg-red-100'
        }`}
      >
        <Trash2 className="w-4 h-4" />
        Eliminar mi cuenta
      </button>
      {tieneCreditoActivo && (
        <p className="text-xs text-slate-500 mt-2 flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
          No puedes eliminar tu cuenta mientras tengas un crédito activo o en mora.
        </p>
      )}

      {/* ── MODAL DE CONFIRMACIÓN (visible solo cuando modalAbierto = true) ── */}
      {modalAbierto && (
        // OVERLAY OSCURO
        // COLOR: bg-black/50 (negro 50% opacidad)
        // POSICIÓN: fixed inset-0 (cubre toda la pantalla)
        // Z-INDEX: z-[200] (encima de todo)
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">

          {/* TARJETA DEL MODAL
              COLOR FONDO: bg-white (blanco)
              BORDES: rounded-2xl (16px), SOMBRA: shadow-2xl (grande)
              ANCHO MÁXIMO: max-w-md (448px)
              ANCHO: w-full (100% hasta el máximo) */}
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">

            {/* ── ENCABEZADO DEL MODAL ──
                COLOR FONDO: bg-red-50 (rojo muy claro)
                BORDE INFERIOR: border-b border-red-100
                PADDING: px-6 py-5 (24px horizontal, 20px vertical)
                BORDES SUPERIORES: rounded-t-2xl */}
            <div className="bg-red-50 border-b border-red-100 px-6 py-5 rounded-t-2xl flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                {/* ÍCONO ADVERTENCIA
                    CÍRCULO: w-10 h-10 (40x40px), bg-red-100 (rojo claro)
                    ÍCONO: w-5 h-5 (20x20px), text-red-600 (rojo) */}
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  {/* TÍTULO — text-base (16px), font-bold, text-red-900 */}
                  <h2 className="text-base font-bold text-red-900">¿Eliminar tu cuenta?</h2>
                  {/* SUBTÍTULO — text-xs (12px), text-red-600 */}
                  <p className="text-xs text-red-600 mt-0.5">Esta acción es permanente e irreversible</p>
                </div>
              </div>
              {/* BOTÓN CERRAR — w-8 h-8 (32x32px), bg-white, rounded-full
                  COLOR ÍCONO: text-slate-400, hover:text-slate-600 */}
              <button
                onClick={cerrarModal}
                disabled={loading}
                className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors shrink-0 border border-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* ── CUERPO DEL MODAL ──
                PADDING: px-6 py-5 */}
            <div className="px-6 py-5 space-y-4">

              {/* LISTA DE ADVERTENCIAS
                  COLOR FONDO: bg-slate-50, BORDE: border border-slate-200
                  BORDES: rounded-xl (12px), PADDING: p-4 (16px) */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                {/* TÍTULO — text-xs (12px), font-semibold, text-slate-500, uppercase */}
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Se eliminará permanentemente:</p>
                {[
                  'Tu cuenta de acceso y contraseña',
                  'Todos tus datos personales',
                  'Tu historial de solicitudes',
                  'Tus documentos de identidad (KYC)',
                ].map((item) => (
                  // ÍTEM — text-sm (14px), text-slate-600
                  // PUNTO ROJO — w-1.5 h-1.5 (6x6px), bg-red-400, rounded-full
                  <div key={item} className="flex items-center gap-2 text-sm text-slate-600">
                    <div className="w-1.5 h-1.5 bg-red-400 rounded-full shrink-0" />
                    {item}
                  </div>
                ))}
              </div>

              {/* CAMPO DE CONFIRMACIÓN
                  Instrucción — text-sm (14px), text-slate-700
                  "ELIMINAR" en negrita para claridad */}
              <div>
                <label className="block text-sm text-slate-700 mb-2">
                  Para confirmar, escribe <strong className="text-red-600">ELIMINAR</strong>:
                </label>
                {/* INPUT — borde rojo cuando no coincide, verde cuando coincide
                    BORDE CORRECTO: border-emerald-400 (verde)
                    BORDE INCORRECTO: border-slate-300 (gris)
                    PADDING: px-4 py-2.5, BORDES: rounded-xl (12px)
                    TAMAÑO: text-sm (14px), tracking-widest (letras separadas) */}
                <input
                  type="text"
                  value={confirmacion}
                  onChange={(e) => { setConfirmacion(e.target.value.toUpperCase()); setError('') }}
                  placeholder="ELIMINAR"
                  disabled={loading}
                  className={`w-full px-4 py-2.5 rounded-xl border text-sm font-bold tracking-widest transition-colors focus:outline-none focus:ring-2 ${
                    confirmacion === 'ELIMINAR'
                      ? 'border-emerald-400 focus:ring-emerald-300 text-emerald-700'
                      : 'border-slate-300 focus:ring-red-300 text-slate-900'
                  }`}
                />
              </div>

              {/* MENSAJE DE ERROR (visible si hay error del servidor)
                  COLOR FONDO: bg-red-50, BORDE: border border-red-200
                  COLOR TEXTO: text-red-700, text-sm (14px)
                  PADDING: px-4 py-3, BORDES: rounded-xl */}
              {error && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <p>{error}</p>
                </div>
              )}
            </div>

            {/* ── PIE DEL MODAL: BOTONES ──
                BORDE SUPERIOR: border-t border-slate-100
                PADDING: px-6 py-4, ESPACIO: gap-3 */}
            <div className="px-6 py-4 border-t border-slate-100 flex gap-3 justify-end">

              {/* BOTÓN "Cancelar"
                  COLOR FONDO: bg-slate-100, hover:bg-slate-200 (gris claro)
                  COLOR TEXTO: text-slate-700
                  PADDING: px-5 py-2.5, BORDES: rounded-xl (12px)
                  TAMAÑO: text-sm (14px) */}
              <button
                onClick={cerrarModal}
                disabled={loading}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold text-sm transition-colors"
              >
                Cancelar
              </button>

              {/* BOTÓN "Sí, eliminar"
                  HABILITADO: bg-red-600 hover:bg-red-700 (rojo oscuro)
                  DESHABILITADO: bg-slate-300 cursor-not-allowed (gris — si no escribió ELIMINAR)
                  COLOR TEXTO: text-white
                  PADDING: px-5 py-2.5, BORDES: rounded-xl (12px)
                  TAMAÑO: text-sm (14px), font-semibold */}
              <button
                onClick={handleEliminar}
                disabled={!puedeConfirmar}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl font-semibold text-sm transition-colors"
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Eliminando…</>
                ) : (
                  <><Trash2 className="w-4 h-4" /> Sí, eliminar</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
