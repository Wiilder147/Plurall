import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { withSentryConfig } from '@sentry/nextjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: __dirname,
  },
  images: {
    // Fotos del carrusel de historias de clientes (landing)
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-DNS-Prefetch-Control',            value: 'on' },
          { key: 'Strict-Transport-Security',          value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'X-Frame-Options',                    value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options',             value: 'nosniff' },
          { key: 'Referrer-Policy',                    value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy',                 value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin',      value: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000' },
          { key: 'Access-Control-Allow-Methods',     value: 'GET,OPTIONS,PATCH,DELETE,POST,PUT' },
          { key: 'Access-Control-Allow-Headers',     value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version' },
        ],
      },
    ];
  },
};

// ── Sentry ───────────────────────────────────────────────────────────────────
// Solo activo en producción. En desarrollo no sube source maps ni bloquea el build.
export default withSentryConfig(nextConfig, {
  // Organización y proyecto de Sentry (opcional, para subir source maps)
  org:     process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Subir source maps solo en producción para depuración de errores minificados
  silent:          true,   // No mostrar logs de Sentry durante el build
  hideSourceMaps:  true,   // No exponer source maps al cliente
  disableLogger:   true,   // Eliminar logs de Sentry del bundle del cliente

  // No bloquear el build si Sentry falla (útil en CI/CD sin token configurado)
  telemetry: false,
});
