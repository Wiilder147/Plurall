# PLURALL — Sprint 1: Fundación y Autenticación Segura
## Documentación Técnica Completa

> **Proyecto Formativo SENA** | Tecnólogo ADSO | Instructor: Jefry González  
> **Versión:** Sprint 1 completado  
> **Stack:** Next.js 16 (JavaScript) + Supabase + Tailwind CSS  
> **Costo de infraestructura:** $0 COP/mes

---

## 1. Estructura de Carpetas

```
plurall/
├── apps/
│   └── web/                          ← Proyecto Next.js (Frontend + API)
│       ├── app/                      ← Directorio principal de rutas (App Router)
│       │   ├── layout.js             ← Layout raíz (fuente Montserrat, SEO, idioma)
│       │   ├── page.js               ← Landing page pública (/)
│       │   ├── globals.css           ← Sistema de diseño (colores, animaciones, componentes)
│       │   ├── favicon.ico           ← Ícono del navegador
│       │   ├── login/
│       │   │   └── page.js           ← Pantalla de Login (/login)
│       │   ├── registro/
│       │   │   └── page.js           ← Pantalla de Registro (/registro)
│       │   ├── recuperar/
│       │   │   └── page.js           ← Pantalla de Recuperar contraseña (/recuperar)
│       │   └── auth/
│       │       └── callback/
│       │           └── route.js      ← API Route: callback de Supabase Auth
│       ├── lib/                      ← Lógica reutilizable (no es una pantalla)
│       │   ├── calculadora.js        ← Amortización francesa (se ejecuta en el navegador)
│       │   └── supabase/
│       │       ├── client.js         ← Cliente Supabase para el navegador
│       │       ├── server.js         ← Cliente Supabase para el servidor (cookies)
│       │       └── middleware.js     ← Lógica de protección de rutas
│       ├── middleware.js             ← Middleware de Next.js (punto de entrada)
│       ├── .env.example              ← Plantilla de variables de entorno
│       ├── package.json              ← Dependencias del proyecto
│       ├── jsconfig.json             ← Alias de importación (@/ = raíz)
│       ├── next.config.mjs           ← Configuración de Next.js
│       ├── postcss.config.mjs        ← Configuración de PostCSS (Tailwind)
│       ├── eslint.config.mjs         ← Reglas de calidad de código
│       └── public/                   ← Archivos estáticos (imágenes, fuentes)
├── database/
│   └── (pendiente Sprint 2: migraciones SQL separadas)
├── docs/
│   └── setup_services.md            ← Guía paso a paso de integraciones (Supabase, Wompi, etc.)
├── plurall_database_completa.sql     ← Script SQL completo (ya ejecutado en Supabase)
└── PLURALL-README-v3-FINAL.docx      ← Plan Maestro original del proyecto
```

---

## 2. ¿Qué Hace Cada Archivo? (Explicación Detallada)

### 2.1 `app/layout.js` — Layout Raíz

Este archivo envuelve **todas las páginas** de la aplicación. Es como el "esqueleto" HTML base.

**¿Qué hace?**
- Carga la fuente **Montserrat** desde Google Fonts (en pesos 400-800).
- Define la variable CSS `--font-montserrat` para que Tailwind la use.
- Establece el idioma a `es` (español) para accesibilidad.
- Define el `<title>` y `<meta description>` para SEO.
- Importa `globals.css` que contiene todo el sistema de diseño.

**Código clave:**
```javascript
import { Montserrat } from "next/font/google";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});
```

---

### 2.2 `app/globals.css` — Sistema de Diseño

Contiene **todos los estilos** de la aplicación. Define la identidad visual de PLURALL.

**Paleta de colores:**
| Token | Color | Uso |
|---|---|---|
| `navy-950` | `#080E18` | Fondo principal (modo oscuro) |
| `navy-900` | `#0F1B2D` | Cards y elementos elevados |
| `navy-800` | `#243B64` | Bordes e inputs |
| `accent-500` | `#FF9800` | Color principal naranja (botones, enlaces) |
| `accent-700` | `#F57C00` | Hover de botones |
| `success` | `#10B981` | Cuotas pagadas, éxito |
| `danger` | `#EF4444` | Cuotas vencidas, errores |

**Clases CSS reutilizables:**
| Clase | Qué hace |
|---|---|
| `.btn-primary` | Botón naranja con gradiente, hover con sombra y elevación |
| `.btn-secondary` | Botón transparente con borde navy |
| `.input-field` | Campo de texto con fondo oscuro y borde naranja al enfocar |
| `.card` | Tarjeta con gradiente navy y borde que brilla al hover |
| `.glass` | Efecto glassmorphism (desenfoque de fondo) |
| `.animate-fade-in` | Animación de aparición suave |
| `.animate-slide-in` | Animación de deslizamiento lateral |
| `.animate-pulse-glow` | Brillo pulsante naranja (botón CTA) |

---

### 2.3 `app/page.js` — Landing Page (`/`)

Es la **primera página que ve el visitante**. No requiere estar logueado.

**Secciones:**
1. **Barra de navegación:** Logo "P" + botones "Iniciar Sesión" y "Registrarse".
2. **Hero:** Título grande "Créditos para comerciantes colombianos" + subtítulo + 2 botones CTA.
3. **Features:** 4 tarjetas (Solicitud rápida, Calculadora en vivo, Documentos digitales, Seguridad total).
4. **Footer:** Créditos SENA + nombre del instructor.

**Iconos usados** (de la librería `lucide-react`):
- `Shield` — seguridad
- `CreditCard` — solicitud
- `BarChart3` — calculadora
- `FileText` — documentos

---

### 2.4 `app/login/page.js` — Pantalla de Login (`/login`)

**Directiva:** `'use client'` — se ejecuta en el navegador (necesita interactividad).

**Funcionalidad:**
1. El usuario ingresa **email** y **contraseña**.
2. Al hacer clic en "Iniciar Sesión", llama a `supabase.auth.signInWithPassword()`.
3. Si las credenciales son correctas → redirige a `/dashboard/inicio`.
4. Si fallan → muestra un mensaje de error claro en español.
5. Toggle de ojo para **mostrar/ocultar contraseña**.
6. Enlace a `/recuperar` (olvidé mi contraseña).
7. Enlace a `/registro` (crear cuenta nueva).

**Mensajes de error:**
- `"Invalid login credentials"` → `"Correo o contraseña incorrectos."`
- `"Email not confirmed"` → `"Debes confirmar tu correo electrónico."`

**Diseño:** Efecto glassmorphism (`.glass`) + esferas decorativas con blur de fondo.

---

### 2.5 `app/registro/page.js` — Pantalla de Registro (`/registro`)

**Campos del formulario:**
| Campo | Validación | Regla de negocio |
|---|---|---|
| Nombre completo | Requerido | — |
| Cédula de Ciudadanía (CC) | Máx 12 caracteres | Solo CC (extranjeros desactivados en BD) |
| Correo electrónico | Formato email válido | Único en la BD (constraint) |
| Teléfono | Exactamente 10 dígitos | RN-01: formato colombiano |
| Contraseña | Mínimo 6 caracteres | Hash manejado por Supabase Auth |
| Confirmar contraseña | Debe coincidir | Validación en el cliente |
| Aceptar términos | Obligatorio (checkbox) | RNM-01: Ley 1581/2012 Habeas Data |

**Flujo:**
1. Valida todos los campos en el navegador.
2. Llama a `supabase.auth.signUp()` con los datos.
3. Guarda `nombre_completo`, `telefono` y `dni` en los metadatos del usuario.
4. Muestra pantalla de éxito → "Revisa tu correo para confirmar".

---

### 2.6 `app/recuperar/page.js` — Recuperar Contraseña (`/recuperar`)

**Flujo:**
1. El usuario ingresa su correo electrónico.
2. Se llama a `supabase.auth.resetPasswordForEmail()`.
3. Supabase envía un email con un enlace de recuperación.
4. Se muestra pantalla de confirmación con icono verde (CheckCircle).
5. Enlace para volver al login.

---

### 2.7 `app/auth/callback/route.js` — Callback de Auth

**Tipo:** API Route (se ejecuta en el servidor, no es una pantalla visible).

**¿Qué hace?**
Cuando el usuario hace clic en el enlace que recibió por correo (confirmación de registro o recuperación de contraseña), Supabase lo redirige a esta URL con un `code`. Este archivo:
1. Recibe el `code` de la URL.
2. Lo intercambia por una sesión válida con `supabase.auth.exchangeCodeForSession()`.
3. Redirige al usuario a `/dashboard/inicio` (o donde indique el parámetro `next`).

---

### 2.8 `lib/supabase/client.js` — Cliente para el Navegador

Crea una instancia de Supabase usando `createBrowserClient()`. Se usa dentro de componentes con `'use client'` (como Login y Registro).

```javascript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
}
```

**¿Cuándo se usa?** En cualquier componente que necesite leer o escribir datos desde el navegador del usuario (login, registro, dashboard).

---

### 2.9 `lib/supabase/server.js` — Cliente para el Servidor

Crea una instancia de Supabase usando `createServerClient()` con acceso a las cookies del servidor. Se usa en componentes de servidor y en API Routes.

**¿Por qué es diferente al client.js?**
Porque en el servidor se necesita acceso a las cookies HTTP para saber qué usuario está logueado. El navegador no tiene acceso directo a esas cookies seguras.

---

### 2.10 `lib/supabase/middleware.js` — Protección de Rutas

**Función `updateSession(request)`:**
1. Refresca la sesión del usuario automáticamente (para que no expire).
2. Si el usuario **NO está logueado** y trata de entrar a una ruta privada → lo redirige a `/login`.
3. Las rutas públicas (que **no** requieren login) son: `/`, `/login`, `/registro`, `/recuperar`.

**Guarda:** Si no existen las credenciales de Supabase en las variables de entorno, deja pasar todas las peticiones sin proteger (para desarrollo local sin configurar).

---

### 2.11 `middleware.js` — Middleware Principal

Archivo en la raíz del proyecto que Next.js ejecuta **antes de cada petición HTTP**. Llama a `updateSession()` y define el `matcher` para excluir archivos estáticos (imágenes, CSS, etc.).

---

### 2.12 `lib/calculadora.js` — Calculadora de Amortización Francesa

**Función `calcularAmortizacion(monto, tasaAnual, plazoMeses)`:**
- Calcula la **tasa mensual efectiva**: `(1 + tasaAnual/100)^(1/12) - 1`
- Calcula la **cuota fija** con la fórmula de amortización francesa.
- Genera una **tabla de amortización** con: número de cuota, capital, interés, cuota total y saldo restante.

**Función `formatCOP(valor)`:**
- Formatea números como moneda colombiana: `1234567` → `$1.234.567`.

**¿Dónde se usa?** En el Sprint 3, en la pantalla de "Solicitar Crédito" con un slider interactivo. Se ejecuta 100% en el navegador (sin latencia).

---

### 2.13 `.env.example` — Variables de Entorno

Plantilla con **todas las claves necesarias** para que funcione la aplicación. El desarrollador debe copiarla como `.env.local` y completar los valores reales.

| Variable | Servicio | Sprint |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase | 1 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase | 1 |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase | 1 |
| `NEXT_PUBLIC_WOMPI_PUBLIC_KEY` | Wompi | 4 |
| `WOMPI_PRIVATE_KEY` | Wompi | 4 |
| `WOMPI_EVENTS_SECRET` | Wompi | 4 |
| `RESEND_API_KEY` | Resend | 2 |
| `RESEND_FROM_EMAIL` | Resend | 2 |
| `UPSTASH_REDIS_REST_URL` | Upstash | 1 |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash | 1 |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry | 5 |
| `NEXT_PUBLIC_APP_URL` | App | 1 |
| `NEXT_PUBLIC_APP_NAME` | App | 1 |

---

## 3. Dependencias Instaladas

| Paquete | Versión | Para qué sirve |
|---|---|---|
| `next` | 16.2.1 | Framework web (frontend + backend) |
| `react` / `react-dom` | 19.x | Librería de interfaz de usuario |
| `tailwindcss` | 4.x | Estilos CSS utilitarios |
| `@supabase/supabase-js` | 2.x | SDK de Supabase (base de datos + auth) |
| `@supabase/ssr` | 0.x | Manejo de sesiones server-side |
| `lucide-react` | — | Iconos SVG modernos (Eye, Shield, LogIn...) |
| `clsx` | — | Combinar clases CSS condicionalmente |

---

## 4. Rutas Disponibles

| Ruta | Tipo | Acceso | Descripción |
|---|---|---|---|
| `/` | Página | Público | Landing page con hero y features |
| `/login` | Página | Público | Formulario de inicio de sesión |
| `/registro` | Página | Público | Formulario de creación de cuenta |
| `/recuperar` | Página | Público | Recuperar contraseña por email |
| `/auth/callback` | API Route | Servidor | Callback de Supabase Auth |
| `/dashboard/*` | Página | Privado | *(Sprint 2 — aún no creado)* |
| `/admin/*` | Página | Privado (Admin) | *(Sprint 5 — aún no creado)* |

---

## 5. Reglas de Negocio Cubiertas en Sprint 1

| Código | Regla | Estado |
|---|---|---|
| RN-01 | Teléfono 10 dígitos colombiano | ✅ Validación en registro |
| RN-02 | Bloqueo tras 3 intentos fallidos | ⏳ Campo `intentos_fallidos` existe en BD |
| RN-11 | DNI y email únicos | ✅ Constraint UNIQUE en BD |
| RNM-01 | Habeas Data (Ley 1581) | ✅ Checkbox obligatorio en registro |
| RNM-08 | HTTPS forzado | ✅ Automático en Vercel |
| BD-01 | IDs con UUID | ✅ Todas las tablas usan UUID |
| BD-02 | Auth delegado a Supabase | ✅ perfil_usuario referencia auth.users |

---

## 6. Comandos Útiles

```bash
# Instalar dependencias
cd apps/web && npm install

# Levantar servidor de desarrollo
npm run dev
# → Abre http://localhost:3000

# Compilar para producción
npm run build

# Ver el proyecto compilado
npm start
```

---

## 7. Pendientes para Sprint 2

- [ ] Configurar `.env.local` con credenciales reales de Supabase
- [ ] Crear pantalla de Dashboard (`/dashboard/inicio`)
- [ ] Crear pantalla de Perfil (`/dashboard/perfil`)
- [ ] Implementar subida de documentos KYC a bucket privado
- [ ] Configurar email de bienvenida con Resend
- [ ] Layout con sidebar navy para rutas privadas
