'use client'

/* ==========================================================================
 * ARCHIVO: AnalyticsSection.js
 * RUTA: apps/web/components/AnalyticsSection.js
 * DESCRIPCIÓN: Envoltura de carga diferida para AnalyticsDashboard.
 * FUNCIONALIDAD: Monta el dashboard de analítica (recharts + consultas) solo
 *                cuando la sección está por entrar en pantalla. Así el panel
 *                pinta de inmediato y la analítica pesada carga al acercarse,
 *                haciendo la navegación mucho más fluida.
 * ========================================================================== */
import { useState, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'

// recharts es pesado: se carga solo al necesitarlo (no entra al bundle inicial).
const AnalyticsDashboard = dynamic(() => import('./AnalyticsDashboard'), { ssr: false })

export default function AnalyticsSection({ accent = 'indigo' }) {
  const [visible, setVisible] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisible(true)
          io.disconnect()
        }
      },
      { rootMargin: '200px' } // empieza a cargar un poco antes de llegar
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div ref={ref}>
      {visible ? (
        <AnalyticsDashboard accent={accent} />
      ) : (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-10 flex items-center justify-center">
          <p className="text-slate-500 text-sm animate-pulse">Cargando analítica…</p>
        </div>
      )}
    </div>
  )
}
