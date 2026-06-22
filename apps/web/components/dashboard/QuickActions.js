import Link from 'next/link'
import { DASHBOARD_THEMES } from '@/lib/dashboardTheme'

export default function QuickActions({ accent = 'indigo', actions = [] }) {
  const theme = DASHBOARD_THEMES[accent] ?? DASHBOARD_THEMES.indigo

  if (!actions.length) return null

  return (
    <div className="flex flex-wrap gap-2 animate-fade-in">
      {actions.map(({ label, href, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all duration-200 ${theme.btn}`}
        >
          {Icon && <Icon className="w-4 h-4" />}
          {label}
        </Link>
      ))}
    </div>
  )
}
