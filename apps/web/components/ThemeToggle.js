'use client'

/* ==========================================================================
 * ARCHIVO: ThemeToggle.js
 * RUTA: apps/web/components/ThemeToggle.js
 * DESCRIPCIÓN: Componente de interfaz de usuario (UI) reutilizable.
 * FUNCIONALIDAD: Este archivo define la lógica y estructura para su respectivo módulo.
 * ========================================================================== */

import { useTheme } from './ThemeProvider'
import { Sun, Moon } from 'lucide-react'

export default function ThemeToggle({ className = '', compact = false }) {
  const { theme, toggle } = useTheme()
  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      onClick={toggle}
      title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      aria-label={isDark ? 'Activar modo claro' : 'Activar modo oscuro'}
      className={`
        inline-flex items-center justify-center shrink-0
        rounded-xl text-xs font-semibold transition-all duration-200 border
        ${compact ? 'w-9 h-9 p-0' : 'gap-1.5 px-3 py-2'}
        ${isDark
          ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/20'
          : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/20'
        }
        ${className}
      `}
    >
      {isDark
        ? <Sun className="w-4 h-4" />
        : <Moon className="w-4 h-4" />
      }
      {!compact && (
        <span>{isDark ? 'Claro' : 'Oscuro'}</span>
      )}
    </button>
  )
}
