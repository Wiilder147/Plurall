import { DASHBOARD_THEMES, formatFechaHoy } from '@/lib/dashboardTheme'

export default function DashboardHeader({
  accent = 'indigo',
  title,
  subtitle,
  badge,
  actions,
}) {
  const theme = DASHBOARD_THEMES[accent] ?? DASHBOARD_THEMES.indigo

  return (
    <header
      className={`relative overflow-hidden rounded-2xl border ${theme.heroBorder} bg-gradient-to-br ${theme.hero} p-6 md:p-8 animate-fade-in`}
    >
      <div className={`absolute -top-16 -right-16 w-48 h-48 rounded-full blur-3xl ${theme.heroGlow} pointer-events-none`} />
      <div className={`absolute -bottom-20 -left-10 w-40 h-40 rounded-full blur-3xl ${theme.heroGlow} opacity-60 pointer-events-none`} />

      <div className="relative flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="min-w-0">
          {badge && (
            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider mb-2 ${theme.accent}`}>
              {badge}
            </span>
          )}
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">{title}</h1>
          {subtitle && (
            <p className="text-slate-400 mt-1.5 text-sm md:text-base max-w-2xl">{subtitle}</p>
          )}
          <p className="text-slate-500 text-xs mt-3 capitalize">{formatFechaHoy()}</p>
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>
        )}
      </div>
    </header>
  )
}
