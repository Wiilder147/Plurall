/* ==========================================================================
 * ARCHIVO: Skeletons.js
 * RUTA: apps/web/components/Skeletons.js
 * DESCRIPCIÓN: Placeholders animados (skeleton) reutilizables.
 * FUNCIONALIDAD: Se muestran instantáneamente vía loading.js mientras el
 *                contenido real del server component se obtiene, mejorando la
 *                percepción de velocidad. `dark` para paneles staff; claro para
 *                la vista del cliente.
 * ========================================================================== */

function Bar({ className = '' }) {
  return <div className={`animate-pulse rounded-lg ${className}`} />
}

export function PanelSkeleton({ dark = true }) {
  const base = dark ? 'bg-slate-800' : 'bg-slate-200'
  const card = dark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'
  return (
    <div className="flex flex-col gap-6 pb-10">
      {/* Encabezado */}
      <div className="flex flex-col gap-2">
        <Bar className={`${base} h-8 w-64`} />
        <Bar className={`${base} h-4 w-80 opacity-60`} />
      </div>
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={`border rounded-2xl p-5 ${card}`}>
            <Bar className={`${base} h-10 w-10 mb-3`} />
            <Bar className={`${base} h-7 w-20 mb-2`} />
            <Bar className={`${base} h-3 w-24 opacity-60`} />
          </div>
        ))}
      </div>
      {/* Bloques de contenido / gráficas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className={`border rounded-2xl p-5 ${card}`}>
            <Bar className={`${base} h-4 w-40 mb-4 opacity-70`} />
            <Bar className={`${base} h-48 w-full`} />
          </div>
        ))}
      </div>
    </div>
  )
}

export function ListaSkeleton({ dark = true, filas = 6 }) {
  const base = dark ? 'bg-slate-800' : 'bg-slate-200'
  const card = dark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'
  return (
    <div className="flex flex-col gap-6 pb-10">
      <div className="flex flex-col gap-2">
        <Bar className={`${base} h-8 w-56`} />
        <Bar className={`${base} h-4 w-72 opacity-60`} />
      </div>
      <div className="flex flex-col gap-3">
        {Array.from({ length: filas }).map((_, i) => (
          <div key={i} className={`border rounded-2xl p-5 flex items-center gap-4 ${card}`}>
            <Bar className={`${base} h-10 w-10 shrink-0`} />
            <div className="flex-1 flex flex-col gap-2">
              <Bar className={`${base} h-4 w-1/3`} />
              <Bar className={`${base} h-3 w-1/2 opacity-60`} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
