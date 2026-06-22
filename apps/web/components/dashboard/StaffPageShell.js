import DashboardHeader from '@/components/dashboard/DashboardHeader'
import QuickActions from '@/components/dashboard/QuickActions'

export default function StaffPageShell({
  accent = 'indigo',
  badge,
  title,
  subtitle,
  actions,
  quickActions,
  children,
}) {
  return (
    <div className="flex flex-col gap-6 md:gap-8 pb-10">
      <DashboardHeader accent={accent} badge={badge} title={title} subtitle={subtitle} actions={actions} />
      {quickActions?.length > 0 && <QuickActions accent={accent} actions={quickActions} />}
      {children}
    </div>
  )
}
