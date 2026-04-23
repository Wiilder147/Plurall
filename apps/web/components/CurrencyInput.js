'use client'

/**
 * Campo de dinero con formato de pesos colombianos en tiempo real.
 * Separadores: punto para miles, apóstrofe para millones.
 * Ejemplos: 1.500 | 150.000 | 1'500.000 | 10'000.000
 */

function formatCOP(value) {
  if (value === '' || value === null || value === undefined) return ''
  const n = parseInt(String(value).replace(/\D/g, ''), 10)
  if (!n || isNaN(n)) return ''
  const s = String(n)
  const len = s.length
  if (len <= 3) return s
  if (len <= 6) return s.slice(0, len - 3) + '.' + s.slice(len - 3)
  if (len <= 9) return s.slice(0, len - 6) + "'" + s.slice(len - 6, len - 3) + '.' + s.slice(len - 3)
  return s.slice(0, len - 9) + "'" + s.slice(len - 9, len - 6) + "'" + s.slice(len - 6, len - 3) + '.' + s.slice(len - 3)
}

export default function CurrencyInput({
  value,
  onChange,
  placeholder = '0',
  className = '',
  disabled = false,
}) {
  function handleChange(e) {
    const raw = e.target.value.replace(/[^\d]/g, '')
    onChange(raw === '' ? '' : parseInt(raw, 10))
  }

  return (
    <div className="relative">
      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-base font-bold pointer-events-none select-none">
        $
      </span>
      <input
        type="text"
        inputMode="numeric"
        value={value !== '' && value !== null && value !== undefined ? formatCOP(value) : ''}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        className={`w-full border border-slate-200 rounded-xl pl-9 pr-4 py-3 text-base font-semibold
                   text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-400
                   transition-shadow disabled:bg-slate-50 disabled:text-slate-400 ${className}`}
      />
    </div>
  )
}
