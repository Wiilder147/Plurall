'use client'

import { LogOut } from 'lucide-react'
import ThemeToggle from './ThemeToggle'
import NotificationBell from './NotificationBell'

const ACCENT = {
  slate: {
    border: 'border-slate-800',
    logout: 'text-slate-400 hover:bg-red-900/30 hover:text-red-400',
  },
  teal: {
    border: 'border-teal-900',
    logout: 'text-teal-400/80 hover:bg-red-900/30 hover:text-red-400',
  },
  indigo: {
    border: 'border-indigo-900',
    logout: 'text-indigo-400/80 hover:bg-red-900/30 hover:text-red-400',
  },
  light: {
    border: 'border-slate-100',
    logout: 'text-slate-500 hover:bg-red-50 hover:text-red-600',
  },
}

export default function SidebarFooter({
  onLogout,
  accent = 'slate',
  notificationHref,
  showThemeToggle = true,
}) {
  const styles = ACCENT[accent] ?? ACCENT.slate

  return (
    <div className={`p-3 border-t ${styles.border} shrink-0 overflow-hidden`}>
      <button
        type="button"
        onClick={onLogout}
        className={`w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl transition-all text-sm font-medium min-w-0 ${styles.logout}`}
      >
        <LogOut className="h-4 w-4 shrink-0" aria-hidden />
        <span className="truncate">Cerrar sesión</span>
      </button>

      {(notificationHref || showThemeToggle) && (
        <div className="flex items-center justify-center gap-2 mt-2 min-w-0">
          {notificationHref && (
            <NotificationBell href={notificationHref} accent={accent === 'light' ? 'slate' : accent} />
          )}
          {showThemeToggle && <ThemeToggle compact />}
        </div>
      )}
    </div>
  )
}
