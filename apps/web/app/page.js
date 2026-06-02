/* ==========================================================================
 * ARCHIVO: page.js
 * RUTA: apps/web/app/page.js
 * DESCRIPCIÓN: Página de inicio (landing page) pública de PLURALL.
 * FUNCIONALIDAD: Página de marketing con hero, beneficios, pasos y CTA final.
 *                Incluye el modal del embudo de pre-calificación (CreditFunnelModal).
 * ========================================================================== */
'use client'

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronRight, Shield, Clock, Smartphone, TrendingUp, CheckCircle2, ArrowRight, Star } from "lucide-react";
import CreditFunnelModal from "@/components/CreditFunnelModal";

export default function HomePage() {
  const [funnelOpen, setFunnelOpen] = useState(false)

  return (
    // CONTENEDOR PRINCIPAL DE LA LANDING
    // COLOR DE FONDO: bg-white (blanco puro — para cambiar: bg-slate-50, bg-gray-50)
    // COLOR DE TEXTO BASE: text-navy-900 (azul muy oscuro)
    // overflow-x-hidden — evita scroll horizontal por elementos decorativos
    <main className="min-h-screen bg-white text-navy-900 overflow-x-hidden font-sans">

      {/* ════════════════════════════════════════════════════════════════════
          NAVBAR (barra de navegación)
          POSICIÓN: sticky top-0 (se queda pegada arriba al hacer scroll)
          Z-INDEX: z-50 (encima de todo el contenido)
          COLOR DE FONDO: bg-white/80 (blanco 80% opacidad con desenfoque)
          BORDE INFERIOR: border-b border-slate-100 (línea gris muy clara)
          EFECTO: backdrop-blur-xl (desenfoque intenso del contenido detrás)
          ════════════════════════════════════════════════════════════════════ */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-100">
        <div className="w-full max-w-7xl mx-auto flex items-center justify-between px-6 lg:px-12 py-4">

          {/* LOGO PLURALL
              CUADRADO LOGO: bg-navy-900 (azul muy oscuro)
              TAMAÑO: w-9 h-9 (36x36px), BORDES: rounded-lg (8px)
              NOMBRE: text-xl (20px), font-bold, text-navy-900
              hidden sm:block — el nombre se oculta en móvil */}
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-navy-900 rounded-lg flex items-center justify-center">
              <span className="text-white font-extrabold text-lg">P</span>
            </div>
            <span className="text-xl font-bold tracking-tight text-navy-900 hidden sm:block">PLURALL</span>
          </Link>

          {/* ENLACES CENTRALES (solo en desktop — hidden md:flex)
              COLOR: text-slate-500 (gris), hover:text-navy-900 (oscuro al hover)
              TAMAÑO: text-sm (14px), font-medium
              ESPACIO: gap-8 (32px entre enlaces) */}
          <div className="hidden md:flex items-center gap-8">
            <Link href="#beneficios" className="text-slate-500 hover:text-navy-900 font-medium text-sm transition-colors">Beneficios</Link>
            <Link href="#como-funciona" className="text-slate-500 hover:text-navy-900 font-medium text-sm transition-colors">Cómo funciona</Link>
            <Link href="#" className="text-slate-500 hover:text-navy-900 font-medium text-sm transition-colors">Productos</Link>
            <Link href="#" className="text-slate-500 hover:text-navy-900 font-medium text-sm transition-colors">Recursos</Link>
          </div>

          {/* BOTONES CTA DERECHA */}
          <div className="flex items-center gap-3">
            {/* ENLACE "Iniciar Sesión" — solo en sm+, color text-slate-600 */}
            <Link href="/login" className="text-slate-600 hover:text-navy-900 font-semibold text-sm transition-colors hidden sm:block">
              Iniciar Sesión
            </Link>
            {/* BOTÓN "INGRESA" (CTA principal del navbar)
                COLOR DE FONDO: bg-accent-500 (naranja/acento — definido en tailwind.config)
                hover: bg-accent-600 (más oscuro al hover)
                COLOR TEXTO: text-white (blanco)
                PADDING: py-2.5 (10px vertical), px-6 (24px horizontal)
                BORDES: rounded-full (completamente ovalado — pill shape)
                TAMAÑO: text-sm (14px), font-bold
                SOMBRA: shadow-md shadow-accent-500/20 (sombra naranja suave)
                HOVER: hover:scale-105 (crece 5%) */}
            <Link href="/login" className="bg-accent-500 hover:bg-accent-600 text-white font-bold py-2.5 px-6 rounded-full text-sm transition-all hover:scale-105 shadow-md shadow-accent-500/20">
              INGRESA
            </Link>
          </div>
        </div>
      </nav>

      {/* ════════════════════════════════════════════════════════════════════
          SECCIÓN HERO (primera sección visible)
          FONDO: degradado sutil from-slate-50 via-white to-orange-50/30
          ════════════════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden">
        {/* DEGRADADO DE FONDO */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-orange-50/30"></div>
        {/* BOLA DECORATIVA SUPERIOR DERECHA — naranja 5% */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-accent-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4"></div>
        {/* BOLA DECORATIVA INFERIOR IZQUIERDA — azul oscuro 5% */}
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-navy-900/5 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4"></div>

        <div className="relative w-full max-w-7xl mx-auto px-6 lg:px-12 py-16 lg:py-24">
          <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">

            {/* COLUMNA IZQUIERDA: TEXTO HERO */}
            <div className="w-full lg:w-1/2 flex flex-col items-center text-center lg:items-start lg:text-left animate-fade-in">

              {/* BADGE SUPERIOR
                  COLOR FONDO: bg-accent-50 (naranja muy claro)
                  BORDE: border border-accent-200 (naranja claro)
                  COLOR TEXTO: text-accent-700 (naranja oscuro)
                  PADDING: px-4 py-1.5, BORDES: rounded-full
                  TAMAÑO: text-xs (12px), font-semibold
                  ÍCONO ESTRELLA: fill-accent-500 text-accent-500 (naranja sólido) */}
              <div className="inline-flex items-center gap-2 bg-accent-50 border border-accent-200 text-accent-700 px-4 py-1.5 rounded-full text-xs font-semibold mb-6">
                <Star className="w-3.5 h-3.5 fill-accent-500 text-accent-500" />
                Financiamiento digital para comerciantes colombianos
              </div>

              {/* TÍTULO PRINCIPAL
                  TAMAÑO: text-4xl (36px) móvil, sm:text-5xl (48px), lg:text-6xl (60px), xl:text-7xl (72px)
                  COLOR: text-navy-900 (azul muy oscuro)
                  FUENTE: font-extrabold (extra negrita), leading-[1.1] (interlineado apretado)
                  Para cambiar tamaño: modifica las clases text-X */}
              <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-extrabold text-navy-900 leading-[1.1] tracking-tight">
                Donde tus planes
                {/* COLOR NARANJA para "comienzan a rodar"
                    text-accent-500 (naranja/acento — para cambiar: text-orange-500, text-blue-500) */}
                <span className="block text-accent-500">comienzan a rodar</span>
              </h1>

              {/* PÁRRAFO DESCRIPTIVO
                  COLOR: text-slate-500 (gris), TAMAÑO: text-lg (18px), sm:text-xl (20px)
                  leading-relaxed (interlineado relajado), max-w-lg (ancho máximo 512px) */}
              <p className="mt-6 text-lg sm:text-xl text-slate-500 leading-relaxed max-w-lg">
                Créditos digitales rápidos, transparentes y sin papeleos.
                Todo desde tu celular, aprobación en minutos.
              </p>

              {/* BOTONES HERO */}
              <div className="mt-10 flex flex-col sm:flex-row items-center gap-4">
                {/* BOTÓN "Simula tu Préstamo" (abre el modal del funnel)
                    COLOR FONDO: bg-accent-500 (naranja), hover:bg-accent-600 (más oscuro)
                    COLOR TEXTO: text-white
                    PADDING: px-8 (32px horizontal), py-4 (16px vertical)
                    BORDES: rounded-full (completamente ovalado)
                    TAMAÑO: text-lg (18px), font-bold
                    SOMBRA: shadow-xl shadow-accent-500/25 (sombra naranja grande)
                    HOVER: hover:scale-105 (crece 5%)
                    ÍCONO: w-5 h-5 (20x20px) */}
                <button
                  type="button"
                  onClick={() => setFunnelOpen(true)}
                  className="inline-flex items-center gap-2 bg-accent-500 hover:bg-accent-600 text-white font-bold text-lg px-8 py-4 rounded-full transition-all hover:scale-105 shadow-xl shadow-accent-500/25"
                >
                  Simula tu Préstamo
                  <ArrowRight className="w-5 h-5" />
                </button>

                {/* ENLACE "Ya tengo cuenta"
                    COLOR: text-navy-900 (oscuro), hover:text-accent-600 (naranja al hover)
                    TAMAÑO: text-sm (14px), font-semibold
                    Sin fondo (solo texto con flecha) */}
                <Link href="/login" className="inline-flex items-center gap-2 text-navy-900 hover:text-accent-600 font-semibold text-sm transition-colors">
                  Ya tengo cuenta
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>

              {/* TRUST BADGES (íconos de confianza)
                  COLOR TEXTO: text-slate-400 (gris claro), text-xs (12px), font-medium
                  ESPACIO: gap-6 (24px entre badges) */}
              <div className="mt-10 flex items-center gap-6 text-xs text-slate-400 font-medium">
                <div className="flex items-center gap-1.5">
                  {/* ÍCONO ESCUDO — text-emerald-500 (verde), w-4 h-4 (16x16px) */}
                  <Shield className="w-4 h-4 text-emerald-500" />
                  <span>100% seguro</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {/* ÍCONO RELOJ — text-blue-500 (azul) */}
                  <Clock className="w-4 h-4 text-blue-500" />
                  <span>Aprobación rápida</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {/* ÍCONO CELULAR — text-accent-500 (naranja) */}
                  <Smartphone className="w-4 h-4 text-accent-500" />
                  <span>100% digital</span>
                </div>
              </div>
            </div>

            {/* COLUMNA DERECHA: IMAGEN HERO */}
            <div className="w-full lg:w-1/2 animate-slide-in" style={{ animationDelay: '0.2s' }}>
              <div className="relative">
                {/* MARCO DECORATIVO DETRÁS DE LA IMAGEN — degradado naranja/azul borroso */}
                <div className="absolute -inset-4 bg-gradient-to-br from-accent-500/20 to-navy-900/10 rounded-3xl blur-2xl"></div>
                {/* CONTENEDOR DE IMAGEN
                    BORDES: rounded-2xl (16px), overflow-hidden, shadow-2xl
                    BORDE: border-2 border-white */}
                <div className="relative rounded-2xl overflow-hidden shadow-2xl shadow-navy-900/15 border-2 border-white">
                  {/* IMAGEN HERO — aspect-ratio 4:3
                      Para cambiar la imagen: reemplaza "/hero.png" por otra ruta */}
                  <div className="aspect-[4/3] relative">
                    <Image
                      src="/hero.png"
                      alt="Comerciante colombiana exitosa en su negocio"
                      fill
                      priority
                      className="object-cover object-center"
                    />
                  </div>
                </div>

                {/* TARJETA FLOTANTE INFERIOR IZQUIERDA
                    COLOR FONDO: bg-white (blanco), SOMBRA: shadow-xl
                    BORDE: border border-slate-100, BORDES: rounded-2xl (16px)
                    PADDING: p-4 (16px)
                    hidden sm:flex — oculta en móvil
                    ÍCONO CONTENEDOR: w-10 h-10 (40x40px), bg-emerald-100 (verde muy claro) */}
                <div className="absolute -bottom-6 -left-6 bg-white rounded-2xl shadow-xl border border-slate-100 p-4 animate-fade-in hidden sm:flex items-center gap-3" style={{ animationDelay: '0.6s' }}>
                  <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    {/* ETIQUETA — text-xs (12px), text-slate-400 */}
                    <p className="text-xs text-slate-400 font-medium">Desembolsos este mes</p>
                    {/* MONTO — font-bold, text-navy-900 */}
                    <p className="font-bold text-navy-900">$847.000.000 COP</p>
                  </div>
                </div>

                {/* TARJETA FLOTANTE SUPERIOR DERECHA
                    POSICIÓN: -top-4 -right-4
                    ÍCONO: bg-accent-100 (naranja muy claro), text-accent-600 (naranja) */}
                <div className="absolute -top-4 -right-4 bg-white rounded-2xl shadow-xl border border-slate-100 p-4 animate-fade-in hidden sm:flex items-center gap-3" style={{ animationDelay: '0.8s' }}>
                  <div className="w-10 h-10 bg-accent-100 rounded-xl flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-accent-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 font-medium">Tasa aprobación</p>
                    <p className="font-bold text-navy-900">94.7%</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════
          SECCIÓN BENEFICIOS
          COLOR DE FONDO: bg-slate-50 (gris muy claro)
          BORDE SUPERIOR: border-t border-slate-100
          ════════════════════════════════════════════════════════════════════ */}
      <section id="beneficios" className="bg-slate-50 border-t border-slate-100">
        <div className="w-full max-w-7xl mx-auto px-6 lg:px-12 py-20 lg:py-28">
          <div className="text-center mb-16">
            {/* LABEL SUPERIOR — text-accent-500 (naranja), font-bold, text-sm, uppercase */}
            <span className="text-accent-500 font-bold text-sm uppercase tracking-wider">¿POR QUÉ PLURALL?</span>
            {/* TÍTULO — text-3xl (30px), sm:text-4xl (36px), font-extrabold, text-navy-900 */}
            <h2 className="text-3xl sm:text-4xl font-extrabold text-navy-900 mt-3 tracking-tight">
              Crédito pensado para ti
            </h2>
            {/* SUBTÍTULO — text-slate-500, mt-4 (16px), max-w-2xl, text-lg (18px) */}
            <p className="text-slate-500 mt-4 max-w-2xl mx-auto text-lg">
              Entendemos las necesidades de los comerciantes colombianos. Sin burocracia, sin letra pequeña.
            </p>
          </div>

          {/* GRID DE BENEFICIOS — 1 columna móvil, 2 tablet, 4 desktop
              ESPACIO: gap-6 (24px) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: Clock,
                title: 'Aprobación Express',
                desc: 'Respuesta en menos de 24 horas. Sin filas, sin citas, sin desplazamientos.',
                // COLOR DEL ÍCONO: bg-blue-50 text-blue-600
                // Para cambiar: modifica este campo en el array
                color: 'bg-blue-50 text-blue-600'
              },
              {
                icon: Shield,
                title: '100% Seguro',
                desc: 'Tu información está protegida con cifrado bancario y cumplimiento SARLAFT.',
                color: 'bg-emerald-50 text-emerald-600'
              },
              {
                icon: Smartphone,
                title: 'Todo Digital',
                desc: 'Solicita, firma y paga desde tu celular. Sin papeles, sin sucursales físicas.',
                color: 'bg-accent-50 text-accent-600'
              },
              {
                icon: TrendingUp,
                title: 'Tasas Competitivas',
                desc: 'Tasas desde el 2% mensual. Transparencia total sin costos ocultos.',
                color: 'bg-purple-50 text-purple-600'
              },
            ].map((item, i) => (
              // TARJETA DE BENEFICIO
              // COLOR FONDO: bg-white (blanco), BORDE: border border-slate-200/60
              // BORDES: rounded-2xl (16px), PADDING: p-7 (28px)
              // SOMBRA: shadow-sm, hover:shadow-lg (más grande al hover)
              // hover:border-accent-200 (borde naranja al hover)
              <div key={i} className="bg-white rounded-2xl p-7 border border-slate-200/60 shadow-sm hover:shadow-lg hover:border-accent-200 transition-all group">
                {/* ÍCONO CONTENEDOR
                    TAMAÑO: w-12 h-12 (48x48px), BORDES: rounded-xl (12px)
                    MARGEN: mb-5 (20px abajo)
                    COLOR: viene del array (ej: 'bg-blue-50 text-blue-600')
                    HOVER: group-hover:scale-110 (crece 10% al hover) */}
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-5 ${item.color} group-hover:scale-110 transition-transform`}>
                  <item.icon className="w-6 h-6" />
                </div>
                {/* TÍTULO TARJETA — font-bold, text-navy-900, text-lg (18px), mb-2 */}
                <h3 className="font-bold text-navy-900 text-lg mb-2">{item.title}</h3>
                {/* DESCRIPCIÓN — text-slate-500, text-sm (14px), leading-relaxed */}
                <p className="text-slate-500 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════
          SECCIÓN "CÓMO FUNCIONA" (3 pasos)
          COLOR DE FONDO: bg-white (blanco)
          ════════════════════════════════════════════════════════════════════ */}
      <section id="como-funciona" className="bg-white">
        <div className="w-full max-w-7xl mx-auto px-6 lg:px-12 py-20 lg:py-28">
          <div className="text-center mb-16">
            <span className="text-accent-500 font-bold text-sm uppercase tracking-wider">PROCESO SIMPLE</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-navy-900 mt-3 tracking-tight">
              Tu crédito en 3 pasos
            </h2>
          </div>

          {/* GRID DE 3 PASOS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* LÍNEA CONECTORA ENTRE PASOS (solo desktop)
                COLOR: from-accent-200 via-accent-400 to-accent-200 (degradado naranja)
                ALTO: h-0.5 (2px), POSICIÓN: absolute top-12 (48px desde arriba) */}
            <div className="hidden md:block absolute top-12 left-[20%] right-[20%] h-0.5 bg-gradient-to-r from-accent-200 via-accent-400 to-accent-200"></div>

            {[
              { step: '01', title: 'Simula', desc: 'Elige el monto y plazo que mejor se adapte a tu negocio con nuestra calculadora en línea.' },
              { step: '02', title: 'Aplica', desc: 'Sube tu cédula y datos básicos. Nuestro motor de riesgo evalúa tu solicitud al instante.' },
              { step: '03', title: 'Recibe', desc: 'Aprobación en minutos. El dinero llega directo a tu cuenta bancaria el mismo día.' },
            ].map((item, i) => (
              <div key={i} className="relative flex flex-col items-center text-center">
                {/* NÚMERO DEL PASO
                    COLOR FONDO: bg-accent-500 (naranja)
                    COLOR TEXTO: text-white (blanco)
                    TAMAÑO: w-16 h-16 (64x64px), BORDES: rounded-2xl (16px)
                    FUENTE: font-extrabold, text-lg (18px)
                    SOMBRA: shadow-lg shadow-accent-500/30 (sombra naranja) */}
                <div className="relative z-10 w-16 h-16 bg-accent-500 rounded-2xl flex items-center justify-center text-white font-extrabold text-lg shadow-lg shadow-accent-500/30 mb-6">
                  {item.step}
                </div>
                {/* TÍTULO DEL PASO — font-bold, text-navy-900, text-xl (20px) */}
                <h3 className="font-bold text-navy-900 text-xl mb-2">{item.title}</h3>
                {/* DESCRIPCIÓN — text-slate-500, text-sm (14px), max-w-xs (320px) */}
                <p className="text-slate-500 text-sm leading-relaxed max-w-xs">{item.desc}</p>
              </div>
            ))}
          </div>

          {/* BOTÓN "Comienza ahora"
              Igual al hero: bg-accent-500 (naranja), rounded-full, px-8 py-4
              SOMBRA: shadow-lg shadow-accent-500/25 */}
          <div className="text-center mt-14">
            <button
              type="button"
              onClick={() => setFunnelOpen(true)}
              className="inline-flex items-center gap-2 bg-accent-500 hover:bg-accent-600 text-white font-bold px-8 py-4 rounded-full transition-all hover:scale-105 shadow-lg shadow-accent-500/25 text-lg"
            >
              Comienza ahora
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════
          SECCIÓN CTA FINAL
          COLOR DE FONDO: bg-gradient-to-br from-navy-900 to-navy-950 (azul muy oscuro)
          Para cambiar: from-slate-900 to-black, from-indigo-900 to-indigo-950
          ════════════════════════════════════════════════════════════════════ */}
      <section className="bg-gradient-to-br from-navy-900 to-navy-950 relative overflow-hidden">
        {/* BOLA DECORATIVA — naranja 10% */}
        <div className="absolute inset-0">
          <div className="absolute top-0 right-0 w-96 h-96 bg-accent-500/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl"></div>
        </div>
        <div className="relative w-full max-w-4xl mx-auto px-6 lg:px-12 py-20 lg:py-28 text-center">
          {/* TÍTULO — text-3xl (30px) → text-5xl (48px) en desktop
              COLOR: text-white (blanco)
              "tu negocio" — text-accent-400 (naranja claro) */}
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-tight">
            ¿Listo para impulsar <br />
            <span className="text-accent-400">tu negocio?</span>
          </h2>
          {/* PÁRRAFO — text-navy-300 (gris azulado claro), mt-6, text-lg */}
          <p className="text-navy-300 mt-6 text-lg max-w-xl mx-auto">
            Únete a miles de comerciantes colombianos que ya confían en Plurall para crecer.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            {/* BOTÓN "Solicitar Crédito" — naranja sobre fondo oscuro */}
            <button
              type="button"
              onClick={() => setFunnelOpen(true)}
              className="inline-flex items-center gap-2 bg-accent-500 hover:bg-accent-400 text-white font-bold text-lg px-10 py-4 rounded-full transition-all hover:scale-105 shadow-xl shadow-accent-500/30"
            >
              Solicitar Crédito
              <ArrowRight className="w-5 h-5" />
            </button>
            {/* ENLACE "Ya tengo cuenta" — blanco semi-transparente */}
            <Link href="/login" className="inline-flex items-center gap-2 text-white/70 hover:text-white font-semibold transition-colors">
              Ya tengo cuenta
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════
          FOOTER
          COLOR DE FONDO: bg-navy-950 (azul casi negro)
          BORDE SUPERIOR: border-t border-navy-800
          COLOR TEXTO BASE: text-navy-300 (gris azulado claro)
          ════════════════════════════════════════════════════════════════════ */}
      <footer className="bg-navy-950 text-navy-300 border-t border-navy-800">
        <div className="w-full max-w-7xl mx-auto px-6 lg:px-12 py-16">
          {/* GRID 4 COLUMNAS (brand ocupa 2) */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10">

            {/* COLUMNA BRAND (ocupa 2 columnas en desktop) */}
            <div className="col-span-1 md:col-span-2">
              <div className="flex items-center gap-3 mb-5">
                {/* LOGO BLANCO — bg-white (blanco), letra text-navy-900 (azul oscuro) */}
                <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center">
                  <span className="text-navy-900 font-extrabold text-lg">P</span>
                </div>
                {/* NOMBRE — text-2xl (24px), font-bold, text-white */}
                <span className="text-2xl font-bold tracking-tight text-white">PLURALL</span>
              </div>
              {/* DESCRIPCIÓN — text-sm (14px), text-navy-400 (gris azulado), max-w-sm */}
              <p className="text-sm text-navy-400 max-w-sm leading-relaxed">
                Impulsando el crecimiento de los comerciantes colombianos con soluciones financieras digitales, rápidas y 100% seguras.
              </p>
            </div>

            {/* COLUMNA PLATAFORMA */}
            <div>
              {/* TÍTULO COLUMNA — text-white, font-bold, text-sm (14px), uppercase */}
              <h4 className="text-white font-bold mb-4 text-sm tracking-wide">Plataforma</h4>
              {/* ENLACES — hover:text-accent-400 (naranja al hover), space-y-3 (12px entre enlaces) */}
              <ul className="space-y-3 text-sm">
                <li><Link href="/login" className="hover:text-accent-400 transition">Iniciar Sesión</Link></li>
                <li><Link href="/registro" className="hover:text-accent-400 transition">Solicitar Crédito</Link></li>
                <li><Link href="#" className="hover:text-accent-400 transition">Simulador de Cuotas</Link></li>
              </ul>
            </div>

            {/* COLUMNA LEGAL */}
            <div>
              <h4 className="text-white font-bold mb-4 text-sm tracking-wide">Legal</h4>
              <ul className="space-y-3 text-sm">
                <li><Link href="#" className="hover:text-accent-400 transition">Términos y Condiciones</Link></li>
                <li><Link href="#" className="hover:text-accent-400 transition">Política de Privacidad</Link></li>
                <li><Link href="#" className="hover:text-accent-400 transition">Habeas Data (Ley 1581)</Link></li>
              </ul>
            </div>
          </div>

          {/* BARRA INFERIOR DEL FOOTER
              BORDE SUPERIOR: border-t border-navy-800
              COLOR TEXTO: text-xs (12px), text-navy-500 (gris oscuro) */}
          <div className="mt-16 pt-8 border-t border-navy-800 text-xs text-navy-500 flex flex-col md:flex-row justify-between items-center gap-2">
            <p>© 2025 Plurall Colombia S.A.S. Todos los derechos reservados.</p>
            <p className="font-medium text-navy-400">Proyecto Formativo SENA · Tecnólogo ADSO</p>
          </div>
        </div>
      </footer>

      {/* MODAL DEL EMBUDO DE PRE-CALIFICACIÓN
          Se abre cuando funnelOpen = true
          Para cambiar los estilos del modal: edita components/CreditFunnelModal.js */}
      <CreditFunnelModal isOpen={funnelOpen} onClose={() => setFunnelOpen(false)} />
    </main>
  );
}
