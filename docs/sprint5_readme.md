# PLURALL — Sprint 5: Panel de Administración
## Documentación Técnica

> **Proyecto Formativo SENA** | Tecnólogo ADSO | Instructor: Jefry González
> **Prerrequisito:** Sprints 1–4 completados

---

## 1. Objetivo del Sprint 5

Habilitar el **portal administrativo** para que analistas y administradores puedan revisar solicitudes, aprobar/rechazar créditos, desembolsar y monitorear la cartera.

---

## 2. Archivos Nuevos

```
apps/web/
├── app/admin/
│   ├── layout.js                        ← Layout admin (verifica rol ADMIN/ANALISTA)
│   ├── page.js                          ← Dashboard con KPIs y solicitudes recientes
│   ├── solicitudes/
│   │   ├── page.js                      ← Lista con filtros por estado
│   │   └── [id]/page.js                 ← Revisar solicitud: aprobar / rechazar / desembolsar
│   ├── clientes/
│   │   └── page.js                      ← Directorio de clientes con buscador
│   └── reportes/
│       └── page.js                      ← Métricas ejecutivas: cartera, mora, recaudado
├── app/api/admin/
│   ├── solicitud/[id]/route.js          ← PATCH: aprobar o rechazar solicitud
│   └── desembolsar/[id]/route.js        ← POST: crear crédito + plan_pago + cuotas
└── components/AdminSidebar.js           ← Sidebar oscuro del panel admin
```

---

## 3. Control de Acceso (Autorización)

El `app/admin/layout.js` es un **Server Component** que:
1. Obtiene el usuario de `supabase.auth.getUser()`.
2. Consulta `perfil_usuario.id_rol → rol.nombre_rol`.
3. Si el rol **no** es `ADMIN` ni `ANALISTA` → `redirect('/dashboard/inicio')`.

**Para crear un admin:**
```sql
-- 1. Registrar al usuario normalmente en la app
-- 2. En Supabase SQL Editor, cambiar su rol:
UPDATE perfil_usuario
SET id_rol = (SELECT id_rol FROM rol WHERE nombre_rol = 'ADMIN')
WHERE id = 'UUID-DEL-USUARIO';
```

---

## 4. Flujo de Aprobación y Desembolso

```
Admin abre solicitud en /admin/solicitudes/{id}
  → Ve datos del cliente, scoring, documentos KYC
  → Ajusta monto, plazo y tasa si aplica
  → Hace clic "Aprobar Solicitud"
  → PATCH /api/admin/solicitud/{id}
     → Inserta en decision_solicitud (resultado = APROBADO)
     → Actualiza solicitud_credito.id_estado_solicitud → APROBADA

(Cuando llega a desembolso):
  → Hace clic "Confirmar Desembolso"
  → POST /api/admin/desembolsar/{id}
     → Verifica RN-07 (no hay crédito activo)
     → INSERT en credito (monto, tasa, cuota_fija congelados)
     → INSERT en plan_pago
     → INSERT en cuota × N (tabla de amortización francesa)
     → UPDATE solicitud_credito → DESEMBOLSADA
```

---

## 5. Páginas del Panel Admin

### `/admin` — Dashboard
- KPIs: solicitudes pendientes, clientes, créditos activos, cuotas vencidas.
- Tarjeta de cartera total activa.
- Lista de las 5 solicitudes más recientes con enlace a detalle.

### `/admin/solicitudes` — Lista de Solicitudes
- Tabs: Todas / Pendientes / En estudio / Aprobadas / Rechazadas.
- Cada ítem muestra: nombre, CC, monto, plazo, estado (badge), fecha.
- Enlace a detalle de cada solicitud.

### `/admin/solicitudes/[id]` — Detalle y Decisión
- Datos del cliente (nombre, CC, teléfono, email, negocio).
- Datos financieros (ingresos, egresos, otras obligaciones).
- Documentos KYC subidos y su estado de verificación.
- Score crediticio con barra de progreso.
- Tabla de amortización desplegable (simulador en vivo).
- Panel de decisión: formulario Aprobar (monto, plazo, tasa, comentarios) o Rechazar (motivo).
- Si ya fue aprobada: botón "Confirmar Desembolso".

### `/admin/clientes` — Directorio
- Buscador por nombre, CC o celular.
- Tabla con: nombre, CC, celular, score, estado, saldo activo.

### `/admin/reportes` — Métricas
- KPIs financieros: cartera, desembolsado, recaudado, mora.
- Gráfica de barras (CSS puro) de solicitudes por estado.
- Indicador de mora como porcentaje del portafolio.

---

## 6. Reglas de Negocio Cubiertas en Sprint 5

| Código | Regla | Estado |
|--------|-------|--------|
| RN-05 | Analista asignado a cada solicitud | ✅ `id_usuario_evaluador` en solicitud_credito |
| RN-06 | Decisión registrada con fecha y analista | ✅ Tabla `decision_solicitud` |
| RN-07 | Un cliente = un crédito activo | ✅ Validado en API desembolso |
| RN-09 | Scoring visible para el analista | ✅ score_credito en panel |
| BD-03 | Tasa mensual congelada al desembolsar | ✅ No recalcula — guarda tasa_interes_mensual |

---

## 7. Próximos Pasos (Post-Sprint 5)

- [ ] Monitoreo con Sentry (`npx @sentry/wizard@latest -i nextjs`)
- [ ] Activar UptimeRobot con URL de Vercel
- [ ] Implementar generación de PDF (paz y salvo, estado de cuenta) — `tipo_documento_legal`
- [ ] Rate limiting con Upstash Redis en `/api/pagos/iniciar`
- [ ] Historial de pagos descargable en Excel/CSV
- [ ] Notificaciones push para cuotas próximas a vencer
