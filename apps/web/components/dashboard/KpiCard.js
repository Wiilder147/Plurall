import Link from 'next/link'
import { DASHBOARD_THEMES } from '@/lib/dashboardTheme'

export default function KpiCard({
  label,
  value,
  icon: Icon,
  color = 'text-slate-400 bg-slate-500/10',
  href,
  accent = 'indigo',
  trend,
  sublabel,
  index = 0,
}) {
  const theme = DASHBOARD_THEMES[accent] ?? DASHBOARD_THEMES.indigo
  const displayValue = typeof value === 'number' ? value.toLocaleString('es-CO') : value

  const inner = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
          {Icon && <Icon className="w-5 h-5" />}
        </div>
        {trend != null && (
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
            trend >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
          }`}>
            {trend >= 0 ? '+' : ''}{trend}%
          </span>
        )}
      </div>
      <p className="text-2xl md:text-3xl font-extrabold text-white mt-4 tracking-tight">{displayValue}</p>
      <p className="text-slate-400 text-sm mt-1">{label}</p>
      {sublabel && <p className="text-slate-500 text-xs mt-0.5">{sublabel}</p>}
    </>
  )

  const className = `dash-kpi-card group bg-slate-800/80 backdrop-blur-sm border border-slate-700/80 rounded-2xl p-5 transition-all duration-300 ${theme.kpiHover} hover:-translate-y-0.5 hover:shadow-lg animate-fade-in`
  const style = { animationDelay: `${index * 60}ms` }

  if (href) {
    return (
      <Link href={href} className={className} style={style}>
        {inner}
        <div className={`mt-3 h-0.5 w-0 group-hover:w-full transition-all duration-300 rounded-full bg-gradient-to-r ${theme.gradient}`} />
      </Link>
    )
  }

  return (
    <div className={className} style={style}>
      {inner}
    </div>
  )
}

const GRID_COLS = {
  2: 'grid-cols-2',
  3: 'grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-2 lg:grid-cols-4',
}

export function KpiGrid({ children, cols = 3 }) {
  return (
    <div className={`grid ${GRID_COLS[cols] ?? GRID_COLS[3]} gap-4`}>
      {children}
    </div>
  )
}
