import { getEstadoBadgeClasses } from '@/lib/dashboardTheme'

export default function StatusBadge({ estado, className = '' }) {
  const label = (estado || 'PENDIENTE').toUpperCase().replace(/_/g, ' ')
  return (
    <span className={`inline-flex text-xs font-semibold px-2.5 py-1 rounded-full ring-1 ring-inset ${getEstadoBadgeClasses(estado)} ${className}`}>
      {label}
    </span>
  )
}
