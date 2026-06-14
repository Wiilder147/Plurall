# Usuarios de prueba — PLURALL

> Un usuario por cada uno de los **4 roles** del sistema.
> **Cómo ingresar:** en `/login` se escribe el **celular (10 dígitos)** y la **contraseña**.
> (Supabase usa internamente el correo virtual `<celular>@plurall.app`.)

**Contraseña común para todos:** `Plurall2026*`
**Proyecto Supabase:** `bnemrismjmvmemypokaz` (Plurall-Fants)
**Última actualización:** 2026-06-14

| Rol | Nombre | Celular (login) | Contraseña | Panel al entrar |
|-----|--------|-----------------|------------|-----------------|
| **ADMIN** | Supervisor QA | `3001234567` | `Plurall2026*` | `/admin` — acceso total |
| **SUPERVISOR** | Laura Supervisora | `3100000001` | `Plurall2026*` | `/supervisor` |
| **ASESOR** | Carlos Asesor | `3100000002` | `Plurall2026*` | `/asesor` |
| **CLIENTE (Usuario)** | Juan Maurello | `3173784693` | `Plurall2026*` | `/dashboard/inicio` |

## Qué puede hacer cada rol

- **ADMIN** — Todo: paneles de Supervisor, Asesor y la Vista Usuario, además de gestión de clientes, solicitudes, reportes y desembolsos.
- **SUPERVISOR** — Gestión de usuarios, créditos, documentación, puntaje crediticio, aprobación de crédito, motivos de rechazo, amortización, desembolso, notificaciones y PQR.
- **ASESOR** — Gestión de usuarios, créditos, documentación, **preaprobación** (envía la solicitud al supervisor), motivos de rechazo, amortización, notificaciones y PQR.
- **CLIENTE / Usuario** — Su crédito, plan de pagos, documentación, notificaciones, PQR y ayuda.

## Notas

- El login bloquea el acceso tras **3 intentos fallidos** del mismo celular (sistema anti-fuerza bruta). Si te bloqueas, espera o restablece desde la tabla `auth_lockout`.
- Hay más usuarios reales en la base (1 admin, 1 supervisor, 4 asesores, 77 clientes). Aquí solo se listan los **4 designados como prueba**, a los que se les fijó la contraseña común.
- Para cambiar estas contraseñas: `UPDATE auth.users SET encrypted_password = crypt('NuevaPass', gen_salt('bf')) WHERE email = '<celular>@plurall.app';`
