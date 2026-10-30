'use client'

/* ==========================================================================
 * ARCHIVO: DrilldownDrawer.js
 * RUTA: apps/web/components/DrilldownDrawer.js
 * DESCRIPCIÓN: Panel lateral flotante (estilo CRM) que muestra el detalle de
 *              un segmento de gráfica al hacer clic en una barra/sector.
 * FUNCIONALIDAD: Carga /api/analitica/detalle y lista los registros con enlaces
 *                de navegación a su ficha y reasignación de asesor en línea.
 * ========================================================================== */
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { X, RefreshCw, ExternalLink, UserCog, ArrowRight, Check } from 'lucide-react'

export default function DrilldownDrawer({ drill, basePath, desde, hasta, onClose }) {
  const router = useRouter()
  const [data, setData] = useState(null)      // { clave, ...respuesta }
  const [version, setVersion] = useState(0)    // fuerza recarga tras reasignar
  const [reasignando, setReasignando] = useState(null) // id_cliente en edición
  const [ok, setOk] = useState({ segmento: null, msg: '' })

  // "cargando" se deriva: los datos guardan la clave de su petición, así el
  // efecto solo escribe estado al llegar la respuesta (sin setState síncrono).
  const segmento = drill ? `${drill.dim}|${drill.valor}|${desde ?? ''}|${hasta ?? ''}` : null
  const clave    = segmento ? `${segmento}|${version}` : null
  const cargando = !!clave && data?.clave !== clave
  const okMsg    = ok.segmento === segmento ? ok.msg : ''
  const setOkMsg = (msg) => setOk({ segmento, msg })

  useEffect(() => {
    if (!drill || !clave) return
    let vigente = true
    const params = new URLSearchParams({ dim: drill.dim, valor: drill.valor })
    if (desde) params.set('desde', desde)
    if (hasta) params.set('hasta', hasta)
    fetch(`/api/analitica/detalle?${params.toString()}`)
      .then(async (res) => {
        const json = await res.json().catch(() => ({}))
        if (vigente) setData({ clave, ...(res.ok ? json : { error: json?.error, items: [] }) })
      })
      .catch(() => { if (vigente) setData({ clave, error: 'Error de conexión', items: [] }) })
    return () => { vigente = false }
  }, [drill, desde, hasta, clave])

  if (!drill) return null

  // Enlace de navegación por item según su entidad y el panel activo
  const hrefItem = (it) => {
    if (it.entidad === 'solicitud') return `${basePath}/solicitudes/${it.id}`
    if (it.entidad === 'credito') return basePath === '/admin' ? `/admin/clientes/${it.id_cliente}` : null
    return null
  }
  const hrefSeccion = () => {
    const e = data?.entidad
    if (e === 'solicitud') return `${basePath}/solicitudes`
    if (e === 'credito') return basePath === '/admin' ? '/admin/clientes' : '/supervisor/creditos'
    if (e === 'pqr') return '/supervisor/pqr'
    return basePath
  }

  const reasignar = async (id_cliente, asesorId) => {
    if (!asesorId) return
    const res = await fetch('/api/supervisor/asignar-asesor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clienteId: id_cliente, asesorId }),
    })
    if (res.ok) {
      setOkMsg('Asesor reasignado correctamente.')
      setReasignando(null)
      router.refresh()
      setVersion(v => v + 1)
    } else {
      const j = await res.json()
      setOkMsg(j?.error || 'No se pudo reasignar')
    }
  }

  const puedeReasignar = data?.entidad === 'credito' || data?.entidad === 'solicitud'

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm" onClick={onClose} />

      {/* Panel lateral */}
      <aside className="fixed top-0 right-0 z-50 h-full w-full max-w-md bg-slate-900 border-l border-slate-700 shadow-2xl flex flex-col animate-[slideIn_0.2s_ease-out]">
        <style>{`@keyframes slideIn{from{transform:translateX(100%)}to{transform:translateX(0)}}`}</style>

        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-700 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">{drill.titulo}</p>
            <h3 className="text-lg font-bold text-white truncate">{drill.valor}</h3>
            {data && !cargando && <p className="text-sm text-slate-400 mt-0.5">{data.total} registro{data.total !== 1 ? 's' : ''}</p>}
          </div>
          <button onClick={onClose} className="shrink-0 text-slate-500 hover:text-slate-200"><X className="w-5 h-5" /></button>
        </div>

        {okMsg && <div className="mx-5 mt-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs rounded-lg px-3 py-2">{okMsg}</div>}

        {/* Lista */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-2">
          {cargando && <div className="flex justify-center py-10"><RefreshCw className="w-5 h-5 text-slate-500 animate-spin" /></div>}
          {!cargando && data?.items?.length === 0 && <p className="text-slate-500 text-sm text-center py-10">Sin registros en este segmento.</p>}
          {!cargando && data?.items?.map((it) => {
            const href = hrefItem(it)
            return (
              <div key={it.id} className="bg-slate-800 border border-slate-700 rounded-xl p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-200 truncate">{it.titulo}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{it.subtitulo}</p>
                  </div>
                  {href && (
                    <Link href={href} className="shrink-0 text-slate-400 hover:text-white" title="Abrir ficha">
                      <ExternalLink className="w-4 h-4" />
                    </Link>
                  )}
                </div>

                {/* Reasignación de asesor en línea */}
                {puedeReasignar && it.id_cliente && (
                  reasignando === it.id_cliente ? (
                    <div className="mt-2.5 flex items-center gap-2">
                      <select id={`sel-${it.id_cliente}`} defaultValue=""
                        className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500">
                        <option value="" disabled>Elegir asesor…</option>
                        {data.asesores.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                      </select>
                      <button onClick={() => reasignar(it.id_cliente, document.getElementById(`sel-${it.id_cliente}`).value)}
                        className="shrink-0 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg p-1.5"><Check className="w-4 h-4" /></button>
                      <button onClick={() => setReasignando(null)} className="shrink-0 text-slate-500 hover:text-slate-300"><X className="w-4 h-4" /></button>
                    </div>
                  ) : (
                    <button onClick={() => setReasignando(it.id_cliente)}
                      className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-400 hover:text-indigo-300">
                      <UserCog className="w-3.5 h-3.5" /> Reasignar asesor
                    </button>
                  )
                )}
              </div>
            )
          })}
        </div>

        {/* Footer: ir a la sección */}
        <div className="px-5 py-4 border-t border-slate-700">
          <Link href={hrefSeccion()} onClick={onClose}
            className="w-full inline-flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
            Ir a la sección completa <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </aside>
    </>
  )
}
