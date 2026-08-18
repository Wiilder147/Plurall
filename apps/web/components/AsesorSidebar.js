'use client'

/* ==========================================================================
 * ARCHIVO: AsesorSidebar.js
 * RUTA: apps/web/components/AsesorSidebar.js
 * DESCRIPCIÓN: Barra lateral de navegación del panel de ASESOR.
 * FUNCIONALIDAD: Menú de navegación para el rol de asesor de cobranza.
 *                Usa color TEAL (verde azulado) como identidad visual del asesor.
 * ========================================================================== */

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, Users, CreditCard, FileText,
  Bell, CalendarClock, MessageSquare, XCircle, CheckCircle2,
  Menu, X, ArrowLeft, AlertTriangle, PhoneCall,
  ClipboardList, Wallet,
} from 'lucide-react'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import SidebarFooter from './SidebarFooter'
import BuscadorClientes from './BuscadorClientes'

// LISTA DE RUTAS DEL MENÚ ASESOR
const navigation = [
  { name: 'Mi Panel',             href: '/asesor',                 icon: LayoutDashboard },
  { name: 'Clientes',             href: '/asesor/clientes',        icon: Users           },
  { name: 'Créditos',             href: '/asesor/creditos',        icon: CreditCard      },
  { name: 'Solicitudes',          href: '/asesor/solicitudes',     icon: ClipboardList   },
  { name: 'Cobranza',             href: '/asesor/cobranza',        icon: AlertTriangle   },
  { name: 'Gestiones',            href: '/asesor/gestiones',       icon: PhoneCall       },
  { name: 'Pagos en efectivo',    href: '/asesor/pagos',           icon: Wallet          },
  { name: 'Documentación',        href: '/asesor/documentos',      icon: FileText        },
  { name: 'Preaprobación',        href: '/asesor/preaprobacion',   icon: CheckCircle2    },
  { name: 'Motivos de rechazo',   href: '/asesor/motivos-rechazo', icon: XCircle         },
  { name: 'Amortización',         href: '/asesor/amortizacion',    icon: CalendarClock   },
  { name: 'Notificaciones',       href: '/asesor/notificaciones',  icon: Bell            },
  { name: 'PQR',                  href: '/asesor/pqr',             icon: MessageSquare   },
]

export default function AsesorSidebar({ esAdmin = false }) {
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
          COLOR DE FONDO: bg-teal-900 (verde azulado muy oscuro — color identidad asesor)
          Para cambiar: bg-green-900, bg-cyan-900
          COLOR ÍCONO: text-white, TAMAÑO: p-2, ÍCONO: h-6 w-6 (24x24px) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="md:hidden fixed top-4 left-4 z-50 p-2 bg-teal-900 rounded-md shadow text-white"
      >
        {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>

      {/* OVERLAY — bg-slate-900/40 (negro 40% opacidad) */}
      {isOpen && (
        <div className="md:hidden fixed inset-0 bg-slate-900/40 z-40" onClick={() => setIsOpen(false)} />
      )}

      {/* ────────────────────────────────────────────────────────────────────────
          SIDEBAR ASESOR — usa TEAL (verde azulado) como color principal
          COLOR DE FONDO: bg-teal-950 (teal muy oscuro, casi negro)
          Para cambiar TODO el tema: reemplaza teal por cyan, green, emerald, etc.
          BORDE DERECHO: border-r border-teal-900 (línea teal oscura)
          ANCHO: w-64 (256px)
          ──────────────────────────────────────────────────────────────────────── */}
      <div className={`
        fixed md:static inset-y-0 left-0 z-40
        w-64 max-w-[85vw] bg-teal-950 border-r border-teal-900
        transform transition-transform duration-300 ease-in-out
        flex flex-col overflow-hidden
        ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>

        {/* ── SECCIÓN LOGO ──
            ALTURA: h-20 (80px)
            BORDE INFERIOR: border-b border-teal-900 */}
        <div className="h-20 flex items-center justify-center border-b border-teal-900 px-6">
          <div className="flex items-center gap-2">
            {/* CUADRADO LOGO "P"
                COLOR DE FONDO: bg-teal-500 (teal/verde azulado medio)
                Para cambiar: bg-green-500, bg-cyan-500
                TAMAÑO: w-8 h-8 (32x32px), BORDES: rounded-md (6px) */}
            <div className="w-8 h-8 bg-teal-500 text-white flex items-center justify-center font-bold text-lg rounded-md">P</div>
            <div className="flex flex-col leading-none">
              {/* NOMBRE "PLURALL" — text-white (blanco), text-base (16px) */}
              <span className="text-white font-bold text-base tracking-tight">PLURALL</span>
              {/* SUBTÍTULO "Asesor"
                  COLOR: text-teal-400 (teal claro — para cambiar: text-green-400, text-cyan-400)
                  TAMAÑO: text-xs (12px) */}
              <span className="text-teal-400 text-xs font-medium">Asesor</span>
            </div>
          </div>
        </div>

        {/* ── ZONA DE NAVEGACIÓN ──
            overflow-y-auto — scroll si hay demasiados items
            ESPACIO ENTRE ITEMS: gap-1 (4px)
            PADDING: py-6 px-4 */}
        <div className="px-4 pt-4">
          <BuscadorClientes basePath="/asesor/clientes" accent="teal" onNavigate={() => setIsOpen(false)} placeholder="Buscar mi cliente…" />
        </div>
        <div className="flex-1 min-h-0 py-4 px-4 flex flex-col gap-1 overflow-y-auto">
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
              (item.href !== '/asesor' && pathname.startsWith(item.href))
            return (
              // ENLACE DE NAVEGACIÓN ASESOR
              // ESTADO ACTIVO: bg-teal-500/20 text-teal-300 font-semibold
              //   (fondo teal muy transparente, texto teal claro)
              //   Para cambiar COLOR ACTIVO: reemplaza 'bg-teal-500/20 text-teal-300'
              // ESTADO INACTIVO: text-teal-300/60 hover:bg-teal-900 hover:text-teal-200
              //   (teal semi-transparente, hover fondo teal muy oscuro)
              // TAMAÑO FUENTE: text-sm (14px)
              <Link key={item.name} href={item.href} onClick={() => setIsOpen(false)}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-sm
                  ${isActive
                    ? 'bg-teal-500/20 text-teal-300 font-semibold'
                    : 'text-teal-300/60 hover:bg-teal-900 hover:text-teal-200'}
                `}>
                {/* ÍCONO — h-4 w-4 (16x16px)
                    COLOR ACTIVO: text-teal-400 (teal claro)
                    COLOR INACTIVO: text-teal-500/60 (teal semi-transparente) */}
                <item.icon className={`h-4 w-4 ${isActive ? 'text-teal-400' : 'text-teal-500/60'}`} />
                {item.name}
              </Link>
            )
          })}
        </div>

        {/* ── SECCIÓN INFERIOR: CERRAR SESIÓN + TOGGLE TEMA ──
            BORDE: border-t border-teal-900
            PADDING: p-4 (16px) */}
        <SidebarFooter
          onLogout={handleLogout}
          accent="teal"
          notificationHref="/asesor/notificaciones"
        />
      </div>
    </>
  )
}
