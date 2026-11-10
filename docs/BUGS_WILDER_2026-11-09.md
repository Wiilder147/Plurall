# Corrección de bugs asignados a Wilder — 09-nov-2026

Rama: `fix/bugs-wilder-20261109` (base `chore/main-limpieza-20261105` @ `c07c29f` = `origin/develop` 7157779 + 5 commits de limpieza).
Tablero: [Plurall — Sprints (develop)](https://trello.com/b/HyoaCUo5/plurall-sprints-develop). Equivalencia de IDs con `AUDITORIA_QA_2026-10-29.md`: BUG-JM-xx = M-xx, BUG-WF-xx = W-xx, BUG-CA-xx = C-xx.

## A. Resumen ejecutivo

- **Bugs analizados:** 6. Son 6, no 7: el "7" fue un error de conteo en el mensaje anterior.
- **Corregidos en código:** 6. Hay 2 migraciones (46 y 47) escritas y **sin aplicar**: quedan a la espera de autorización.
- **Bloqueados:** 0.
- **Requieren decisión:** remediación de datos históricos (sección F).
- **Hallazgo principal:** 4 de los 6 ya se habían corregido el 29-oct (JM-01 parcial, JM-04 parcial, JM-18 y WF-05), pero las tarjetas seguían en Backlog.
- **Riesgo operativo:** las correcciones no parecen estar desplegadas. `origin/main` es de marzo y el cron de Vercel `/api/cron/mora` no corre desde el 30-oct.
- **Pruebas:** 149 → **186**, todas en verde. Lint sin problemas y build de producción correcto.

## B. Matriz de resultados

| Bug | Causa raíz | Corrección | Pruebas | Estado |
|---|---|---|---|---|
| JM-01 | El desembolso no validaba el KYC. El 29-oct solo se bloqueó el KYC **rechazado**, y la tarjeta pide también el **pendiente** | `bloqueoKyc`: la cédula frontal y la trasera deben estar APROBADAS y no puede haber ningún documento RECHAZADO. Aplica en pre-aprobar, aprobar, desembolsar y desembolso en lote | `kyc.bloqueo.test.js`: 5 rutas reales y 3 de la función | RESUELTO en código |
| JM-04 | El job pg_cron `fn_detectar_mora` (el único que corre) nunca escribe `dias_mora_maximo` ni refresca los créditos que ya estaban en mora | El estado de cuenta ya calculaba en vivo (corregido el 29-oct). La **migración 46** corrige la causa en la BD | `credito.mora`, `cron.mora` (existentes). Simulación en BD de solo lectura: corrige 41 créditos (desfase máximo de 190 días) y nada más | EN VALIDACIÓN (falta aplicar la 46) |
| JM-18 | Aprobar y desembolsar no validaban el plazo | Ya corregido (`validarCondicionesAprobacion` y el CHECK de la migración 40). Se agregaron pruebas de la ruta de desembolso | -36, 0, 12.5, NaN, null, "", "36" e Infinity → 422 sin crear crédito | RESUELTO |
| WF-02 | El trigger de registro guarda `'SN'+hex` si no llega el `dni`; el registro era solo del lado del navegador (sin validación en servidor); 25 vistas mostraban el valor tal cual | `lib/dni.js` (`documentoVisible`): las 25 vistas, PDFs, reportes, `verificar-ref` y Wompi muestran "—" u omiten el dato. El paz y salvo se bloquea sin cédula real. El registro en servidor exige el dni | `dni.test.js`, `registro.servidor.test.js` | RESUELTO en código |
| WF-05 | Puntos crudos sin escalar | Ya corregido (migración 44). Se agrega la **migración 47**: CHECK de rango (valida, no recorta) | BD: 0 de 15 fuera de rango; el máximo es 850 | RESUELTO (la 47 es defensa en profundidad) |
| CA-01 | `signUp` directo desde el navegador, sin validación en servidor | `/api/auth/registro`: valida y normaliza, consulta `id_usuario_por_celular` y crea el usuario con `admin.createUser` (Auth garantiza unicidad del email sintético). Revierte el usuario de Auth si el trigger no creó el cliente | `registro.servidor.test.js` (duplicado, normalización, concurrencia, reversión, 10 casos de validación) | RESUELTO en código |

## C. Detalle técnico

### JM-01
- **Regla implementada (decisión del 09-nov-2026):** el KYC está completo cuando hay una versión activa APROBADA de `CEDULA_FRONTAL` y otra de `CEDULA_TRASERA`, y ningún documento activo está RECHAZADO. Los soportes (recibo, extracto) no cuentan como KYC.
- **Archivos:** `lib/kyc.js` y cuatro rutas:
  - `api/admin/solicitud/[id]`
  - `api/asesor/solicitudes/[id]`
  - `api/admin/desembolsar/[id]`
  - `api/admin/desembolsar/batch`
- **Impacto operativo:** en la BD hay 25 documentos PENDIENTES. Las solicitudes de esos clientes no se pueden pre-aprobar hasta que el staff verifique la cédula. Asesor, supervisor y admin ya pueden verificar documentos.
- **Riesgo residual:** el control vive en la API (service role). No hay restricción en la BD que impida insertar en `credito` sin KYC.

### JM-04
- **Definición:** `dias_mora_maximo` es el máximo histórico de días de atraso de la obligación y nunca baja. El atraso actual se mide desde la cuota no pagada más antigua, con la fecha de Colombia. Es la misma definición que usan `resumenMora` y `/api/cron/mora`.
- **Migración 46:** solo toca indicadores derivados (estado de la cuota y del crédito, `cuotas_en_mora`, `dias_mora_maximo`). No modifica saldos ni pagos. Es idempotente.

### WF-02
- **Diferencias frente a lo planteado:**
  - En Wompi se **omite** el `legal-id` en vez de bloquear el pago, para no impedir el recaudo.
  - El contrato y el estado de cuenta muestran "—" y no se bloquean.
  - El paz y salvo sí se bloquea.
- **Regla del dni (5–12 dígitos):** no existía una regla de negocio. Se eligió con base en el `maxLength` que ya tenía el formulario y se puede ajustar en `DNI_REGEX`.

### CA-01
- **Concurrencia:** dos altas con el mismo celular chocan en la unicidad del email de Auth, y el trigger de la migración 39 cubre `cliente.telefono` con advisory lock. No depende de la consulta previa.
- **Comportamiento visible:** el endpoint confirma si un celular está registrado, igual que antes (`signUp` y login). Rate limit: 5 cada 10 minutos por IP.

## D. Auditoría de cambios

- **Nuevos:**
  - `app/api/auth/registro/route.js`
  - `lib/dni.js`
  - 3 archivos de prueba
  - `db/46_detectar_mora_dias_maximo.sql` y `db/47_check_rango_score.sql` (**sin aplicar**)
- **Modificados:**
  - `lib/kyc.js`, `lib/documentos.js`
  - `lib/documentosHandler.js` (`extraValidate` recibe también el titular; es compatible con lo anterior)
  - 4 rutas de crédito, 4 rutas de documentos, pagos y reportes
  - `registro/page.js`
  - 25 vistas
- **Contrato de API:**
  - Nuevo `POST /api/auth/registro`.
  - Los endpoints de aprobación y desembolso responden 409 con `MENSAJE_KYC_INCOMPLETO`.
  - `verificar-ref` y `pagos/iniciar` devuelven `dni: null` cuando el valor es de relleno.
- **Dependencias:** ninguna.
- **Eliminados:** ninguno.

## E. Resultados de calidad

| Verificación | Resultado |
|---|---|
| Unit e integración (Vitest, rutas reales con BD en memoria) | 186/186 |
| Lint (`eslint`) | 0 problemas |
| Build (`next build`) | Correcto |
| E2E (Playwright) | **No ejecutado:** requiere un build con credenciales reales y escribiría en la BD compartida |
| Concurrencia real en Postgres | No reproducible en memoria. Se cubre con la unicidad de Auth y los triggers de la migración 39 |
| BD | Solo consultas de lectura (conteos agregados, catálogo y simulación de la 46) |

## F. Recomendaciones y pendientes

- **CRÍTICO:** desplegar `develop` en producción. Hoy `main` es de marzo y el cron `/api/cron/mora` no corre.
- **ALTO:** aplicar las migraciones 46 y 47 en Supabase (necesita autorización).
- **ALTO:** remediar los datos históricos. **No se ejecutó nada.** Hay que revisarlo caso por caso:
  - El crédito ACTIVO de prueba con -36 cuotas y su decisión.
  - 1 crédito vigente con KYC rechazado y 2 con KYC pendiente.
  - 5 clientes con documento "SN…" (hay que pedirles la cédula).
  - 1 par de celulares repetidos y 4 clientes con `0000000000`.
- **ALTO:** el CAPTCHA del registro figura como "Hecho" en Trello, pero no está en el código.
- **MEDIO:** las vistas de tramos de mora y cobranza usan el máximo histórico como si fuera el atraso actual. Conviene separar los dos conceptos.
- **MEDIO:** el job pg_cron `refresh-vistas-cartera` falla todos los días.
- **MEDIO:** el desembolso fija `tasa_mora_diaria: 0.001` en `plan_pago`, aunque la mora se topa a la usura (NEW-08). Hay que confirmar si ese campo se usa.
- **BAJO:** `/api/auth/rate-limit` quedó sin uso.

## G. Resto del Backlog (24 tarjetas, 10-nov-2026)

Las 24 tarjetas restantes del Backlog se cruzaron con el código actual (rama `fix/bugs-wilder-20261109`, que contiene `develop`). Solo 2 seguían abiertas; las otras 22 se corrigieron el 29-oct y sus commits están en la rama.

| Tarjeta | ID auditoría | Estado | Evidencia |
|---|---|---|---|
| BUG-JM-02, BUG-JM-03 | M-02, M-03 | Corregido (29-oct) | 95e7cb9 · `estados.test` |
| BUG-JM-05, BUG-JM-14 | M-05, M-14 | Corregido (29-oct) | 99f89f8 · `validacion.test` (motivo 5–150, nota 10–500, ≥3 letras) |
| BUG-JM-06 | M-06 | Corregido (29-oct) | 99f89f8 |
| BUG-JM-07 | M-07 | Corregido (29-oct) | a94c873 |
| BUG-JM-08, BUG-JM-09, BUG-JM-10 | M-08..M-10 | Corregido (29-oct) | fefc046 · `motivos.rechazo.test` |
| BUG-JM-11 | M-11 | Corregido (29-oct) | b9e6bdd |
| BUG-JM-12 | M-12 | Corregido (29-oct) | 61158ad · `motivos.duplicados.test` |
| BUG-JM-13 | M-13 | Corregido (29-oct) | 99f89f8 (máximo 150 caracteres) |
| BUG-JM-15, BUG-JM-16, BUG-JM-17 | M-15..M-17 | Corregido (29-oct) | ba98b9e · `condicionesCredito.test`; migración 40 (CHECK) |
| BUG-WF-01 | W-01 | Corregido (antes del 29-oct) | 533b2cc |
| **BUG-WF-03** | W-03 | **Corregido hoy** | c0e61cc: `celularVisible()` en 26 puntos de UI y en el CSV; los enlaces de llamada y WhatsApp solo aparecen con un número real. La prevención en el registro ya existía (ab3cabf, db/33 y db/39) |
| **BUG-WF-04** | W-04 | **Corregido hoy** | c0e61cc: `formatNombre` omite el apellido de relleno `NOMBRE`; el registro en servidor exige apellido (bffd315) · `placeholders.test` |
| BUG-WF-06 | W-06 | Corregido (29-oct) | 4123d02 |
| BUG-WF-07 | W-07 | Corregido (29-oct) | 3bc734f |
| BUG-WF-08 | W-08 | Corregido (29-oct) | d2731fd |
| BUG-CA-02 | C-02 | Corregido (29-oct) | 4b2657c |
| BUG-CA-03 | C-03 | Corregido (29-oct) | 1e4e376 · `geocodificacion.test` |
| BUG-CA-04 | C-04 | Corregido (29-oct) | 11ef19d + migración 41 (aplicada) |

**Datos no modificados (requieren remediación manual):** 4 clientes con `0000000000` y los clientes con apellido `NOMBRE`. La UI ya no muestra esos valores, pero hay que pedir el dato real a cada cliente.

**Calidad tras este cambio:** Vitest 191/191 (29 archivos), ESLint sin problemas y `next build` correcto.
