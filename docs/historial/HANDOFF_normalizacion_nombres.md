# Handoff — Normalización de nombres (continuar mañana)

**Fecha:** 2026-08-01  
**Estado del código en el repo:** IMPLEMENTADO (1B + 2A)  
**Estado en Supabase (remoto):** PENDIENTE ejecutar migración (si aún no la corriste)

Cuando retomes con Cursor, di algo como:  
> "Lee `docs/HANDOFF_normalizacion_nombres.md` y seguimos con el deploy de la normalización de nombres"

---

## Decisiones acordadas

| # | Decisión |
|---|----------|
| **1B** | Eliminar columna `nombre_completo` (no usar columna generada). |
| **2A** | Nombre canónico de **clientes** solo en tabla `cliente`. En `perfil_usuario` el nombre atómico queda solo para **asesor / supervisor / admin**. |

### Modelo de datos objetivo

```
cliente:
  primer_nombre (NOT NULL)
  segundo_nombre (nullable)
  primer_apellido (NOT NULL)
  segundo_apellido (nullable)
  — SIN nombre_completo

perfil_usuario:
  mismas 4 columnas, pero NULL para rol CLIENTE
  llenas solo para roles internos
```

La app concatena con `formatNombre()` en `apps/web/lib/nombre.js`.

---

## Qué ya está hecho en el repositorio

### SQL
- [`db/23_eliminar_nombre_completo.sql`](../db/23_eliminar_nombre_completo.sql) — migración completa (backfill, regla 2A, drop columna, trigger nuevo).
- Triggers en repo actualizados: [`db/16_integridad_dominios_y_registro.sql`](../db/16_integridad_dominios_y_registro.sql), [`db/20_disponibilidad_registro_y_trigger.sql`](../db/20_disponibilidad_registro_y_trigger.sql).

### App
- Helper: [`apps/web/lib/nombre.js`](../apps/web/lib/nombre.js) — `formatNombre`, `parseNombre`, `primerNombre`, `orBusquedaNombre`.
- Registro con 4 campos: [`apps/web/app/registro/page.js`](../apps/web/app/registro/page.js).
- Funnel: [`apps/web/components/CreditFunnelModal.js`](../apps/web/components/CreditFunnelModal.js).
- ~80 archivos de portales/APIs: selects y renders sin `nombre_completo` (verificar: grep solo debe hallar el comentario en `lib/nombre.js`).
- Types: [`apps/web/lib/database.types.ts`](../apps/web/lib/database.types.ts).
- Seeds alineados (perfil CLIENTE sin nombre).
- Guía corta de deploy: [`docs/deploy_normalizacion_nombres.md`](./deploy_normalizacion_nombres.md).

### Otros cambios del mismo día (contexto aparte)
- Cron mora: horario `55 4 * * *` UTC = **11:55 p.m. Colombia** (`apps/web/vercel.json`).
- Límite max 30 en pregunta “personas que dependen de usted” (`apps/web/app/dashboard/creditos/solicitar/page.js`).
- Google OAuth: hay que habilitarlo en Supabase Auth (config, no código).

---

## Qué falta hacer mañana (tú / con el agente)

### 1. Verificar si la migración ya corrió en Supabase

SQL Editor:

```sql
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('cliente', 'perfil_usuario')
  AND column_name IN (
    'nombre_completo',
    'primer_nombre', 'segundo_nombre', 'primer_apellido', 'segundo_apellido'
  )
ORDER BY table_name, column_name;
```

- Si **sigue existiendo** `nombre_completo` → ejecutar el paso 2.
- Si **solo** aparecen las 4 partes → migración ya aplicada; ir al paso 3.

### 2. Ejecutar migración (si falta)

1. Abrir Supabase → SQL Editor.
2. Pegar y ejecutar todo el contenido de `db/23_eliminar_nombre_completo.sql`.
3. Revisar que el SELECT final no liste `nombre_completo`.

### 3. Deploy acoplado

**Orden obligatorio:**

1. Código nuevo en repo (ya está).
2. SQL en Supabase.
3. Deploy a Vercel **enseguida**.

No dejes código viejo contra BD nueva (rompe la app).

### 4. Checklist de prueba post-deploy

- [ ] Registro con primer nombre + primer apellido (segundos opcionales).
- [ ] Autocompletar Google → partes precargadas.
- [ ] Dashboard cliente: saludo con `primer_nombre`.
- [ ] Admin/Supervisor: listado y búsqueda por nombre/apellido.
- [ ] Asesor: nombre del cliente visible.
- [ ] Pago Wompi: nombre del pagador correcto.
- [ ] Table Editor: sin columna `nombre_completo`.

---

## Archivos clave para retomar

| Archivo | Para qué |
|---------|----------|
| `docs/HANDOFF_normalizacion_nombres.md` | Este handoff |
| `docs/deploy_normalizacion_nombres.md` | Checklist deploy corto |
| `db/23_eliminar_nombre_completo.sql` | SQL a correr en Supabase |
| `apps/web/lib/nombre.js` | Concatenar / parsear nombres |
| Plan: `.cursor/plans/normalizar_nombres_bd_2a6c91d2.plan.md` | Plan original (no editar salvo que pidas) |

---

## Posibles siguientes tareas (después del deploy)

- Revisar sample de clientes con nombres de 1 sola palabra (quedaron `primer_apellido = 'NOMBRE'` si no había apellido).
- Ajustar UI de perfil para editar las 4 partes.
- Confirmar Google Provider habilitado en Supabase Auth.
- Deploy del cambio de cron mora (si aún no está en Vercel).

---

## Nota para el agente de mañana

No reimplementar la normalización desde cero: el código del repo ya está.  
Prioridad: **confirmar/aplicar SQL 23 en Supabase + deploy + pruebas**.
