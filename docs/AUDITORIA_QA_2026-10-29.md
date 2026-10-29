# Auditoría QA y corrección de bugs — 29-oct-2026

Rama: `fix/auditoria-qa-20261029` (base `origin/develop` @ `a52c090`).

## A. Resumen ejecutivo

- **Fuentes:** 4 PDF del 29-oct (Camila Ávila 4, Jeferson Lugo 15, Juan Maurello 18, Wilder Feo 8 = **45 hallazgos**). También el documento de pruebas Vitest en `Estudio/evidencia`; los ejercicios PHP/Python de esa carpeta no son de Plurall.
- **Auditoría adicional:** backend/financiero, seguridad (51 rutas API) y frontend. Encontró **8 defectos nuevos** (NEW-01..07, INF-01) y **13 de seguridad** (S-C1, S-C2, H1–H4, M1–M8).
- **Corregidos con prueba automatizada que fallaba antes:** 30 hallazgos. Detalle en la sección B.
- **Tests:** 22 → **101** (3 → 16 archivos), todos en verde.
- **Calidad:** el lint queda igual a la línea base (4 errores preexistentes, ninguno en código tocado) y el build de producción termina bien.
- **Riesgos críticos encontrados y corregidos:**
  - Fuga de cartera a cualquier cliente autenticado (S-C1).
  - Toma de cuenta por fuerza bruta del OTP (S-C2).
  - Tasa desembolsada distinta de la aprobada: 28 % EA pasaba a 31,89 % (NEW-05).
  - Webhook de Wompi que no validaba ningún evento real (NEW-07).
  - Doble aplicación de pagos y del saldo a favor (H1).
  - Pagos en efectivo que no actualizaban cuota ni crédito (J-06).
- **Git:** `develop` ya contenía todas las ramas de código. Solo `main` tiene un `.docx` que no está en `develop`. `fix/develop-bugs` es igual a `develop` (sin correcciones).

## B. Inventario de defectos

Estados posibles:
- **C+T**: corregido, con test que fallaba antes del fix.
- **C**: corregido, verificado por inspección (sin test automatizado viable).
- **NR**: no reproducible.
- **DN**: requiere decisión de negocio.
- **P**: pendiente.

### Corregidos

| ID | Severidad | Causa raíz | Estado | Test / commit |
|---|---|---|---|---|
| S-C1 | Crítica | 3 rutas `/api/supervisor/*` con service-role sin control de rol | C+T | seguridad.supervisorApi / a159c39 |
| S-C2 | Crítica | OTP de recuperación sin límite de intentos | C+T | seguridad.otp / 3a59a6c |
| NEW-06 | Alta | `rateLimit` pasaba segundos a PEXPIRE (que usa ms): ningún rate limit funcionaba con Redis | C+T | seguridad.otp / 3a59a6c |
| NEW-05 | Crítica | EA convertida a EM nominal (/12) y reconvertida como efectiva: 28 % EA → 31,89 % | C+T | condicionesCredito / ba98b9e |
| NEW-07 | Crítica | Firma Wompi sin `timestamp` ni `properties`: ningún evento real validaba | C+T | seguridad.wompiWebhook / 27edec5 |
| H1 | Alta | Webhook re-aplicaba cuotas ya pagadas y el saldo a favor | C+T | ídem / 27edec5 |
| H2a, H2c, H2e, H2g | Alta | Secreto vacío aceptado; monto distinto solo se registraba en log; DECLINED revertía un pago confirmado; `.catch` inválido | C+T | ídem / 27edec5 |
| H2d | Alta | Idempotencia check-then-act | C (no reproducible en BD en memoria) | ídem / 27edec5 |
| M5 | Media | Cron abiertos sin `CRON_SECRET`; firma de integridad con secreto vacío | C+T | seguridad.cron / a662a88 |
| H4 | Alta | XSS almacenado en documentos legales | C+T | seguridad.documentosXss / 44d25ac |
| H3 (parcial) | Alta | DELETE de lockout sin autenticación (desbloqueo de cuentas ajenas) | C+T | seguridad.lockout / 6ca2f15 |
| J-03 | Media | `new Date(y, m+k, d)` desborda en días 29–31 (salta un mes; no duplica) | C+T | fechasCuotas / 976b1bb |
| NEW-04 | Baja | Mismo desborde en la agrupación mensual del dashboard | C | 089015c |
| M-15, M-16, M-17, M-18 | Alta | Aprobación y desembolso sin validar monto, plazo y tasa | C+T | condicionesCredito / ba98b9e |
| J-06, J-07 | Crítica | Efectivo no actualizaba cuota ni crédito; desagregación incoherente | C+T | credito.efectivo, cobranza.pagoEfectivo / d731204 |
| J-11 | Alta | Mora sobre cuota total (decisión: sobre capital) | C+T | pagos.mora / a502e49 |
| J-13 | Media | Crédito saldado quedaba CANCELADO (decisión: PAGADO) | C+T | credito.estado / 87c7115 |
| M-02, M-03 | Baja | Estado "EN_MORA" sin traducir en la ficha y en los PDF | C+T | estados / 95e7cb9 |
| J-14 | Media | Tasa de mora mostrada 100 veces menor | C+T | calculadora / 1885efe |
| W-06 | Baja | Columna SOLICITUDES leída con la forma de dato equivocada | C | 4123d02 |
| J-02 | Baja | Barra de avance siempre verde | C | fdc3cee |
| M-11 | Media | `visible_cliente` marcado por defecto, contra BD y documentación | C | b9e6bdd |

### Pendientes, no reproducidos o que requieren decisión

| ID | Estado | Nota |
|---|---|---|
| W-01 | Ya corregido antes | 533b2cc (la sesión de prueba probablemente usó un build anterior) |
| W-03 | Prevención ya corregida | ab3cabf. Los datos existentes no se modificaron |
| W-02, W-04 | Dato | Valores de relleno del trigger de registro (`db/33`) |
| J-05, J-15 | NR | RLS lo cubre; solo aporta defensa en profundidad |
| J-08 | Parcial | La diferencia real es de ±1 peso por fila; los $1.000 del reporte son un error aritmético. DN: ajuste de la última cuota |
| M1 | DN | La originación del asesor es un pool abierto por diseño |
| M-01 | DN | Bloquear o solo alertar un desembolso con KYC rechazado |
| M-05, M-14 | DN | Longitud mínima de motivos y notas |
| M-08, M-09, M-10, M-12, M-13 | P | Conectar el catálogo de motivos (funcionalidad); unicidad y longitud |
| W-05 | DN | Escala del score (sumas mayores que 1000) |
| J-01, J-12 | DN (UX) | Navegación al detalle; umbral de urgencia de "próximo pago" |
| C-01 | P | El servidor bloquea el duplicado; la UI puede mostrar un falso éxito (configuración de GoTrue) |
| C-02, C-03, C-04, J-09, J-10, M-07, W-07, W-08 | P | UX y funcionalidad. C-04 requiere migración |
| J-04, M-04 | P | Mora dependiente del cron; `dias_mora_maximo` desactualizado |
| M2, M3, M4, M6, M7, M8 | P (BD) | Políticas RLS, UNIQUE y CHECK. Requieren migraciones y autorización |
| INF-01 | P | `@sentry/nextjs@8` no admite `next@16`: `npm ci` falla sin `--legacy-peer-deps` |

## C. Git

- **Ramas analizadas:** `Develop` (b7ebcd3), `develop` y `fix/develop-bugs` (a52c090), `feat/normalizacion-bd` (ed312d1), `main` (1095761), PR #1.
- **Correcciones fuera de `develop`:** ninguna de código.
- **Riesgo de Windows:** `Develop` y `develop` difieren solo en mayúsculas. No se debe crear una rama local `develop` junto a `Develop`.
- La ref empaquetada local `origin/Develop` (1b83f0c) está obsoleta.

## D. Pruebas

- **Comando:** `npx vitest run` (vitest 4.1.10).
- **Antes:** 22/22 (solo funciones puras).
- **Después:** 101/101.
- `vitest.config.mjs` agrega el alias `@` para probar los route handlers reales con Supabase simulado (`tests/helpers/fakeSupabase.js`, que respeta los filtros en `update`).
- **Limitación:** la BD en memoria no reproduce la concurrencia de Postgres.
- Las consultas a la BD desplegada fueron **solo de catálogo** (triggers, CHECK, columnas), sin leer filas de clientes.

## E. Riesgos residuales

- Confirmación de pagos (Wompi y efectivo) sin transacción. Recomendado: mover a una función SQL.
- Doble desembolso concurrente: no hay UNIQUE en `credito.id_solicitud`.
- Lockout solo informativo: el login va del navegador a Supabase Auth.
- Datos históricos sin migrar:
  - Decisiones con tasa nominal y créditos desembolsados con una tasa mayor a la aprobada (NEW-05).
  - Créditos en CANCELADO por pago normal.
  - Pagos en efectivo antiguos sin aplicar (J-06).
- Mora en pagos en efectivo: hoy no se cobra. Requiere decisión.
- Rangos comerciales de aprobación (montos, plazos, tasa máxima legal): sin definir.
