# Usuarios de prueba — PLURALL

> **Cómo ingresar:** en `/login` se escribe el **celular (10 dígitos)** y la **contraseña**.
> (Supabase usa internamente el correo virtual `<celular>@plurall.app`.)

**Contraseña común para todos:** `Plurall2026*`
**Proyecto Supabase:** `bnemrismjmvmemypokaz` (Plurall-Fants)
**Última actualización:** 2026-08-01

## Un usuario por rol

| Rol | Nombre | Celular (login) | Contraseña | Panel al entrar |
|-----|--------|-----------------|------------|-----------------|
| **ADMIN** | Supervisor QA | `3001234567` | `Plurall2026*` | `/admin` — acceso total |
| **SUPERVISOR** | Laura Supervisora | `3100000001` | `Plurall2026*` | `/supervisor` |
| **ASESOR** | Carlos Asesor | `3100000002` | `Plurall2026*` | `/asesor` |
| **CLIENTE (Usuario)** | Juan Maurello | `3173784693` | `Plurall2026*` | `/dashboard/inicio` |

## Los 4 asesores y sus clientes asignados

Todos entran con `Plurall2026*` y verificados end-to-end el 2026-08-01
(login real contra GoTrue + carga de clientes vía PostgREST con su propio RLS).

| Asesor | Celular (login) | Clientes activos |
|--------|-----------------|------------------|
| Carlos Asesor | `3100000002` | 3 — Pedro Mora Leve, Ana Mora Media, Luis Mora Critica |
| María López | `3100000003` | 2 — Rosa Mora Alta, Natalia Histórica 14 |
| Andrés Vargas | `3100000004` | 2 — Quintín Histórico 17, Sofía Al Día |
| Luisa Martínez | `3100000005` | 2 — Helena Histórica 8, Miguel Puntual |

## Qué puede hacer cada rol

- **ADMIN** — Todo: paneles de Supervisor, Asesor y la Vista Usuario, además de gestión de clientes, solicitudes, reportes y desembolsos.
- **SUPERVISOR** — Gestión de usuarios, créditos, documentación, puntaje crediticio, aprobación de crédito, motivos de rechazo, amortización, desembolso, notificaciones y PQR.
- **ASESOR** — Gestión de usuarios, créditos, documentación, **preaprobación** (envía la solicitud al supervisor), motivos de rechazo, amortización, notificaciones y PQR.
- **CLIENTE / Usuario** — Su crédito, plan de pagos, documentación, notificaciones, PQR y ayuda.

## Notas

- El login bloquea el acceso tras **3 intentos fallidos** del mismo celular (sistema anti-fuerza bruta). Si te bloqueas, espera o restablece desde la tabla `auth_lockout`.
- La base tiene 1 admin, 1 supervisor, 4 asesores y 77 clientes. Aquí se listan los de prueba, a los que se les fijó la contraseña común.
- Para cambiar estas contraseñas: `UPDATE auth.users SET encrypted_password = crypt('NuevaPass', gen_salt('bf')) WHERE email = '<celular>@plurall.app';`
- **Al crear usuarios por SQL directo en `auth.users`**, no dejes `email_change`, `confirmation_token`, `recovery_token` ni `raw_app_meta_data` en `NULL`: GoTrue no puede convertir NULL a string al leer la fila y el login devuelve `500 Database error querying schema`. Usa `''` para los tokens y `{"provider":"email","providers":["email"]}` para `raw_app_meta_data`, y crea también la fila correspondiente en `auth.identities` (provider `email`).
