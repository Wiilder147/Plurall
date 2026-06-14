'use client'

/* ==========================================================================
 * ARCHIVO: DashboardSidebar.js
 * RUTA: apps/web/components/DashboardSidebar.js
 * DESCRIPCIÓN: Barra lateral de navegación del panel del CLIENTE (usuario final).
 * FUNCIONALIDAD: Contiene los enlaces de navegación para el rol de cliente.
 *                En móvil se muestra como menú hamburguesa (oculto por defecto).
 * ========================================================================== */

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Home, User, LogOut, Menu, X, CreditCard, FileText, DollarSign, Bell, MessageSquare, HelpCircle, Globe, ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// LISTA DE RUTAS DEL MENÚ — aquí se definen los enlaces que aparecen en la barra lateral
// Para agregar una sección: agrega { name: 'Mi Sección', href: '/dashboard/mi-ruta', icon: IconName }
// Módulos del USUARIO (cliente): su crédito, su usuario, documentación, plan
// de pagos, notificaciones, PQR y ayuda.
const navigation = [
  { name: 'Inicio',        href: '/dashboard/inicio',       icon: Home          },
  { name: 'Mi Crédito',    href: '/dashboard/creditos',     icon: CreditCard    },
  { name: 'Plan de Pagos', href: '/dashboard/cuotas',       icon: DollarSign    },
  { name: 'Documentación', href: '/dashboard/documentos',   icon: FileText      },
  { name: 'Notificaciones',href: '/dashboard/notificaciones',icon: Bell         },
  { name: 'PQR',           href: '/dashboard/pqr',          icon: MessageSquare },
  { name: 'Ayuda',         href: '/dashboard/ayuda',        icon: HelpCircle    },
  { name: 'Mi Usuario',    href: '/dashboard/perfil',       icon: User          },
]

export default function DashboardSidebar({ esAdmin = false }) {
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
      {/* ────────────────────────────────────────────────────────────────────────
          BOTÓN HAMBURGUESA (solo visible en móvil — md:hidden lo oculta en desktop)
          POSICIÓN: fixed top-4 left-4 (esquina superior izquierda, 16px de margen)
          Z-INDEX: z-50 (encima de todo)
          COLOR DE FONDO: bg-white (blanco — para oscuro: bg-slate-900)
          BORDE: rounded-md border border-slate-200 (redondeado, borde gris claro)
          COLOR ÍCONO: text-slate-600 (gris medio)
          TAMAÑO DEL ÍCONO: h-6 w-6 (24x24px)
          ──────────────────────────────────────────────────────────────────────── */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="md:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-md shadow-sm border border-slate-200 text-slate-600"
      >
        {/* ÍCONO: X cuando está abierto, Menu cuando está cerrado */}
        {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>

      {/* OVERLAY OSCURO (solo móvil, cuando el menú está abierto)
          COLOR: bg-slate-900/20 (gris muy oscuro con 20% opacidad)
          Para más oscuro: bg-slate-900/50, bg-black/40 */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 bg-slate-900/20 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* ────────────────────────────────────────────────────────────────────────
          SIDEBAR PRINCIPAL
          ANCHO: w-64 (256px — para más ancho: w-72=288px, w-80=320px)
          COLOR DE FONDO: bg-white (blanco — para oscuro como admin: bg-slate-900)
          BORDE DERECHO: border-r border-slate-200 (línea gris claro a la derecha)
          ANIMACIÓN: transform transition-transform duration-300 ease-in-out
          En móvil se desliza desde la izquierda (-translate-x-full = oculto, translate-x-0 = visible)
          ──────────────────────────────────────────────────────────────────────── */}
      <div className={`
        fixed md:static inset-y-0 left-0 z-40
        w-64 bg-white border-r border-slate-200
        transform transition-transform duration-300 ease-in-out
        flex flex-col
        ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>

        {/* ── SECCIÓN DEL LOGO (parte superior del sidebar) ──
            BORDE INFERIOR: border-b border-slate-100 (línea divisoria gris muy claro) */}
        <div className="flex flex-col border-b border-slate-100">

          {/* CONTENEDOR LOGO Y NOMBRE
              ALTURA: h-16 (64px — para más alto: h-20=80px)
              PADDING HORIZONTAL: px-6 (24px) */}
          <div className="h-16 flex items-center justify-center px-6">
            <div className="flex items-center gap-2">
              {/* CUADRADO LOGO "P"
                  COLOR DE FONDO: bg-slate-900 (gris muy oscuro, casi negro)
                  Para cambiar: bg-orange-500 (naranja), bg-blue-900 (azul oscuro)
                  TAMAÑO: w-8 h-8 (32x32px)
                  BORDES: rounded-md (redondeado, 6px) */}
              <div className="w-8 h-8 bg-slate-900 text-white flex items-center justify-center font-bold text-lg rounded-md">
                P
              </div>
              {/* NOMBRE "PLURALL"
                  COLOR: text-slate-900 (casi negro)
                  TAMAÑO: text-xl (20px), font-bold (negrita) */}
              <span className="text-xl font-bold text-slate-900 tracking-tight">PLURALL</span>
            </div>
          </div>

          {/* BANNER "Conoce más sobre Plurall" (enlace externo naranja debajo del logo)
              COLOR DE FONDO: bg-orange-50 (naranja muy claro), hover:bg-orange-100 (un poco más)
              COLOR DE TEXTO: text-orange-600 (naranja medio)
              BORDE SUPERIOR: border-t border-orange-100 (línea naranja muy clara)
              PADDING: py-2 px-4 (8px vertical, 16px horizontal)
              TAMAÑO TEXTO: text-xs (12px), font-semibold (semi-negrita)
              TAMAÑO ÍCONO: w-3.5 h-3.5 (14x14px) */}
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

        {/* ── ZONA DE NAVEGACIÓN (enlaces del menú) ──
            PADDING VERTICAL: py-6 (24px arriba/abajo)
            PADDING HORIZONTAL: px-4 (16px lados)
            ESPACIO ENTRE ITEMS: gap-2 (8px) */}
        <div className="flex-1 py-6 px-4 flex flex-col gap-2">
          {/* Retorno al panel Admin — solo visible cuando navega el ADMIN */}
          {esAdmin && (
            <Link href="/admin" onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 px-4 py-3 mb-1 rounded-xl bg-orange-50 text-orange-600 hover:bg-orange-100 font-semibold transition-all">
              <ArrowLeft className="h-5 w-5" /> Volver a Admin
            </Link>
          )}
          {navigation.map((item) => {
            const isActive = pathname === item.href
            return (
              // ENLACE DE NAVEGACIÓN
              // ESTADO ACTIVO: bg-orange-50 text-orange-600 font-semibold (fondo naranja claro, texto naranja)
              // ESTADO INACTIVO: text-slate-500 hover:bg-slate-50 hover:text-slate-900 (gris, hover blanco grisáceo)
              // PADDING: px-4 py-3 (16px horizontal, 12px vertical — para más altura: py-4=16px)
              // BORDES: rounded-xl (12px redondeados)
              // Para cambiar el COLOR ACTIVO: cambia 'bg-orange-50 text-orange-600' por ej. 'bg-blue-50 text-blue-600'
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
                {/* ÍCONO DEL ENLACE
                    TAMAÑO: h-5 w-5 (20x20px — para más grande: h-6 w-6=24px)
                    COLOR ACTIVO: text-orange-500 (naranja)
                    COLOR INACTIVO: text-slate-400 (gris claro) */}
                <item.icon className={`h-5 w-5 ${isActive ? 'text-orange-500' : 'text-slate-400'}`} />
                {item.name}
              </Link>
            )
          })}
        </div>

        {/* ── SECCIÓN INFERIOR: BOTÓN CERRAR SESIÓN ──
            BORDE SUPERIOR: border-t border-slate-100 (línea divisoria)
            PADDING: p-4 (16px en todos lados) */}
        <div className="p-4 border-t border-slate-100 flex items-center gap-2">
          {/* BOTÓN CERRAR SESIÓN
              COLOR EN REPOSO: text-slate-500 (gris medio)
              HOVER: hover:bg-red-50 hover:text-red-600 (fondo rojo muy claro, texto rojo)
              Para cambiar el COLOR HOVER: cambia 'hover:bg-red-50 hover:text-red-600'
              PADDING: px-4 py-3 (16px horizontal, 12px vertical)
              BORDES: rounded-xl (12px)
              ÍCONO: h-5 w-5 (20x20px) */}
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 flex-1 rounded-xl text-slate-500 hover:bg-red-50 hover:text-red-600 transition-all duration-200"
          >
            <LogOut className="h-5 w-5" />
            <span className="font-medium">Cerrar sesión</span>
          </button>
        </div>
      </div>
    </>
  )
}
