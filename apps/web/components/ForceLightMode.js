'use client'

import { useEffect } from 'react'

// Elimina la clase 'dark' del <html> para forzar modo claro en el panel del cliente.
// El toggle de tema solo aplica a paneles de asesor y supervisor.
export default function ForceLightMode() {
  useEffect(() => {
    document.documentElement.classList.remove('dark')
  }, [])

  return null
}
