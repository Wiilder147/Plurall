'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, ClipboardList, Users, LogOut, Menu, X, BarChart3 } from 'lucide-react'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const navigation = [
  { name: 'Panel',       href: '/admin',             icon: LayoutDashboard },
  { name: 'Solicitudes', href: '/admin/solicitudes',  icon: ClipboardList   },
  { name: 'Clientes',    href: '/admin/clientes',     icon: Users           },
  { name: 'Reportes',    href: '/admin/reportes',     icon: BarChart3       },
]

export default function AdminSidebar() {
  const pathname  = usePathname()
  const router    = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const supabase  = createClient()

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
        className="md:hidden fixed top-4 left-4 z-50 p-2 bg-slate-900 rounded-md shadow text-white"
      >
        {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>

      {isOpen && (
        <div className="md:hidden fixed inset-0 bg-slate-900/40 z-40" onClick={() => setIsOpen(false)} />
      )}

      {/* Sidebar */}
      <div className={`
        fixed md:static inset-y-0 left-0 z-40
        w-64 bg-slate-900 border-r border-slate-800
        transform transition-transform duration-300 ease-in-out
        flex flex-col
        ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* Logo */}
        <div className="h-20 flex items-center justify-center border-b border-slate-800 px-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-orange-500 text-white flex items-center justify-center font-bold text-lg rounded-md">P</div>
            <div className="flex flex-col leading-none">
              <span className="text-white font-bold text-base tracking-tight">PLURALL</span>
              <span className="text-orange-400 text-xs font-medium">Panel Admin</span>
            </div>
          </div>
        </div>

        {/* Navegación */}
        <div className="flex-1 py-6 px-4 flex flex-col gap-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href))
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-sm
                  ${isActive
                    ? 'bg-orange-500/10 text-orange-400 font-semibold'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}
                `}
              >
                <item.icon className={`h-4 w-4 ${isActive ? 'text-orange-400' : 'text-slate-500'}`} />
                {item.name}
              </Link>
            )
          })}
        </div>

        {/* Logout */}
        <div className="p-4 border-t border-slate-800">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-slate-400 hover:bg-red-900/30 hover:text-red-400 transition-all text-sm"
          >
            <LogOut className="h-4 w-4" />
            <span className="font-medium">Cerrar sesión</span>
          </button>
        </div>
      </div>
    </>
  )
}
