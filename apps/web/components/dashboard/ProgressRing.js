export default function ProgressRing({
  value = 0,
  max = 100,
  label,
  sublabel,
  color = '#14b8a6',
  size = 120,
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  const r = (size - 12) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (pct / 100) * circ

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth="8" className="text-slate-700" />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-extrabold text-white">{pct}%</span>
        </div>
      </div>
      {label && <p className="text-sm font-semibold text-slate-200 text-center">{label}</p>}
      {sublabel && <p className="text-xs text-slate-500 text-center">{sublabel}</p>}
    </div>
  )
}
