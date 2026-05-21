'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, ClipboardList, Users,
  AlertTriangle, BarChart3, UserCheck,
  LogOut, Menu, X, ShieldCheck, Search, GitMerge,
} from 'lucide-react'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import ThemeToggle from './ThemeToggle'

const navigation = [
  { name: 'Panel',        href: '/supervisor',                  icon: LayoutDashboard },
  { name: 'Solicitudes',  href: '/supervisor/solicitudes',      icon: ClipboardList   },
  { name: 'Cartera',      href: '/supervisor/cartera',          icon: BarChart3       },
  { name: 'Mora',         href: '/supervisor/mora',             icon: AlertTriangle   },
  { name: 'Embudo',       href: '/supervisor/funnel',           icon: GitMerge        },
  { name: 'Clientes',     href: '/supervisor/clientes',         icon: Users           },
  { name: 'Buscar',       href: '/supervisor/buscar',           icon: Search          },
  { name: 'Asesores',     href: '/supervisor/asesores',         icon: UserCheck       },
  { name: 'Auditoría',    href: '/supervisor/auditoria',        icon: ShieldCheck     },
]

export default function SupervisorSidebar() {
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
      {/* Hamburger móvil */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="md:hidden fixed top-4 left-4 z-50 p-2 bg-indigo-900 rounded-md shadow text-white"
      >
        {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>

      {isOpen && (
        <div
          className="md:hidden fixed inset-0 bg-slate-900/40 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed md:static inset-y-0 left-0 z-40
        w-64 bg-indigo-950 border-r border-indigo-900
        transform transition-transform duration-300 ease-in-out
        flex flex-col
        ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* Logo */}
        <div className="h-20 flex items-center justify-center border-b border-indigo-900 px-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-500 text-white flex items-center justify-center font-bold text-lg rounded-md">P</div>
            <div className="flex flex-col leading-none">
              <span className="text-white font-bold text-base tracking-tight">PLURALL</span>
              <span className="text-indigo-400 text-xs font-medium">Supervisor</span>
            </div>
          </div>
        </div>

        {/* Navegación */}
        <div className="flex-1 py-6 px-4 flex flex-col gap-1 overflow-y-auto">
          {navigation.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== '/supervisor' && pathname.startsWith(item.href))
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-sm
                  ${isActive
                    ? 'bg-indigo-500/20 text-indigo-300 font-semibold'
                    : 'text-indigo-300/60 hover:bg-indigo-900 hover:text-indigo-200'}
                `}
              >
                <item.icon className={`h-4 w-4 ${isActive ? 'text-indigo-400' : 'text-indigo-500/60'}`} />
                {item.name}
              </Link>
            )
          })}
        </div>

        {/* Logout */}
        <div className="p-4 border-t border-indigo-900 flex items-center gap-2">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 flex-1 rounded-xl text-indigo-400/60 hover:bg-red-900/30 hover:text-red-400 transition-all text-sm"
          >
            <LogOut className="h-4 w-4" />
            <span className="font-medium">Cerrar sesión</span>
          </button>
          <ThemeToggle />
        </div>
      </div>
    </>
  )
}
