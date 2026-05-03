'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, Users, AlertTriangle,
  ClipboardList, PhoneCall, LogOut, Menu, X,
} from 'lucide-react'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import ThemeToggle from './ThemeToggle'

const navigation = [
  { name: 'Mi Panel',    href: '/asesor',             icon: LayoutDashboard },
  { name: 'Mis Clientes',href: '/asesor/clientes',    icon: Users           },
  { name: 'Cobranza',    href: '/asesor/cobranza',    icon: AlertTriangle   },
  { name: 'Gestiones',   href: '/asesor/gestiones',   icon: ClipboardList   },
  { name: 'Pagos',       href: '/asesor/pagos',       icon: PhoneCall       },
]

export default function AsesorSidebar() {
  const pathname = usePathname()
  const router   = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="md:hidden fixed top-4 left-4 z-50 p-2 bg-teal-900 rounded-md shadow text-white"
      >
        {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>

      {isOpen && (
        <div className="md:hidden fixed inset-0 bg-slate-900/40 z-40" onClick={() => setIsOpen(false)} />
      )}

      <div className={`
        fixed md:static inset-y-0 left-0 z-40
        w-64 bg-teal-950 border-r border-teal-900
        transform transition-transform duration-300 ease-in-out
        flex flex-col
        ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* Logo */}
        <div className="h-20 flex items-center justify-center border-b border-teal-900 px-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-teal-500 text-white flex items-center justify-center font-bold text-lg rounded-md">P</div>
            <div className="flex flex-col leading-none">
              <span className="text-white font-bold text-base tracking-tight">PLURALL</span>
              <span className="text-teal-400 text-xs font-medium">Asesor</span>
            </div>
          </div>
        </div>

        {/* Navegación */}
        <div className="flex-1 py-6 px-4 flex flex-col gap-1 overflow-y-auto">
          {navigation.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== '/asesor' && pathname.startsWith(item.href))
            return (
              <Link key={item.name} href={item.href} onClick={() => setIsOpen(false)}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-sm
                  ${isActive
                    ? 'bg-teal-500/20 text-teal-300 font-semibold'
                    : 'text-teal-300/60 hover:bg-teal-900 hover:text-teal-200'}
                `}>
                <item.icon className={`h-4 w-4 ${isActive ? 'text-teal-400' : 'text-teal-500/60'}`} />
                {item.name}
              </Link>
            )
          })}
        </div>

        {/* Logout */}
        <div className="p-4 border-t border-teal-900 flex items-center gap-2">
          <button onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 flex-1 rounded-xl text-teal-400/60 hover:bg-red-900/30 hover:text-red-400 transition-all text-sm">
            <LogOut className="h-4 w-4" />
            <span className="font-medium">Cerrar sesión</span>
          </button>
          <ThemeToggle />
        </div>
      </div>
    </>
  )
}
