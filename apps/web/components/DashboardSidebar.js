'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Home, User, LogOut, Menu, X, CreditCard, FileText, DollarSign, Globe } from 'lucide-react'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const navigation = [
  { name: 'Inicio',       href: '/dashboard/inicio',    icon: Home       },
  { name: 'Mis Créditos', href: '/dashboard/creditos',  icon: CreditCard },
  { name: 'Mis Cuotas',   href: '/dashboard/cuotas',    icon: DollarSign },
  { name: 'Documentos',   href: '/dashboard/documentos',icon: FileText   },
  { name: 'Mi Perfil',    href: '/dashboard/perfil',    icon: User       },
]

export default function DashboardSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <>
      {/* Botón Hamburger para Móviles */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="md:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-md shadow-sm border border-slate-200 text-slate-600"
      >
        {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>

      {/* Overlay oscuro para móviles */}
      {isOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-slate-900/20 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed md:static inset-y-0 left-0 z-40
        w-64 bg-white border-r border-slate-200
        transform transition-transform duration-300 ease-in-out
        flex flex-col
        ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* Logo + link al sitio web */}
        <div className="flex flex-col border-b border-slate-100">
          <div className="h-16 flex items-center justify-center px-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-slate-900 text-white flex items-center justify-center font-bold text-lg rounded-md">
                P
              </div>
              <span className="text-xl font-bold text-slate-900 tracking-tight">PLURALL</span>
            </div>
          </div>
          <a
            href="https://plurall.co"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 py-2 px-4 bg-orange-50 hover:bg-orange-100
                       text-orange-600 text-xs font-semibold transition-colors border-t border-orange-100"
          >
            <Globe className="w-3.5 h-3.5" />
            Conoce más sobre Plurall
          </a>
        </div>

        {/* Navegación */}
        <div className="flex-1 py-6 px-4 flex flex-col gap-2">
          {navigation.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200
                  ${isActive 
                    ? 'bg-orange-50 text-orange-600 font-semibold' 
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                  }
                `}
              >
                <item.icon className={`h-5 w-5 ${isActive ? 'text-orange-500' : 'text-slate-400'}`} />
                {item.name}
              </Link>
            )
          })}
        </div>

        {/* Botón Cerrar Sesión */}
        <div className="p-4 border-t border-slate-100">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-slate-500 hover:bg-red-50 hover:text-red-600 transition-all duration-200"
          >
            <LogOut className="h-5 w-5" />
            <span className="font-medium">Cerrar sesión</span>
          </button>
        </div>
      </div>
    </>
  )
}
