# PLURALL — Sprint 2: Dashboard y Perfil de Usuario
## Documentación Técnica

> **Proyecto Formativo SENA** | Tecnólogo ADSO | Instructor: Jefry González
> **Versión:** Sprint 2 completado
> **Prerrequisito:** Sprint 1 completado

---

## 1. Objetivo del Sprint 2

Construir la interfaz de aterrizaje post-login para los clientes: un layout con sidebar persistente, una pantalla de inicio con estado de cuenta y una pantalla de perfil con datos reales del usuario.

---

## 2. Archivos Nuevos

```
apps/web/
├── app/dashboard/
│   ├── layout.js            ← Layout compartido de todas las rutas /dashboard/*
│   ├── inicio/
│   │   └── page.js          ← Pantalla principal post-login
│   └── perfil/
│       └── page.js          ← Datos personales del usuario
└── components/
    └── DashboardSidebar.js  ← Menú lateral responsivo
```

---

## 3. Descripción de Cada Archivo

### 3.1 `components/DashboardSidebar.js`

**Directiva:** `'use client'` — requiere `useState` para el menú hamburguesa.

**¿Qué hace?**
- En escritorio: sidebar fijo a la izquierda, siempre visible.
- En móviles: se colapsa. Un botón hamburguesa (top-left) lo abre con overlay oscuro.
- Muestra el logo de PLURALL en la cabecera.
- Renderiza la lista de navegación, marcando el ítem activo con `usePathname()`.
- Botón "Cerrar sesión" al final: llama a `supabase.auth.signOut()` y redirige a `/login`.

**Ítem activo:** Aplica `bg-orange-50 text-orange-600` al enlace cuyo `href === pathname`.

---

### 3.2 `app/dashboard/layout.js`

**Tipo:** Server Component — envuelve todas las rutas bajo `/dashboard/*`.

**Estructura visual:**
```
┌──────────────────────────────────────────────────────┐
│  DashboardSidebar (w-64, fijo)  │  <children>        │
│                                 │  (flex-1, scroll)  │
└──────────────────────────────────────────────────────┘
```

Fondo: `bg-slate-50`. El área principal tiene esferas decorativas con `blur-3xl` en naranja y azul para dar profundidad.

---

### 3.3 `app/dashboard/inicio/page.js`

**Tipo:** Server Component (SSR) con `export const dynamic = 'force-dynamic'`.

**Data fetching:**
- `supabase.auth.getUser()` (SSR) para obtener `user.user_metadata.nombre_completo`.
- Si no hay sesión → `redirect('/login')`.

**Secciones:**
1. **Saludo:** "Hola, {primerNombre} 👋" — usa solo el primer nombre.
2. **Tarjeta de estado de cuenta:** Gradiente oscuro con texto "Sin créditos activos" y botón CTA a `/dashboard/creditos/solicitar`.
3. **Grid de acciones rápidas:**
   - Simular Crédito → enlace al simulador (Sprint 3).
   - Historial → extractos y pagos (Sprint 4).
   - Pagos Múltiples → Wompi (Sprint 4).

---

### 3.4 `app/dashboard/perfil/page.js`

**Tipo:** Server Component (SSR) con `export const dynamic = 'force-dynamic'`.

**¿Qué muestra?**
- Avatar circular con inicial del usuario (ícono `User`).
- Badge "Cuenta Activa" en verde esmeralda.
- Grid con:
  - CC / Documento (`dni`).
  - Número de celular (`telefono`).
  - Correo electrónico (`email_real` o `user.email` como fallback).
- Footer con enlace "Solicitar Actualización" (placeholder Sprint 4).

**Fuente de datos:** `user.user_metadata` — los metadatos se guardaron en el momento del registro (`signUp`).

---

## 4. Rutas Disponibles al Final del Sprint 2

| Ruta | Tipo | Acceso |
|------|------|--------|
| `/dashboard/inicio` | Server Component | Privado (requiere sesión) |
| `/dashboard/perfil` | Server Component | Privado (requiere sesión) |

Ambas rutas están protegidas por `middleware.js` que llama a `updateSession()`.

---

## 5. Reglas de Negocio Cubiertas en Sprint 2

| Código | Regla | Estado |
|--------|-------|--------|
| RN-02 | Bloqueo tras 3 intentos | ⏳ Campo `intentos_fallidos` en BD listo, lógica Sprint 2+ |
| BD-02 | Auth delegado a Supabase | ✅ SSR usa `createServerClient()` con cookies |

---

## 6. Pendientes para Sprint 3 (completados)

- [x] Página `/dashboard/creditos` — lista de solicitudes
- [x] Página `/dashboard/creditos/solicitar` — simulador interactivo
- [x] Página `/dashboard/documentos` — carga KYC
- [x] Sidebar actualizado con nuevas rutas
- [x] Botón "Solicitar Crédito" enlazado correctamente
