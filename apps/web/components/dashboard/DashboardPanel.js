import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { DASHBOARD_THEMES } from '@/lib/dashboardTheme'

export default function DashboardPanel({
  title,
  icon: Icon,
  iconColor = 'text-slate-400',
  href,
  linkLabel = 'Ver todos',
  accent = 'indigo',
  children,
  empty,
  isEmpty = false,
}) {
  const theme = DASHBOARD_THEMES[accent] ?? DASHBOARD_THEMES.indigo

  return (
    <div className="dash-panel bg-slate-800/80 backdrop-blur-sm border border-slate-700/80 rounded-2xl overflow-hidden animate-fade-in">
      <div className="px-5 py-4 border-b border-slate-700/80 flex items-center justify-between gap-3">
        <h2 className="font-semibold text-white text-sm flex items-center gap-2 min-w-0">
          {Icon && <Icon className={`w-4 h-4 shrink-0 ${iconColor}`} />}
          <span className="truncate">{title}</span>
        </h2>
        {href && (
          <Link href={href} className={`${theme.link} text-xs font-medium flex items-center gap-1 shrink-0 transition-colors`}>
            {linkLabel} <ArrowRight className="w-3 h-3" />
          </Link>
        )}
      </div>
      {isEmpty ? (
        <div className="text-center text-slate-500 py-10 px-5 text-sm">{empty ?? 'Sin registros.'}</div>
      ) : (
        children
      )}
    </div>
  )
}

export function PanelRow({ href, children, className = '' }) {
  const Tag = href ? Link : 'div'
  return (
    <Tag
      href={href}
      className={`flex items-center justify-between px-5 py-3.5 transition-colors ${
        href ? 'hover:bg-slate-700/40 cursor-pointer' : ''
      } ${className}`}
    >
      {children}
    </Tag>
  )
}

export function PanelList({ children }) {
  return <div className="divide-y divide-slate-700/50">{children}</div>
}
