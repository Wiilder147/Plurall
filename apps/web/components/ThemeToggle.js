'use client'

import { useTheme } from './ThemeProvider'
import { Sun, Moon } from 'lucide-react'

export default function ThemeToggle({ className = '' }) {
  const { theme, toggle } = useTheme()
  const isDark = theme === 'dark'

  return (
    <button
      onClick={toggle}
      title={isDark ? 'Cambiar a modo claro ☀️' : 'Cambiar a modo oscuro 🌙'}
      aria-label={isDark ? 'Activar modo claro' : 'Activar modo oscuro'}
      className={`
        inline-flex items-center justify-center gap-1.5
        px-3 py-2 rounded-xl text-xs font-semibold
        transition-all duration-200 border
        ${isDark
          ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/20'
          : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/20'
        }
        ${className}
      `}
    >
      {isDark
        ? <><Sun className="w-3.5 h-3.5" /><span className="hidden sm:inline">Claro</span></>
        : <><Moon className="w-3.5 h-3.5" /><span className="hidden sm:inline">Oscuro</span></>
      }
    </button>
  )
}
