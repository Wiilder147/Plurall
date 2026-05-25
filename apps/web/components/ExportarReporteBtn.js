'use client'

/* ==========================================================================
 * ARCHIVO: ExportarReporteBtn.js
 * RUTA: apps/web/components/ExportarReporteBtn.js
 * DESCRIPCIÓN: Componente de interfaz de usuario (UI) reutilizable.
 * FUNCIONALIDAD: Este archivo define la lógica y estructura para su respectivo módulo.
 * ========================================================================== */

import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'

/**
 * Botón de descarga de reporte CSV.
 * Hace un GET a /api/reportes/export?tipo=X y descarga el archivo.
 */
export default function ExportarReporteBtn({ tipo, label, acento = false }) {
  const [descargando, setDescargando] = useState(false)

  async function handleDescargar() {
    setDescargando(true)
    try {
      const res = await fetch(`/api/reportes/export?tipo=${tipo}`)
      if (!res.ok) {
        const err = await res.json()
        alert(err.error || 'Error al generar el reporte')
        return
      }
      // Obtener el nombre del archivo del header Content-Disposition
      const disposition = res.headers.get('Content-Disposition') || ''
      const match = disposition.match(/filename="(.+)"/)
      const filename = match?.[1] || `plurall_${tipo}.csv`

      // Crear blob y disparar descarga
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      alert('Error de conexión al descargar el reporte.')
    } finally {
      setDescargando(false)
    }
  }

  return (
    <button
      onClick={handleDescargar}
      disabled={descargando}
      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-60 ${
        acento
          ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20'
          : 'bg-slate-700 text-slate-300 hover:bg-slate-600 border border-slate-600'
      }`}
    >
      {descargando
        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
        : <Download className="w-3.5 h-3.5" />
      }
      {label}
    </button>
  )
}
