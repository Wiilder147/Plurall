# PLURALL — Sprint 4: Pagos, Cuotas y Notificaciones
## Documentación Técnica

> **Proyecto Formativo SENA** | Tecnólogo ADSO | Instructor: Jefry González
> **Prerrequisito:** Sprints 1–3 completados

---

## 1. Objetivo del Sprint 4

Cerrar el ciclo financiero del cliente: **ver su plan de cuotas**, **pagar a través de Wompi** y **recibir notificaciones por email**. Además se implementó la regla de negocio **RN-02** (bloqueo de cuenta tras 3 intentos fallidos).

---

## 2. Archivos Nuevos

```
apps/web/
├── app/dashboard/
│   ├── creditos/
│   │   └── [id]/page.js                  ← Detalle de solicitud con timeline
│   └── cuotas/
│       ├── page.js                       ← Plan de pagos del crédito activo
│       ├── confirmacion/page.js          ← Pantalla post-pago (Wompi redirect)
│       └── [id]/pagar/page.js            ← Pago de cuota con widget Wompi
├── app/api/
│   ├── pagos/iniciar/route.js            ← Genera firma de integridad Wompi
│   ├── webhooks/wompi/route.js           ← Recibe confirmaciones de pago
│   ├── notificaciones/solicitud/route.js ← Envío de email con Resend
│   └── auth/lockout/route.js            ← GET/POST/DELETE para RN-02
```

## 3. Archivos Modificados

| Archivo | Cambio |
|---------|--------|
| `app/login/page.js` | RN-02: verifica bloqueo antes de intentar login, incrementa contador en fallo, resetea en éxito |
| `components/DashboardSidebar.js` | Ítem "Mis Cuotas" → `/dashboard/cuotas` |
| `package.json` | Se agrega `resend: ^4.0.0` — ejecutar `npm install` |

---

## 4. Flujo de Pago con Wompi

```
Cliente → /dashboard/cuotas
       → hace clic en "Pagar" cuota N
       → /dashboard/cuotas/{cuotaId}/pagar
       → llama a POST /api/pagos/iniciar  (genera reference + hash SHA256)
       → carga widget Wompi (script DOM)
       → cliente paga en widget
       → Wompi redirige a /dashboard/cuotas/confirmacion?status=APPROVED
       → Wompi POST a /api/webhooks/wompi
       → webhook valida HMAC, marca cuota PAGADA, actualiza saldo crédito
```

## 5. Variables de Entorno Requeridas

Agregar en `.env.local`:

```bash
NEXT_PUBLIC_WOMPI_PUBLIC_KEY=pub_test_XXXX
WOMPI_INTEGRITY_SECRET=test_integrity_XXXX
WOMPI_EVENTS_SECRET=test_events_XXXX
RESEND_API_KEY=re_XXXX
RESEND_FROM_EMAIL=onboarding@resend.dev
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## 6. Webhook Wompi — Configuración en Supabase/Vercel

1. Despliega la app en Vercel.
2. En Wompi Dashboard → Desarrolladores → Webhooks.
3. URL: `https://TU-DOMINIO.vercel.app/api/webhooks/wompi`
4. Copia el `WOMPI_EVENTS_SECRET` al `.env`.

## 7. RN-02 — Bloqueo de Cuenta

| Campo | Tabla | Descripción |
|-------|-------|-------------|
| `intentos_fallidos` | `perfil_usuario` | Incrementa en cada fallo |
| `bloqueado_hasta` | `perfil_usuario` | NOW() + 30 min tras 3 fallos |

**Flujo:**
1. `GET /api/auth/lockout?celular=...` → antes del login
2. Login falla → `POST /api/auth/lockout` → incrementa + bloquea si llegó a 3
3. Login exitoso → `DELETE /api/auth/lockout` → resetea a 0

## 8. Reglas de Negocio Cubiertas

| Código | Regla | Estado |
|--------|-------|--------|
| RN-02 | Bloqueo 3 intentos fallidos, 30 min | ✅ |
| RN-08 | Cuotas VENCIDAS en rojo | ✅ UI con badge rojo |
| RN-12 | Registro de pagos con auditoría | ✅ Tabla `pago` |
| RN-14 | Todos los movimientos con fecha y usuario | ✅ created_at + id_usuario_receptor |

## 9. Pendientes para Sprint 5

- [x] Panel Admin completo
- [x] Aprobación/rechazo de solicitudes
- [x] Desembolso automático (crea crédito + cuotas)
- [ ] Configurar Webhook Wompi URL en producción
- [ ] Activar envíos de email Resend con dominio propio (o usar sandbox)
