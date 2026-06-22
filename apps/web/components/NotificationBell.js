'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Bell } from 'lucide-react'

export default function NotificationBell({ href, accent = 'indigo' }) {
  const [count, setCount] = useState(0)

  const colors = {
    teal: 'text-teal-400 hover:bg-teal-900/50',
    indigo: 'text-indigo-400 hover:bg-indigo-900/50',
    orange: 'text-orange-400 hover:bg-orange-900/50',
    slate: 'text-slate-400 hover:bg-slate-800',
  }

  useEffect(() => {
    fetch('/api/notificaciones/count')
      .then(r => r.json())
      .then(d => setCount(d.count ?? 0))
      .catch(() => {})
  }, [])

  return (
    <Link href={href} className={`relative p-2 rounded-xl transition-colors ${colors[accent] || colors.indigo}`} title="Notificaciones">
      <Bell className="w-5 h-5" />
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </Link>
  )
}
