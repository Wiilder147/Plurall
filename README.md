# Plurall - Plataforma de Gestión de Créditos

Plurall es una plataforma integral (Fintech) diseñada para la gestión del ciclo de vida de créditos dirigidos a comerciantes y emprendedores. Permite el perfilamiento de clientes, simulación de cuotas, carga de documentos KYC, motor de scoring crediticio, desembolso, plan de pagos y registro de recaudo.

## 🏗️ Arquitectura del Sistema

La solución está construida sobre un modelo moderno **Serverless y Headless**:

*   **Frontend y Backend (BFF):** Construido con **Next.js (App Router)**. Maneja el renderizado de la UI (React), rutas protegidas, middlewares de sesión y API Routes (Lambdas) para orquestación de servicios de terceros (Wompi, Resend).
*   **Base de Datos & Auth:** **Supabase** (PostgreSQL). Actúa como la fuente única de verdad, manejando autenticación (Supabase Auth), base de datos relacional y seguridad a nivel de fila (Row Level Security - RLS).
*   **Estilos:** **Tailwind CSS**, permitiendo una UI consistente, de modo oscuro y responsiva.
*   **Integraciones:** 
    *   **Wompi:** Para el procesamiento de pagos de las cuotas.
    *   **Resend:** Para el envío de notificaciones por correo electrónico.

## 📂 Estructura del Proyecto

El proyecto sigue una estructura limpia, separando el frontend/lógica web de la base de datos y los scripts utilitarios.

```text
/
├── apps/
│   └── web/                   # Aplicación principal Next.js
│       ├── app/               # Páginas y Rutas API (App Router)
│       │   ├── api/           # Endpoints del backend (webhooks, orquestación)
│       │   ├── (auth)/        # Rutas de login/registro
│       │   ├── dashboard/     # Portal del cliente (créditos, pagos)
│       │   └── admin/         # Portal administrativo (analistas y admin)
│       ├── components/        # Componentes UI reutilizables (Botones, Tablas, Cards)
│       ├── lib/               # Utilidades y configuración compartida (Cliente Supabase, Utils)
│       └── scripts/           # (En 'utilidades') Scripts .mjs de migración e inyección de datos históricos
├── db/                        # Base de datos y migraciones
│   ├── plurall_database_completa.sql  # DDL inicial del esquema
│   ├── migration_v2_solicitar.sql     # Migraciones secundarias
│   ├── 01_mejoras_integridad.sql      # Triggers y constraints de seguridad
│   └── 02_vistas_reporteria.sql       # Materialized Views para Dashboards analíticos
└── docs/                      # Documentación de sprints pasados y diagramas
```

*Nota: No existen archivos duplicados de configuración o READMEs anidados para mantener la claridad.*

## 🗄️ Modelo de Base de Datos (Core)

El esquema de PostgreSQL está diseñado bajo los principios de robustez transaccional:

1.  **Perfil y Autenticación:** `perfil_usuario` (extiende `auth.users`), `rol`.
2.  **Clientes y KYC:** `cliente`, `detalle_cliente`, `documento_cliente`.
3.  **Originación (Scoring):** `solicitud_credito`, `score`, `respuesta_cliente`, `decision_solicitud`.
4.  **Cartera (Core Bancario):**
    *   `credito`: Contrato maestro.
    *   `plan_pago` y `cuota`: Amortización.
    *   `pago`: Registros transaccionales de abonos (con triggers automáticos a saldos).
5.  **Reportería:** `vw_kpi_cartera`, `vw_cohortes_desembolso` (Vistas materializadas para acceso rápido).

### Seguridad de Datos (RLS)
Toda la base de datos utiliza **Row Level Security**. Las lambdas y el frontend consultan Supabase utilizando el token JWT del usuario autenticado, asegurando que un `CLIENTE` solo pueda ver sus propias `solicitud_credito` y `cuota`, mientras que un `ADMIN` o `ANALISTA` tiene acceso a nivel de plataforma.

## 🚀 Inicio Rápido

### Requisitos
*   Node.js 18+
*   Proyecto activo en Supabase

### Instalación

1.  Clonar el repositorio.
2.  Navegar al directorio de la aplicación web:
    ```bash
    cd apps/web
    npm install
    ```
3.  Configurar variables de entorno copiando el `.env.example`:
    ```bash
    cp .env.example .env.local
    ```
4.  Llenar las claves de Supabase, Resend y Wompi en el `.env.local`.
5.  Iniciar el servidor de desarrollo:
    ```bash
    npm run dev
    ```

El proyecto estará disponible en `http://localhost:3000`.

## 🛠️ Scripts Utilitarios

Dentro de `apps/web/scripts/utilidades/` encontrarás scripts en Node (`.mjs`) que se usan para inyectar datos falsos o ejecutar parches de estado en la base de datos.
Ejemplo de ejecución desde `apps/web/`:
```bash
node scripts/utilidades/inject_pagos.mjs
```

---
*Desarrollado para el Proyecto Formativo SENA | Tecnólogo ADSO.*