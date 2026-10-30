/* ==========================================================================
 * ARCHIVO: instrumentation.js
 * RUTA: apps/web/instrumentation.js
 * DESCRIPCIÓN: Inicialización de Sentry en servidor y edge (NEW-09).
 * FUNCIONALIDAD: Desde Next 13.4 los archivos sentry.server.config.js y
 *                sentry.edge.config.js solo se cargan si se importan aquí; sin
 *                este archivo Sentry no reportaba errores de las APIs.
 * ========================================================================== */
import * as Sentry from '@sentry/nextjs'

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') await import('./sentry.server.config')
  if (process.env.NEXT_RUNTIME === 'edge') await import('./sentry.edge.config')
}

// Reporta a Sentry los errores no controlados de route handlers y páginas
export const onRequestError = Sentry.captureRequestError
