# Handoff — Normalización de la BD Plurall

**Última actualización:** 2026-08-13
**Rama:** `feat/normalizacion-bd`
**Cómo retomar:** dile al agente → *"Lee `docs/HANDOFF_normalizacion_bd.md` y continúa la normalización desde la FASE 1"*.

---

## 0. Estado actual (dónde vamos)

| Fase | Estado |
|------|--------|
| **FASE 0 — Diagnóstico en vivo** | ✅ COMPLETADA (ver `docs/FASE0_diagnostico_normalizacion.md`) |
| **FASE 1 — Resincronizar schema maestro + types** | ✅ COMPLETADA (commit `3f5abed`) |
| **FASE 2 — Migración 24 (crear tablas nuevas)** | ✅ COMPLETADA (aplicada en Supabase 2026-08-17) |
| FASE 3 — Migración 25 (backfill + verificación) | ⏳ SIGUIENTE |
| FASE 4 — Recablear backend | ⬜ pendiente |
| FASE 5 — Recablear frontend | ⬜ pendiente |
| FASE 6 — Migración 26 (CONTRACT / DROP) | ⬜ pendiente |
| FASE 7 — Pruebas + build + docs | ⬜ pendiente |

### Estado de prerequisitos
- ✅ Migración **`db/23`** aplicada en Supabase (2026-08-13, vía MCP). `nombre_completo` eliminado; nombres atómicos 1B+2A vigentes. Código app recableado y commiteado (`deaf7a2`).
- ✅ Schema maestro + `database.types.ts` regenerados por introspección de la BD viva (FASE 1, `3f5abed`).
- ✅ Migración **`db/24`** aplicada en Supabase (2026-08-17, vía MCP). Creadas `direccion`, `negocio_cliente`, `perfil_financiero`, `cuenta_bancaria` + vista `vw_cliente_score`, con RLS (16 policies) y triggers `updated_at`. **Additivo/EXPAND**: 0 datos tocados, tablas nuevas vacías (backfill = FASE 3). Schema maestro + types resincronizados a `db/01..24`.

### FASE 3 — pasos concretos para retomar (backfill, migración 25)
1. Escribir `db/25_normalizacion_backfill.sql` idempotente que puebla las 4 tablas nuevas desde `cliente`/`detalle_cliente`, aplicando §4:
   - `direccion`: filas CASA (`direccion_casa`/`ciudad_casa`/`lat_casa`/`lon_casa`) y NEGOCIO (`direccion_negocio`/…); usar `linea` texto; `id_municipio` NULL (mapear luego). Insertar solo donde haya algún dato no vacío. `ON CONFLICT (id_cliente,tipo) DO NOTHING`.
   - `negocio_cliente`: desde `cliente.nombre_negocio`/`id_tipo_negocio`/`descripcion_negocio`/`antiguedad_negocio_meses` + `detalle_cliente.empleados_negocio`/`arriendo_negocio` (join por `id_cliente`). Solo clientes con negocio (≈69).
   - `perfil_financiero` (1:1): desde `detalle_cliente.*` **fusionando duplicados** — `personas_cargo = COALESCE(NULLIF(personas_cargo,0), dependientes)`, `patrimonio_estimado = COALESCE(NULLIF(patrimonio_estimado,0), ahorros)`; `arriendo_casa` va aquí, NO re-sumar a egresos. `ON CONFLICT (id_cliente) DO NOTHING`.
   - `cuenta_bancaria`: desde `detalle_cliente.banco_preferido`(texto)→FK `banco` (match por `lower(unaccent(nombre))`; dejar `id_banco` NULL si no matchea) + `tipo_cuenta_bancaria`/`numero_cuenta`.
2. Verificación en el mismo script (comentarios) — conteos origen==destino, 0 huérfanos, spot-check de fusiones.
3. Aplicar en Supabase vía MCP, verificar, commit. Pasar a FASE 4 (recablear backend).

---

## 1. ROL (para el agente)

Desarrollador Senior Fullstack + Arquitecto de BD, experto en:
- Serverless: Supabase (Postgres 15, Auth, Storage, RLS, pg_cron) + Next.js App Router en Vercel.
- Normalización 1FN–3FN/BCNF sin sobre-normalizar.
- Migraciones acopladas código↔BD sin downtime (expand → migrate → contract).
- Pagos Wompi/webhooks y trazabilidad financiera.

Mide antes de cortar, es explícito sobre riesgos, no rompe datos financieros.

## 2. CONTEXTO DEL PROYECTO

- **Plurall** = plataforma de créditos para comerciantes. Monorepo, app en `apps/web` (Next.js App Router). ~80 archivos de portales/APIs tocan `cliente`.
- **BD:** Supabase Postgres, migraciones **manuales** en `db/` (`01..23_*.sql` + `migration_v2_solicitar.sql`). Schema base: `db/plurall_database_completa.sql`. No hay Prisma/Drizzle/supabase-migrations. SQL se corre a mano en SQL Editor y se despliega Vercel enseguida.
- **Roles (4):** ADMIN, SUPERVISOR, ASESOR, CLIENTE. Portales: `app/admin`, `app/supervisor`, `app/asesor`, `app/dashboard`.
- **RLS** activo en tablas sensibles. Helpers: `es_admin()`, `es_analista_o_admin()`, `mi_id_cliente()`.
- **Auth:** extiende `auth.users` vía `perfil_usuario`; trigger `handle_new_user_registration` crea `perfil_usuario` + `cliente`.

## 3. OBJETIVO

Dejar la BD normalizada (3FN) y escalable eliminando tablas/columnas sobrecargadas y datos repetidos, y recablear backend + frontend. Se permite eliminar tablas y reconectar relaciones siempre que: no se pierdan datos (backfill verificado), la app quede probada al final de cada fase, y cada cambio quede como migración versionada.

## 4. MODELO OBJETIVO (revisado con datos reales)

```
cliente            → id, id_usuario_cuenta(FK perfil), id_estado_cliente, id_tipo_doc,
                     dni(uniq), email(uniq), telefono,
                     primer_nombre, segundo_nombre, primer_apellido, segundo_apellido,
                     created_at, updated_at
                     (SIN negocio, SIN ubicación, SIN finanzas, SIN score_credito, SIN nombre_completo)

direccion          → id, id_cliente(FK), tipo ENUM('CASA','NEGOCIO'),
                     linea, id_municipio(FK municipio), lat, lon

negocio_cliente    → id, id_cliente(FK, SIN unique = 1:N), nombre_negocio,
                     id_tipo_negocio(FK), descripcion, antiguedad_meses,
                     empleados, arriendo_negocio

perfil_financiero  → id, id_cliente(FK, UNIQUE 1:1), tipo_vivienda, estrato,
                     nivel_educativo, estado_civil, personas_cargo,
                     ingresos_mensuales, egresos_mensuales, patrimonio_estimado,
                     otras_obligaciones, arriendo_casa, colaboracion_gastos, tiene_vehiculo

cuenta_bancaria    → id, id_cliente(FK), id_banco(FK banco), tipo_cuenta, numero

vw_cliente_score   → VISTA con el último score del cliente (reemplaza cliente.score_credito)
```

### Reglas de resolución de duplicados (DECIDIDAS)
- **Fusionar ambos pares:** `personas_cargo` absorbe `dependientes`; `patrimonio_estimado` absorbe `ahorros`. Un solo campo por concepto (no se crean columnas `dependientes` ni `ahorros` en `perfil_financiero`).
- `arriendo_casa` va a `perfil_financiero`; NO re-sumar a `egresos_mensuales`.

### Mapa origen → destino (con datos reales, 85 clientes)
| Destino | Origen |
|---------|--------|
| `cliente` (adelgazada) | conserva identidad/contacto/nombre atómico |
| `direccion` | `cliente.direccion/ciudad/departamento` + `*_casa`/`*_negocio` (casi todo vacío) |
| `negocio_cliente` | `cliente.nombre_negocio`(69), `id_tipo_negocio`, `descripcion_negocio`, `antiguedad_negocio_meses` + `detalle_cliente.empleados_negocio`, `arriendo_negocio` |
| `perfil_financiero` | `detalle_cliente.*` (fusionando duplicados) — solo 3 filas |
| `cuenta_bancaria` | `detalle_cliente.banco_preferido`(texto→FK banco), `tipo_cuenta_bancaria`, `numero_cuenta` |
| `vw_cliente_score` | último `score` por solicitud |

## 5. DECISIONES CONFIRMADAS (2026-08-13)
1. **Aplicar `db/23` primero** en Supabase; luego regenerar schema maestro sin `nombre_completo`.
2. **Fusionar ambos pares** de duplicados (ver §4).
3. **`negocio_cliente` 1:N** (FK `id_cliente` sin UNIQUE).

## 6. REGLAS Y RESTRICCIONES
- No romper el núcleo financiero (solicitud→score→decisión→credito→plan_pago→cuota→pago) ni la normalización de nombres (1B+2A, helper `apps/web/lib/nombre.js`).
- Cada cambio de esquema = `db/NN_descripcion.sql` idempotente (`IF EXISTS`/`IF NOT EXISTS`).
- Orden de deploy: código listo → SQL en Supabase → deploy Vercel inmediato. Nunca código viejo contra BD nueva.
- RLS en toda tabla nueva (patrón `mi_id_cliente()`).
- Rama, no `main`. Commits atómicos por fase. Antes de cualquier `DROP`, pruebas verdes.
- Reportar honestamente. Preguntar solo si una decisión cambia el modelo.

## 7. CRITERIOS DE ACEPTACIÓN / PRUEBAS
**BD:** `cliente` sin negocio/ubicación/finanzas; 0 duplicados de concepto; catálogos por FK; backfill origen==destino, 0 huérfanos; schema maestro real.
**Backend** (datos de `docs/usuarios_prueba.json`): registro crea estructuras nuevas; solicitud RPC end-to-end; score + `vw_cliente_score`; webhook Wompi; cron mora; RLS por rol.
**Frontend:** CLIENTE (registro/dashboard/solicitar/pagar/perfil), ASESOR (clientes asignados/negocio/finanzas/cobranza), SUPERVISOR (búsqueda/mora/recientes), ADMIN (listado/detalle/desembolsar); búsqueda por nombre y negocio; grep sin referencias muertas.
**Ejecución real:** `npm run build` sin errores + smoke test por portal.

## 8. FASE 1 — pasos concretos para retomar
1. Verificar si `db/23` ya corrió: `node apps/web/scripts/utilidades/diagnostico_normalizacion.mjs` (¿sigue `nombre_completo`?).
2. Regenerar `db/plurall_database_completa.sql` al estado real: 4 roles, sin `nombre_completo`, con las tablas añadidas por migraciones (asignacion_asesor, evento_funnel, gestion_cobranza, historial_estado, log_error_registro, otp_recuperacion, pqr, notificacion_staff, banco, departamento, municipio, rango_puntaje_pregunta) y columnas nuevas (pregunta.tipo_input, respuesta_cliente.respuesta_numerica, cliente 4 partes nombre + casa/negocio, detalle_cliente v2). Marcar "estado consolidado a la fecha".
3. Verificar/actualizar `apps/web/lib/database.types.ts`.
4. Cerrar FASE 1 con resumen + commit; pasar a FASE 2 (migración 24).

## 9. ENTREGABLES YA PRODUCIDOS
- `apps/web/scripts/utilidades/diagnostico_normalizacion.mjs` — diagnóstico read-only re-ejecutable.
- `docs/FASE0_diagnostico_normalizacion.md` — reporte FASE 0.
- Este handoff.
- Commit en rama `feat/normalizacion-bd`.

## 10. ENTREGABLES PENDIENTES
- Migraciones `db/24..26_*.sql` idempotentes.
- `plurall_database_completa.sql` y `database.types.ts` actualizados.
- Backend y frontend recableados y compilando.
- `docs/deploy_normalizacion_bd.md` (checklist de deploy).
- Reporte de pruebas backend + frontend.
