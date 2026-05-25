/* ==========================================================================
 * ARCHIVO: sentry.server.config.js
 * RUTA: apps/web/sentry.server.config.js
 * DESCRIPCIÓN: Archivo principal de la aplicación frontend.
 * FUNCIONALIDAD: Este archivo define la lógica y estructura para su respectivo módulo.
 * ========================================================================== */
// sentry.server.config.js
// Configuración de Sentry para el lado del servidor (Node.js / Edge Runtime).
// Captura errores en API Routes, Server Components y middleware.

import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  enabled: process.env.NODE_ENV === 'production',

  environment: process.env.NODE_ENV,

  // En el servidor capturamos TODOS los errores sin filtros.
  // Los errores financieros (pagos, desembolsos) son críticos.
  beforeSend(event) {
    // No enviar errores de autenticación esperados (401/403)
    if (event.exception?.values?.[0]?.value?.includes('No autorizado')) {
      return null
    }
    return event
  },
})
