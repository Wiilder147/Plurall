/** Tokens visuales por portal (asesor / supervisor / admin). */
export const DASHBOARD_THEMES = {
  teal: {
    hero: 'from-teal-600/25 via-teal-500/10 to-slate-900/0',
    heroBorder: 'border-teal-500/20',
    heroGlow: 'bg-teal-500/10',
    accent: 'text-teal-400',
    accentBg: 'bg-teal-500/10',
    accentBorder: 'border-teal-500/30',
    kpiHover: 'hover:border-teal-500/40 hover:shadow-teal-500/5',
    link: 'text-teal-400 hover:text-teal-300',
    btn: 'bg-teal-500/15 text-teal-300 border-teal-500/25 hover:bg-teal-500/25',
    gradient: 'from-teal-500 to-teal-600',
    shadow: 'shadow-teal-500/20',
    ring: 'ring-teal-500/20',
  },
  indigo: {
    hero: 'from-indigo-600/25 via-indigo-500/10 to-slate-900/0',
    heroBorder: 'border-indigo-500/20',
    heroGlow: 'bg-indigo-500/10',
    accent: 'text-indigo-400',
    accentBg: 'bg-indigo-500/10',
    accentBorder: 'border-indigo-500/30',
    kpiHover: 'hover:border-indigo-500/40 hover:shadow-indigo-500/5',
    link: 'text-indigo-400 hover:text-indigo-300',
    btn: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/25 hover:bg-indigo-500/25',
    gradient: 'from-indigo-500 to-indigo-600',
    shadow: 'shadow-indigo-500/20',
    ring: 'ring-indigo-500/20',
  },
  orange: {
    hero: 'from-orange-600/25 via-orange-500/10 to-slate-900/0',
    heroBorder: 'border-orange-500/20',
    heroGlow: 'bg-orange-500/10',
    accent: 'text-orange-400',
    accentBg: 'bg-orange-500/10',
    accentBorder: 'border-orange-500/30',
    kpiHover: 'hover:border-orange-500/40 hover:shadow-orange-500/5',
    link: 'text-orange-400 hover:text-orange-300',
    btn: 'bg-orange-500/15 text-orange-300 border-orange-500/25 hover:bg-orange-500/25',
    gradient: 'from-orange-500 to-orange-600',
    shadow: 'shadow-orange-500/20',
    ring: 'ring-orange-500/20',
  },
}

export function getEstadoBadgeClasses(estado) {
  const e = (estado || 'PENDIENTE').toUpperCase()
  if (['PENDIENTE', 'EN_ESTUDIO', 'PREAPROBADA'].includes(e))
    return 'bg-yellow-500/10 text-yellow-400 ring-yellow-500/20'
  if (['APROBADA', 'DESEMBOLSADA', 'ACTIVO'].includes(e))
    return 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20'
  if (['RECHAZADA', 'CANCELADA', 'EN_MORA'].includes(e))
    return 'bg-red-500/10 text-red-400 ring-red-500/20'
  return 'bg-slate-500/10 text-slate-400 ring-slate-500/20'
}

export function formatFechaHoy() {
  return new Date().toLocaleDateString('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}
