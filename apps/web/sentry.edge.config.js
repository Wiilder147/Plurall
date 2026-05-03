// sentry.edge.config.js
// Configuración de Sentry para Edge Runtime (middleware de Next.js).

import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  enabled: process.env.NODE_ENV === 'production',
  environment: process.env.NODE_ENV,
})
