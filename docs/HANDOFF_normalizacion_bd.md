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
| **FASE 3 — Migración 25 (backfill + verificación)** | ✅ COMPLETADA (aplicada en Supabase 2026-08-17) |
| **FASE 4 — Recablear backend** | ✅ COMPLETADA (dual-write + reads backend + score opción A) |
| **FASE 5 — Recablear frontend** | ✅ COMPLETADA (commit `c2a0afc`) |
| **FASE 6 — Migración 27 (CONTRACT / DROP)** | ✅ COMPLETADA (OK del usuario; contract código `7ca13bf` + `db/27` aplicada 2026-08-17) |
| **FASE 7 — Pruebas + build + docs** | ✅ COMPLETADA (schema+types regenerados, build verde, `docs/deploy_normalizacion_bd.md`) |

> **NORMALIZACIÓN COMPLETA (2026-08-17).** `cliente` adelgazada; `detalle_cliente` eliminada; datos en `negocio_cliente`/`direccion`/`perfil_financiero`/`cuenta_bancaria`/`vw_cliente_score`. 0 columnas legacy, 85 clientes intactos. Falta solo: merge de la rama y smoke test manual en runtime (checklist en `docs/deploy_normalizacion_bd.md`).
> Nota de numeración: `db/26` = enrichment `direccion.id_municipio`; `db/27` = CONTRACT/DROP.

### Estado de prerequisitos
- ✅ Migración **`db/23`** aplicada en Supabase (2026-08-13, vía MCP). `nombre_completo` eliminado; nombres atómicos 1B+2A vigentes. Código app recableado y commiteado (`deaf7a2`).
- ✅ Schema maestro + `database.types.ts` regenerados por introspección de la BD viva (FASE 1, `3f5abed`).
- ✅ Migración **`db/24`** aplicada en Supabase (2026-08-17, vía MCP). Creadas `direccion`, `negocio_cliente`, `perfil_financiero`, `cuenta_bancaria` + vista `vw_cliente_score`, con RLS (16 policies) y triggers `updated_at`. **Additivo/EXPAND**: 0 datos tocados, tablas nuevas vacías (backfill = FASE 3). Schema maestro + types resincronizados a `db/01..24`.

- ✅ Migración **`db/25`** aplicada en Supabase (2026-08-17, vía MCP). Backfill MIGRATE (no toca columnas origen). Verificado: **direccion 69**, **negocio_cliente 69** (==69 origen con nombre_negocio), **perfil_financiero 3** (==3 detalle_cliente), **cuenta_bancaria 0**; **0 huérfanos**, **0 negocios duplicados**. Fusión de duplicados escrita (dependientes→personas_cargo, ahorros→patrimonio_estimado) aunque hoy son 0 en toda la data.
  - **Decisión implícita a validar:** las 69 direcciones salieron del `cliente.ciudad`/`departamento` legacy (ej. "Barranquilla, Atlántico") y se etiquetaron **`tipo='NEGOCIO'`** (no hay ningún dato de CASA ni de dirección detallada). Si se prefiere `CASA` o un tipo neutro, ajustar en 25 antes del CONTRACT.

### FASE 4 — progreso (2026-08-17)
- ✅ **Write dual-write** en `/api/perfil` (commit `ec183ac`): al editar perfil sigue escribiendo columnas legacy de `cliente` Y espeja a `negocio_cliente` + `direccion` (NEGOCIO). Best-effort (no aborta el guardado si el espejo falla).
- ✅ Build verde (`npm run build` EXIT=0). Se corrigió de paso un blocker preexistente ajeno a la normalización: mezcla `||`/`??` sin paréntesis en `{asesor,supervisor}/notificaciones/page.js` (commit `791523c`).
- ⏳ **Faltan reads**: mover lecturas de negocio/finanzas/ubicación a las tablas nuevas y `score_credito` → `vw_cliente_score`. Sitios: `api/supervisor/buscar`, `api/reportes/export`, `app/{admin,supervisor}/clientes*`, `app/dashboard/perfil`, `app/asesor/*`.

> ✅ **DECISIÓN DEL USUARIO (score) = opción A** (2026-08-17): `vw_cliente_score` es la fuente única del score real. Los 62 clientes con score de seed pasan a "sin score". Mandato adicional del usuario: **no dejar tablas desconectadas ni código muerto** → en FASE 6 hay que dropear `cliente.score_credito` (y demás columnas legacy) y no dejar referencias muertas. Backend ya recablea el score desde la vista (commit `aa7c149`); falta el frontend (FASE 5).

### FASE 5 — worklist (frontend, reads a tablas nuevas)
Archivos que aún leen columnas legacy (grep 2026-08-17). Cada uno debe leer negocio desde `negocio_cliente`, ubicación desde `direccion`→`municipio`→`departamento`, finanzas desde `perfil_financiero`, score desde `vw_cliente_score`:
- `components/EditarPerfilForm.js` (form de perfil: ciudad, departamento, nombre_negocio, descripcion_negocio, antiguedad_negocio_meses)
- `app/dashboard/perfil/page.js` (fetch que alimenta el form)
- `app/dashboard/creditos/solicitar/page.js`
- `app/admin/clientes/page.js`, `app/admin/clientes/[id]/page.js`, `app/admin/solicitudes/[id]/page.js`
- `app/supervisor/clientes/page.js`, `app/supervisor/buscar/page.js`, `app/supervisor/solicitudes/page.js`, `app/supervisor/solicitudes/[id]/page.js`
- `app/asesor/clientes/page.js`, `app/asesor/cobranza/[clienteId]/page.js`
Nota: el dual-write mantiene sincronizadas las columnas legacy, así que estas pantallas siguen funcionando hasta el DROP; pero deben migrarse antes de FASE 6.

### FASE 6 — CONTRACT / DROP (⛔ checkpoint — requiere OK explícito del usuario)
Migración **`db/27_normalizacion_contract.sql`** ya redactada (idempotente, transaccional), **NO aplicada**. Dropea de `cliente`: `direccion, ciudad, departamento, nombre_negocio, id_tipo_negocio, descripcion_negocio, antiguedad_negocio_meses, score_credito` + los 10 campos `*_casa`/`*_negocio`; y **DROP TABLE `detalle_cliente`**. Todo ya migrado y verificado (backfill 25/26, reads 4/5).

**Bloqueadores de código que hay que resolver ANTES de aplicar `db/27`** (parte de FASE 6):
1. `apps/web/app/api/perfil/route.js` (PATCH): hoy hace dual-write (escribe columnas legacy en `cliente` + espeja a tablas nuevas). Cambiar a **solo** escribir `telefono` en `cliente` y mandar negocio→`negocio_cliente`, ubicación→`direccion` (con lookup de `municipio`), sin tocar columnas legacy. Sin esto, tras el DROP el PATCH falla.
2. Scripts de seed (`apps/web/scripts/utilidades/seed_historico_*.mjs`, `seed_supervisor_asesor.mjs`) insertan estas columnas en `cliente`/`detalle_cliente`. Actualizarlos al modelo nuevo o marcarlos obsoletos (son utilidades dev).
3. `diagnostico_normalizacion.mjs` es read-only y tolera la ausencia; puede quedarse.

**Orden seguro:** desplegar (1) y (2) → `npm run build` verde + smoke → aplicar `db/27` en Supabase → regenerar `plurall_database_completa.sql` + `database.types.ts` (FASE 7) → grep final sin referencias muertas.

### FASE 4 — pasos concretos para retomar (recablear backend)
Objetivo: que registro/lectura usen las tablas nuevas en vez de las columnas sobrecargadas de `cliente`/`detalle_cliente`, SIN romper el núcleo financiero ni la normalización de nombres. Orden: código primero, luego (ya en FASE 6) el DROP.
1. Grep de escrituras/lecturas a columnas a eliminar: `nombre_negocio`, `id_tipo_negocio`, `descripcion_negocio`, `antiguedad_negocio_meses`, `direccion*`, `ciudad*`, `departamento*`, `lat_*`, `lon_*`, `score_credito` en `apps/web` (endpoints de registro `/api/registro*`, portales asesor/admin que muestran negocio/finanzas, `detalle_cliente`).
2. Registro/onboarding: al crear cliente, escribir también `negocio_cliente`/`direccion`/`perfil_financiero`/`cuenta_bancaria` (dual-write mientras conviven columnas). Revisar el trigger `handle_new_user_registration` y los endpoints de registro.
3. Lecturas: negocio desde `negocio_cliente`, finanzas desde `perfil_financiero`, ubicación desde `direccion`, score desde `vw_cliente_score` (no `cliente.score_credito`).
4. `npm run build` verde + smoke por portal. Commit. Luego FASE 5 (frontend) y **PARAR a confirmar antes de FASE 6 (DROP)**.

### FASE 3 — pasos concretos (COMPLETADA — histórico)
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
