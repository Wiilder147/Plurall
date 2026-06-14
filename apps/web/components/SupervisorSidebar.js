'use client'

/* ==========================================================================
 * ARCHIVO: SupervisorSidebar.js
 * RUTA: apps/web/components/SupervisorSidebar.js
 * DESCRIPCIÓN: Barra lateral de navegación del panel de SUPERVISOR.
 * FUNCIONALIDAD: Menú de navegación para el rol de supervisor.
 *                Usa color INDIGO (azul violáceo) como identidad visual del supervisor.
 * ========================================================================== */

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, Users, CreditCard, FileText, Gauge,
  ClipboardCheck, XCircle, CalendarClock, Banknote, Bell, MessageSquare,
  LogOut, Menu, X, ArrowLeft,
} from 'lucide-react'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import ThemeToggle from './ThemeToggle'

// LISTA DE RUTAS DEL MENÚ SUPERVISOR — para agregar ruta nueva:
// { name: 'Mi Sección', href: '/supervisor/mi-ruta', icon: IconName }
// Módulos del rol SUPERVISOR (analista de crédito): acceso a gestión de
// usuarios, créditos, documentación, puntaje, aprobación, desembolso y más.
const navigation = [
  { name: 'Panel',                href: '/supervisor',                  icon: LayoutDashboard },
  { name: 'Gestión de usuarios',  href: '/supervisor/clientes',         icon: Users           },
  { name: 'Gestión de créditos',  href: '/supervisor/creditos',         icon: CreditCard      },
  { name: 'Documentación',        href: '/supervisor/documentos',       icon: FileText        },
  { name: 'Puntaje crediticio',   href: '/supervisor/puntaje',          icon: Gauge           },
  { name: 'Aprobación de crédito',href: '/supervisor/solicitudes',      icon: ClipboardCheck  },
  { name: 'Motivos de rechazo',   href: '/supervisor/motivos-rechazo',  icon: XCircle         },
  { name: 'Amortización',         href: '/supervisor/amortizacion',     icon: CalendarClock   },
  { name: 'Desembolso',           href: '/supervisor/desembolsos',      icon: Banknote        },
  { name: 'Notificaciones',       href: '/supervisor/notificaciones',   icon: Bell            },
  { name: 'PQR',                  href: '/supervisor/pqr',              icon: MessageSquare   },
]

export default function SupervisorSidebar({ esAdmin = false }) {
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
      {/* BOTÓN HAMBURGUESA (solo móvil)
          COLOR DE FONDO: bg-indigo-900 (azul violáceo oscuro — color identidad supervisor)
          Para cambiar: bg-purple-900, bg-violet-900
          COLOR ÍCONO: text-white, TAMAÑO: p-2, ÍCONO: h-6 w-6 (24x24px) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="md:hidden fixed top-4 left-4 z-50 p-2 bg-indigo-900 rounded-md shadow text-white"
      >
        {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>

      {/* OVERLAY — bg-slate-900/40 (negro 40% opacidad) */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 bg-slate-900/40 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* ────────────────────────────────────────────────────────────────────────
          SIDEBAR SUPERVISOR — usa INDIGO (azul violáceo) como color principal
          COLOR DE FONDO: bg-indigo-950 (indigo muy oscuro, casi negro)
          Para cambiar TODO el tema: reemplaza indigo por purple, violet, blue, etc.
          BORDE DERECHO: border-r border-indigo-900 (línea indigo oscura)
          ANCHO: w-64 (256px)
          ──────────────────────────────────────────────────────────────────────── */}
      <div className={`
        fixed md:static inset-y-0 left-0 z-40
        w-64 bg-indigo-950 border-r border-indigo-900
        transform transition-transform duration-300 ease-in-out
        flex flex-col
        ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>

        {/* ── SECCIÓN LOGO ──
            ALTURA: h-20 (80px)
            BORDE INFERIOR: border-b border-indigo-900 */}
        <div className="h-20 flex items-center justify-center border-b border-indigo-900 px-6">
          <div className="flex items-center gap-2">
            {/* CUADRADO LOGO "P"
                COLOR DE FONDO: bg-indigo-500 (indigo medio — para cambiar: bg-purple-500, bg-violet-500)
                TAMAÑO: w-8 h-8 (32x32px), BORDES: rounded-md (6px) */}
            <div className="w-8 h-8 bg-indigo-500 text-white flex items-center justify-center font-bold text-lg rounded-md">P</div>
            <div className="flex flex-col leading-none">
              {/* NOMBRE "PLURALL" — text-white (blanco), text-base (16px), font-bold */}
              <span className="text-white font-bold text-base tracking-tight">PLURALL</span>
              {/* SUBTÍTULO "Supervisor"
                  COLOR: text-indigo-400 (indigo claro)
                  Para cambiar: text-purple-400, text-violet-400
                  TAMAÑO: text-xs (12px) */}
              <span className="text-indigo-400 text-xs font-medium">Supervisor</span>
            </div>
          </div>
        </div>

        {/* ── ZONA DE NAVEGACIÓN ──
            overflow-y-auto — permite scroll si hay demasiados items
            ESPACIO ENTRE ITEMS: gap-1 (4px)
            PADDING: py-6 px-4 */}
        <div className="flex-1 py-6 px-4 flex flex-col gap-1 overflow-y-auto">
          {/* Enlace de retorno al panel Admin — solo visible para el ADMIN */}
          {esAdmin && (
            <Link href="/admin" onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 px-4 py-3 mb-2 rounded-xl text-sm bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 font-semibold transition-all">
              <ArrowLeft className="h-4 w-4" /> Volver a Admin
            </Link>
          )}
          {navigation.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== '/supervisor' && pathname.startsWith(item.href))
            return (
              // ENLACE DE NAVEGACIÓN SUPERVISOR
              // ESTADO ACTIVO: bg-indigo-500/20 text-indigo-300 font-semibold
              //   (fondo indigo muy transparente, texto indigo claro)
              //   Para cambiar COLOR ACTIVO: reemplaza 'bg-indigo-500/20 text-indigo-300'
              // ESTADO INACTIVO: text-indigo-300/60 hover:bg-indigo-900 hover:text-indigo-200
              //   (indigo semi-transparente, hover fondo indigo muy oscuro)
              // TAMAÑO FUENTE: text-sm (14px)
              // PADDING: px-4 py-3, BORDES: rounded-xl (12px)
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
                {/* ÍCONO — h-4 w-4 (16x16px)
                    COLOR ACTIVO: text-indigo-400 (indigo claro)
                    COLOR INACTIVO: text-indigo-500/60 (indigo semi-transparente) */}
                <item.icon className={`h-4 w-4 ${isActive ? 'text-indigo-400' : 'text-indigo-500/60'}`} />
                {item.name}
              </Link>
            )
          })}
        </div>

        {/* ── SECCIÓN INFERIOR: CERRAR SESIÓN + TOGGLE TEMA ──
            BORDE: border-t border-indigo-900
            PADDING: p-4 (16px) */}
        <div className="p-4 border-t border-indigo-900 flex items-center gap-2">
          {/* BOTÓN CERRAR SESIÓN
              COLOR EN REPOSO: text-indigo-400/60 (indigo semi-transparente)
              HOVER: hover:bg-red-900/30 hover:text-red-400 (rojo al hover)
              TAMAÑO FUENTE: text-sm (14px), ÍCONO: h-4 w-4 (16x16px) */}
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 flex-1 rounded-xl text-indigo-400/60 hover:bg-red-900/30 hover:text-red-400 transition-all text-sm"
          >
            <LogOut className="h-4 w-4" />
            <span className="font-medium">Cerrar sesión</span>
          </button>
          {/* TOGGLE TEMA — componente ThemeToggle.js */}
          <ThemeToggle />
        </div>
      </div>
    </>
  )
}
