import { DASHBOARD_THEMES } from '@/lib/dashboardTheme'

export default function HeroMetric({
  accent = 'orange',
  label,
  value,
  sublabel,
  stats = [],
}) {
  const theme = DASHBOARD_THEMES[accent] ?? DASHBOARD_THEMES.orange

  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${theme.gradient} p-6 md:p-8 text-white shadow-xl ${theme.shadow} animate-fade-in`}>
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/4 blur-2xl pointer-events-none" />
      <p className="text-white/80 text-xs font-semibold uppercase tracking-wider mb-1">{label}</p>
      <p className="text-3xl md:text-4xl font-extrabold tracking-tight">{value}</p>
      {sublabel && <p className="text-white/70 text-sm mt-1">{sublabel}</p>}
      {stats.length > 0 && (
        <div className="mt-4 pt-4 border-t border-white/20 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/80">
          {stats.map(({ label: l, value: v, highlight }) => (
            <span key={l} className={highlight ? 'text-white font-semibold' : ''}>
              {v} {l}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
