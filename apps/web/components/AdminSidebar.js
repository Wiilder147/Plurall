'use client'

/* ==========================================================================
 * ARCHIVO: AdminSidebar.js
 * RUTA: apps/web/components/AdminSidebar.js
 * DESCRIPCIÓN: Barra lateral de navegación del panel de ADMINISTRADOR.
 * FUNCIONALIDAD: Menú de navegación para el rol admin. Fondo oscuro (slate-900).
 *                Incluye toggle de tema (claro/oscuro) en la parte inferior.
 * ========================================================================== */

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, ClipboardList, Users, LogOut, Menu, X, BarChart3, ShieldCheck, Headset, UserCircle } from 'lucide-react'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import ThemeToggle from './ThemeToggle'

// LISTA DE RUTAS DEL MENÚ ADMIN — para agregar una ruta nueva:
// { name: 'Mi Sección', href: '/admin/mi-ruta', icon: IconName }
// El ADMIN (gerente del proyecto) tiene ACCESO TOTAL: sus propios módulos
// de gestión más accesos directos a los paneles de Supervisor, Asesor y Usuario.
const navigation = [
  { name: 'Panel',            href: '/admin',             icon: LayoutDashboard },
  { name: 'Solicitudes',      href: '/admin/solicitudes', icon: ClipboardList   },
  { name: 'Clientes',         href: '/admin/clientes',    icon: Users           },
  { name: 'Reportes',         href: '/admin/reportes',    icon: BarChart3       },
  // ── Accesos a los demás paneles (acceso total) ──
  { name: 'Panel Supervisor', href: '/supervisor',        icon: ShieldCheck     },
  { name: 'Panel Asesor',     href: '/asesor',            icon: Headset         },
  { name: 'Vista Usuario',    href: '/dashboard/inicio',  icon: UserCircle      },
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
      {/* BOTÓN HAMBURGUESA (solo en móvil — md:hidden lo oculta en tablet/desktop)
          POSICIÓN: fixed top-4 left-4 (esquina superior izquierda)
          COLOR DE FONDO: bg-slate-900 (gris muy oscuro — para cambiar: bg-navy-900, bg-gray-900)
          COLOR ÍCONO: text-white (blanco)
          TAMAÑO: p-2 (padding 8px), rounded-md (bordes 6px)
          ÍCONO: h-6 w-6 (24x24px) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="md:hidden fixed top-4 left-4 z-50 p-2 bg-slate-900 rounded-md shadow text-white"
      >
        {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>

      {/* OVERLAY OSCURO AL ABRIR EN MÓVIL
          COLOR: bg-slate-900/40 (casi negro con 40% opacidad) */}
      {isOpen && (
        <div className="md:hidden fixed inset-0 bg-slate-900/40 z-40" onClick={() => setIsOpen(false)} />
      )}

      {/* ────────────────────────────────────────────────────────────────────────
          SIDEBAR ADMIN — fondo oscuro diferenciado del dashboard del cliente
          COLOR DE FONDO: bg-slate-900 (gris muy oscuro — para cambiar: bg-gray-900, bg-zinc-900)
          BORDE DERECHO: border-r border-slate-800 (línea gris oscura)
          ANCHO: w-64 (256px — para más ancho: w-72=288px)
          ──────────────────────────────────────────────────────────────────────── */}
      <div className={`
        fixed md:static inset-y-0 left-0 z-40
        w-64 bg-slate-900 border-r border-slate-800
        transform transition-transform duration-300 ease-in-out
        flex flex-col
        ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>

        {/* ── SECCIÓN LOGO ──
            ALTURA: h-20 (80px — más alto que el dashboard del cliente que usa h-16)
            BORDE INFERIOR: border-b border-slate-800 (línea gris oscura) */}
        <div className="h-20 flex items-center justify-center border-b border-slate-800 px-6">
          <div className="flex items-center gap-2">
            {/* CUADRADO LOGO "P"
                COLOR DE FONDO: bg-orange-500 (naranja — diferente al dashboard blanco)
                TAMAÑO: w-8 h-8 (32x32px)
                BORDES: rounded-md (6px) */}
            <div className="w-8 h-8 bg-orange-500 text-white flex items-center justify-center font-bold text-lg rounded-md">P</div>
            <div className="flex flex-col leading-none">
              {/* NOMBRE "PLURALL"
                  COLOR: text-white (blanco — sobre fondo oscuro)
                  TAMAÑO: text-base (16px), font-bold (negrita) */}
              <span className="text-white font-bold text-base tracking-tight">PLURALL</span>
              {/* SUBTÍTULO "Panel Admin"
                  COLOR: text-orange-400 (naranja claro)
                  TAMAÑO: text-xs (12px), font-medium */}
              <span className="text-orange-400 text-xs font-medium">Panel Admin</span>
            </div>
          </div>
        </div>

        {/* ── ZONA DE NAVEGACIÓN ──
            ESPACIO ENTRE ITEMS: gap-1 (4px — más compacto que el dashboard)
            PADDING: py-6 px-4 (24px vertical, 16px horizontal) */}
        <div className="flex-1 py-6 px-4 flex flex-col gap-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href))
            return (
              // ENLACE DE NAVEGACIÓN ADMIN
              // ESTADO ACTIVO: bg-orange-500/10 text-orange-400 font-semibold
              //   (fondo naranja muy transparente, texto naranja)
              // ESTADO INACTIVO: text-slate-400 hover:bg-slate-800 hover:text-slate-200
              //   (gris claro, hover fondo gris oscuro)
              // Para cambiar COLOR ACTIVO: reemplaza 'bg-orange-500/10 text-orange-400'
              // TAMAÑO DE FUENTE: text-sm (14px)
              // PADDING: px-4 py-3 (16px horizontal, 12px vertical)
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
                {/* ÍCONO — h-4 w-4 (16x16px — más pequeño que dashboard que usa h-5 w-5)
                    COLOR ACTIVO: text-orange-400 (naranja claro)
                    COLOR INACTIVO: text-slate-500 (gris oscuro) */}
                <item.icon className={`h-4 w-4 ${isActive ? 'text-orange-400' : 'text-slate-500'}`} />
                {item.name}
              </Link>
            )
          })}
        </div>

        {/* ── SECCIÓN INFERIOR: CERRAR SESIÓN + TOGGLE TEMA ──
            BORDE: border-t border-slate-800 (línea gris oscura)
            PADDING: p-4 (16px) */}
        <div className="p-4 border-t border-slate-800 flex items-center gap-2">
          {/* BOTÓN CERRAR SESIÓN
              COLOR EN REPOSO: text-slate-400 (gris claro)
              HOVER: hover:bg-red-900/30 hover:text-red-400
              (fondo rojo oscuro muy transparente, texto rojo claro)
              TAMAÑO FUENTE: text-sm (14px)
              ÍCONO: h-4 w-4 (16x16px) */}
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 flex-1 rounded-xl text-slate-400 hover:bg-red-900/30 hover:text-red-400 transition-all text-sm"
          >
            <LogOut className="h-4 w-4" />
            <span className="font-medium">Cerrar sesión</span>
          </button>
          {/* TOGGLE TEMA (claro/oscuro) — componente ThemeToggle.js */}
          <ThemeToggle />
        </div>
      </div>
    </>
  )
}
