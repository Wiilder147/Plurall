'use client'

/* ==========================================================================
 * ARCHIVO: TestimonialCarousel.js
 * RUTA: apps/web/components/TestimonialCarousel.js
 * DESCRIPCIÓN: Carrusel de historias de clientes para la landing.
 * FUNCIONALIDAD: Rota automáticamente cada 7 segundos (se pausa al pasar el
 *                cursor), con flechas y puntos de navegación manual.
 *                Las fotos se sirven desde Unsplash (dominio autorizado en
 *                next.config.mjs → images.remotePatterns).
 * ========================================================================== */

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { ChevronLeft, ChevronRight, Quote, Star } from 'lucide-react'

const TESTIMONIOS = [
  {
    nombre:   'María Fernanda Ruiz',
    negocio:  'Minimercado La Esquina',
    ciudad:   'Bogotá',
    historia: 'Con mi primer crédito de $2.000.000 surtí la tienda para la temporada de diciembre. Vendí casi el doble que el año anterior y pagué todas mis cuotas sin atrasarme. Ya voy por mi segundo crédito con PLURALL.',
    foto:     'https://images.unsplash.com/photo-1521566652839-697aa473761a?w=900&q=80',
  },
  {
    nombre:   'Jorge Andrés Pineda',
    negocio:  'Panadería El Trigal',
    ciudad:   'Medellín',
    historia: 'El horno se me dañó un viernes y el lunes ya tenía el desembolso en mi Nequi. Sin filas, sin papeleos: todo lo hice desde el celular mientras atendía el mostrador. Eso no me lo dio ningún banco.',
    foto:     'https://images.unsplash.com/photo-1517433670267-08bbd4be890f?w=900&q=80',
  },
  {
    nombre:   'Luisa Cárdenas',
    negocio:  'Boutique Luna',
    ciudad:   'Cali',
    historia: 'Empecé vendiendo por catálogo y con el crédito monté mi propio local. La cuota fija me deja organizar las cuentas del mes, y cuando tengo dudas el asesor siempre me contesta.',
    foto:     'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=900&q=80',
  },
  {
    nombre:   'Familia Robayo',
    negocio:  'Fruver Campo Verde',
    ciudad:   'Bucaramanga',
    historia: 'Ampliamos la nevera de exhibición y ahora también abrimos los domingos. El crédito prácticamente se pagó solo con las ventas nuevas. Recomendados con los ojos cerrados.',
    foto:     'https://images.unsplash.com/photo-1542838132-92c53300491e?w=900&q=80',
  },
]

const INTERVALO_MS = 7000

export default function TestimonialCarousel() {
  const [actual, setActual]   = useState(0)
  const [pausado, setPausado] = useState(false)

  useEffect(() => {
    if (pausado) return
    const timer = setInterval(
      () => setActual(prev => (prev + 1) % TESTIMONIOS.length),
      INTERVALO_MS,
    )
    return () => clearInterval(timer)
  }, [pausado])

  const anterior  = () => setActual(prev => (prev - 1 + TESTIMONIOS.length) % TESTIMONIOS.length)
  const siguiente = () => setActual(prev => (prev + 1) % TESTIMONIOS.length)
  const t = TESTIMONIOS[actual]

  return (
    <div
      className="relative"
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
    >
      {/* TARJETA DEL TESTIMONIO — foto a la izquierda, historia a la derecha */}
      <div key={actual} className="bg-white rounded-3xl border border-slate-200/60 shadow-lg overflow-hidden grid grid-cols-1 md:grid-cols-2 animate-fade-in">

        {/* FOTO DEL NEGOCIO */}
        <div className="relative aspect-[4/3] md:aspect-auto md:min-h-[360px]">
          <Image
            src={t.foto}
            alt={`${t.negocio} — ${t.ciudad}`}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover"
          />
        </div>

        {/* HISTORIA */}
        <div className="p-8 lg:p-12 flex flex-col justify-center">
          <Quote className="w-10 h-10 text-accent-200 mb-4" aria-hidden />

          <div className="flex gap-1 mb-4" aria-label="Calificación: 5 de 5 estrellas">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className="w-4 h-4 fill-accent-500 text-accent-500" />
            ))}
          </div>

          <p className="text-slate-600 text-lg leading-relaxed italic">
            “{t.historia}”
          </p>

          <div className="mt-6 pt-6 border-t border-slate-100">
            <p className="font-bold text-navy-900">{t.nombre}</p>
            <p className="text-sm text-accent-600 font-semibold">{t.negocio} · {t.ciudad}</p>
          </div>
        </div>
      </div>

      {/* CONTROLES: flechas + puntos */}
      <div className="mt-8 flex items-center justify-center gap-6">
        <button
          type="button"
          onClick={anterior}
          aria-label="Historia anterior"
          className="w-11 h-11 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-500 hover:text-accent-600 hover:border-accent-300 transition-all"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5" role="tablist" aria-label="Historias de clientes">
          {TESTIMONIOS.map((item, i) => (
            <button
              key={item.nombre}
              type="button"
              role="tab"
              aria-selected={i === actual}
              aria-label={`Historia de ${item.nombre}`}
              onClick={() => setActual(i)}
              className={`h-2.5 rounded-full transition-all ${
                i === actual ? 'w-8 bg-accent-500' : 'w-2.5 bg-slate-300 hover:bg-slate-400'
              }`}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={siguiente}
          aria-label="Siguiente historia"
          className="w-11 h-11 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-500 hover:text-accent-600 hover:border-accent-300 transition-all"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}
