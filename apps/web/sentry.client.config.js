// sentry.client.config.js
// Configuración de Sentry para el lado del cliente (navegador).
// Este archivo se importa automáticamente por Next.js al hacer build.

import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Porcentaje de transacciones que se envían a Sentry para performance monitoring.
  // 0.1 = 10% en producción para no saturar la cuota gratuita.
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Porcentaje de sesiones con error que se graban (Session Replay).
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.05,

  // Solo activar en producción para no contaminar con errores de desarrollo.
  enabled: process.env.NODE_ENV === 'production',

  // Contexto adicional para identificar el ambiente.
  environment: process.env.NODE_ENV,

  // Ignorar errores comunes que no son bugs reales.
  ignoreErrors: [
    'ResizeObserver loop limit exceeded',
    'Non-Error promise rejection captured',
    /^Network Error$/,
    /^Failed to fetch$/,
    /^Load failed$/,
  ],

  // Integración de Session Replay (grabación de sesiones con errores).
  integrations: [
    Sentry.replayIntegration({
      maskAllText:   true,   // Ocultar texto sensible (datos financieros)
      blockAllMedia: false,
    }),
  ],
})
