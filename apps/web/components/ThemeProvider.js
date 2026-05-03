'use client'

import { createContext, useContext, useEffect, useState } from 'react'

const ThemeContext = createContext({ theme: 'dark', toggle: () => {} })

// ── Estilos del modo claro inyectados directamente en el DOM ─────────────────
const LIGHT_MODE_CSS = `
  /* ── Fondos principales ── */
  [data-theme="light"] .bg-slate-950 { background-color: #f0f4f8 !important; }
  [data-theme="light"] .bg-slate-900 { background-color: #e8edf4 !important; }
  [data-theme="light"] .bg-slate-800 { background-color: #ffffff !important; }
  [data-theme="light"] .bg-slate-700 { background-color: #f1f5f9 !important; }

  /* ── Sidebar izquierdo: modo claro (blanco/gris claro) ── */
  [data-theme="light"] .bg-indigo-950 {
    background-color: #ffffff !important;
    border-right: 1px solid #e2e8f0 !important;
  }
  [data-theme="light"] .bg-teal-950 {
    background-color: #ffffff !important;
    border-right: 1px solid #e2e8f0 !important;
  }
  [data-theme="light"] .border-indigo-900 { border-color: #e2e8f0 !important; }
  [data-theme="light"] .border-teal-900   { border-color: #e2e8f0 !important; }

  /* Texto del sidebar en modo claro */
  [data-theme="light"] .bg-indigo-950 .text-white,
  [data-theme="light"] .bg-indigo-950 span,
  [data-theme="light"] .bg-indigo-950 a {
    color: #1e293b !important;
  }
  [data-theme="light"] .bg-teal-950 .text-white,
  [data-theme="light"] .bg-teal-950 span,
  [data-theme="light"] .bg-teal-950 a {
    color: #1e293b !important;
  }
  /* Ítem activo del sidebar */
  [data-theme="light"] .bg-indigo-500\/20 {
    background-color: rgba(99,102,241,0.1) !important;
  }
  [data-theme="light"] .text-indigo-300 { color: #4338ca !important; }
  [data-theme="light"] .text-indigo-400 { color: #4f46e5 !important; }
  [data-theme="light"] .text-teal-400   { color: #0d9488 !important; }
  [data-theme="light"] .text-teal-300   { color: #0f766e !important; }
  /* Texto apagado del sidebar */
  [data-theme="light"] .text-indigo-300\/60 { color: #64748b !important; }
  [data-theme="light"] .text-teal-300\/60   { color: #64748b !important; }
  [data-theme="light"] .text-indigo-400\/60 { color: #64748b !important; }
  [data-theme="light"] .text-teal-400\/60   { color: #64748b !important; }
  [data-theme="light"] .text-indigo-500\/60 { color: #94a3b8 !important; }
  [data-theme="light"] .text-teal-500\/60   { color: #94a3b8 !important; }
  /* Logo del sidebar */
  [data-theme="light"] .bg-indigo-500 { background-color: #4f46e5 !important; }
  [data-theme="light"] .bg-teal-500   { background-color: #0d9488 !important; }
  /* Hover del sidebar */
  [data-theme="light"] .hover\\:bg-indigo-900:hover { background-color: #f1f5f9 !important; }
  [data-theme="light"] .hover\\:bg-teal-900:hover   { background-color: #f0fdfa !important; }
  [data-theme="light"] .hover\\:text-indigo-200:hover { color: #312e81 !important; }
  [data-theme="light"] .hover\\:text-teal-200:hover   { color: #134e4a !important; }

  /* ── Recuadro Cartera Activa Total — en modo claro cambia a blanco/azul ── */
  [data-theme="light"] .from-indigo-600.to-indigo-700,
  [data-theme="light"] .bg-gradient-to-br.from-indigo-600 {
    background: linear-gradient(135deg, #1e40af, #1d4ed8) !important;
  }
  /* Forzar override del gradiente inline */
  [data-theme="light"] [class*="from-indigo-6"] {
    --tw-gradient-from: #1e40af !important;
  }
  [data-theme="light"] [class*="to-indigo-7"] {
    --tw-gradient-to: #1d4ed8 !important;
  }
  [data-theme="light"] .text-indigo-200 { color: #bfdbfe !important; }
  [data-theme="light"] .text-indigo-300 { color: #93c5fd !important; }
  [data-theme="light"] .shadow-indigo-500\/20 { box-shadow: 0 20px 25px -5px rgba(30,64,175,0.25) !important; }

  /* ── Bordes ── */
  [data-theme="light"] .border-slate-700 { border-color: #cbd5e1 !important; }
  [data-theme="light"] .border-slate-800 { border-color: #e2e8f0 !important; }
  [data-theme="light"] .border-slate-600 { border-color: #94a3b8 !important; }

  /* ── Texto principal ── */
  [data-theme="light"] .text-white     { color: #0f172a !important; }
  [data-theme="light"] .text-slate-200 { color: #1e293b !important; }
  [data-theme="light"] .text-slate-300 { color: #334155 !important; }
  [data-theme="light"] .text-slate-400 { color: #475569 !important; }
  [data-theme="light"] .text-slate-500 { color: #64748b !important; }

  /* ── Hover de filas ── */
  [data-theme="light"] .hover\\:bg-slate-700\\/40:hover { background-color: rgba(226,232,240,0.6) !important; }
  [data-theme="light"] .hover\\:bg-slate-700\\/20:hover { background-color: rgba(226,232,240,0.4) !important; }

  /* ── Dividers ── */
  [data-theme="light"] .divide-slate-700\\/50 > :not([hidden]) ~ :not([hidden]) { border-color: #e2e8f0 !important; }
  [data-theme="light"] .divide-slate-700\\/40 > :not([hidden]) ~ :not([hidden]) { border-color: #e2e8f0 !important; }

  /* ── Fondo del layout principal ── */
  [data-theme="light"] main { background-color: #f8fafc !important; }

  /* ── Inputs ── */
  [data-theme="light"] input.bg-slate-700,
  [data-theme="light"] textarea.bg-slate-700,
  [data-theme="light"] select.bg-slate-700 {
    background-color: #f1f5f9 !important;
    color: #0f172a !important;
    border-color: #cbd5e1 !important;
  }

  /* ── Tablas ── */
  [data-theme="light"] .bg-slate-700\\/50 { background-color: rgba(241,245,249,0.9) !important; }
  [data-theme="light"] .bg-slate-700\\/40 { background-color: rgba(241,245,249,0.7) !important; }
  [data-theme="light"] .bg-slate-700\\/20 { background-color: rgba(241,245,249,0.5) !important; }

  /* ── Indicador de mora (texto legible) ── */
  [data-theme="light"] .bg-slate-800.border-slate-700 .text-white { color: #0f172a !important; }
  [data-theme="light"] .bg-slate-800.border-slate-700 .text-slate-400 { color: #475569 !important; }
  [data-theme="light"] .bg-slate-800.border-slate-700 .text-slate-500 { color: #64748b !important; }

  /* ── Transición suave ── */
  [data-theme="light"] * {
    transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease;
  }
  [data-theme="light"] .animate-spin,
  [data-theme="light"] .animate-pulse,
  [data-theme="light"] .animate-bounce {
    transition: none !important;
  }
`

function injectStyles() {
  const id = 'plurall-theme-styles'
  let el = document.getElementById(id)
  if (!el) {
    el = document.createElement('style')
    el.id = id
    document.head.appendChild(el)
  }
  el.textContent = LIGHT_MODE_CSS
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('dark')

  useEffect(() => {
    // Inyectar los estilos del tema en el <head>
    injectStyles()

    // Leer preferencia guardada
    const saved = localStorage.getItem('plurall-theme') ?? 'dark'
    setTheme(saved)
    document.documentElement.setAttribute('data-theme', saved)
  }, [])

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem('plurall-theme', next)
  }

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
