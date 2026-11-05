# PLURALL — Sprint 3: Solicitud de Crédito y Documentos KYC
## Documentación Técnica

> **Proyecto Formativo SENA** | Tecnólogo ADSO | Instructor: Jefry González
> **Versión:** Sprint 3 en curso
> **Prerrequisito:** Sprint 1 y Sprint 2 completados

---

## 1. Objetivo del Sprint 3

Habilitar el flujo central del negocio: que un cliente **simule, solicite un crédito** y **suba sus documentos KYC** desde su portal privado.

---

## 2. Archivos Nuevos o Modificados

```
apps/web/
├── app/dashboard/
│   ├── creditos/
│   │   ├── page.js                  ← NUEVO: Lista de solicitudes y créditos
│   │   └── solicitar/
│   │       └── page.js              ← NUEVO: Simulador interactivo + Formulario
│   └── documentos/
│       └── page.js                  ← NUEVO: Carga de documentos KYC
├── components/
│   └── DashboardSidebar.js          ← MODIFICADO: 2 ítems nuevos de navegación
└── app/dashboard/inicio/page.js     ← MODIFICADO: Enlace "Solicitar Crédito" arreglado
```

---

## 3. Descripción de Cada Archivo

### 3.1 `app/dashboard/creditos/solicitar/page.js` — Simulador + Solicitud

**Directiva:** `'use client'` — toda la interacción del slider ocurre en el navegador.

**¿Qué hace?**

**Fase 1 — Simulación en vivo:**
- Slider de **monto** entre $500.000 y $10.000.000 COP (paso de $100.000).
- Selector de **plazo** por botones: 3, 6, 9, 12, 18 y 24 meses.
- Al mover cualquier control, `calcularAmortizacion()` de `lib/calculadora.js` recalcula al instante sin tocar el servidor.
- Panel derecho muestra: cuota mensual, total de intereses, total a pagar y las primeras 3 cuotas de la tabla de amortización.

**Fase 2 — Envío de solicitud:**
1. El usuario escribe el **propósito** del crédito (obligatorio, máx 300 chars).
2. Al hacer clic en "Enviar Solicitud":
   - Llama a `supabase.auth.getUser()` para identificar al usuario.
   - Consulta la tabla `cliente` para obtener `id_cliente`.
   - Consulta la tabla `estado_solicitud` para obtener el UUID del estado `'PENDIENTE'`.
   - Inserta en `solicitud_credito` con `monto_solicitado`, `plazo_meses`, `tasa_interes_propuesta`, `proposito` y `canal_solicitud = 'WEB'`.
3. Si todo está bien → muestra pantalla de éxito con CTA a "Mis Créditos".

**Constantes de negocio:**
| Constante | Valor | Explicación |
|-----------|-------|-------------|
| `MONTO_MIN` | $500.000 | Crédito mínimo aprobable |
| `MONTO_MAX` | $10.000.000 | Límite operativo Sprint 3 |
| `TASA_ANUAL` | 28% EA | Tasa plataforma (ajustable en Sprint 5) |
| `PLAZO_OPTS` | 3,6,9,12,18,24 | Plazos disponibles en meses |

---

### 3.2 `app/dashboard/creditos/page.js` — Mis Créditos

**Tipo:** Server Component (SSR).

**¿Qué hace?**
- Obtiene el usuario autenticado y su `id_cliente`.
- Consulta `solicitud_credito` con un join a `estado_solicitud` para obtener el nombre del estado.
- Ordena por `fecha_solicitud DESC` (más reciente primero).
- Si no hay solicitudes, muestra un estado vacío con CTA al simulador.
- Si hay solicitudes, las lista con su monto, plazo, fecha, propósito y estado visual (badge de color).

**Mapa de estados visuales:**
| Estado DB | Label | Color |
|-----------|-------|-------|
| `PENDIENTE` | Pendiente | Amarillo |
| `EN_ESTUDIO` | En estudio | Azul |
| `APROBADA` | Aprobada | Verde esmeralda |
| `DESEMBOLSADA` | Activo | Verde |
| `RECHAZADA` | Rechazada | Rojo |
| `CANCELADA` | Cancelada | Gris |

---

### 3.3 `app/dashboard/documentos/page.js` — Documentos KYC

**Directiva:** `'use client'` — necesita `useState` para el estado de subida.

**¿Qué hace?**
- Carga en un `useEffect` los documentos ya subidos del cliente.
- Muestra una barra de progreso: documentos subidos / total requeridos.
- Para cada tipo de documento KYC muestra:
  - Nombre, descripción y formatos aceptados.
  - Badge de estado (En revisión / Aprobado / Rechazado).
  - Botón "Subir documento" (o "Reemplazar" si ya existe).
- Al seleccionar un archivo:
  1. Valida el tamaño (máx 10 MB).
  2. Sube al bucket privado `documentos-kyc` de Supabase Storage.
  3. Genera una URL firmada con validez de 1 año.
  4. Hace `upsert` en la tabla `documento_cliente` con `estado_verificacion = 'PENDIENTE'`.
  5. Actualiza el badge en la UI sin recargar la página.

**Documentos requeridos:**
| Tipo | Formatos |
|------|---------|
| `CEDULA_FRONTAL` | JPG, PNG, PDF |
| `CEDULA_TRASERA` | JPG, PNG, PDF |
| `RUT` | PDF |
| `EXTRACTO_BANCARIO` | PDF |
| `CAMARA_COMERCIO` | PDF |

---

## 4. Cambios en Archivos Existentes

### `components/DashboardSidebar.js`
Se agregaron dos ítems de navegación:
```
Inicio       → /dashboard/inicio
Mis Créditos → /dashboard/creditos     ← NUEVO
Documentos   → /dashboard/documentos  ← NUEVO
Mi Perfil    → /dashboard/perfil
```

### `app/dashboard/inicio/page.js`
El botón "Solicitar Crédito" que apuntaba a `#` ahora enlaza a `/dashboard/creditos/solicitar`.

---

## 5. Supabase Storage — Bucket Requerido

Para que la subida de documentos funcione, se debe crear el bucket en Supabase:

1. Ve a **Supabase Dashboard → Storage → New Bucket**.
2. Nombre: `documentos-kyc`.
3. **Marcar como privado** (desactiva "Public bucket").
4. Aplicar esta política RLS en el SQL Editor:

```sql
-- Política: el cliente solo puede leer/subir sus propios documentos
CREATE POLICY "Clientes gestionan sus docs"
ON storage.objects FOR ALL
USING (
  bucket_id = 'documentos-kyc'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'documentos-kyc'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
```

---

## 6. Tablas de Base de Datos Usadas en Sprint 3

| Tabla | Operación | Propósito |
|-------|-----------|-----------|
| `cliente` | SELECT | Obtener `id_cliente` del usuario |
| `estado_solicitud` | SELECT | Obtener UUID del estado `PENDIENTE` |
| `solicitud_credito` | INSERT | Guardar la solicitud enviada |
| `documento_cliente` | SELECT / UPSERT | Leer y guardar documentos KYC |
| `storage.objects` | INSERT | Archivo físico en Supabase Storage |

---

## 7. Reglas de Negocio Cubiertas en Sprint 3

| Código | Regla | Estado |
|--------|-------|--------|
| RN-03 | Cuota calculada con amortización francesa | ✅ `lib/calculadora.js` |
| RN-04 | Monto entre $500K y $10M | ✅ Validado en slider |
| RN-10 | Documentos conservados (Storage privado) | ✅ Bucket privado + URL firmada |
| RNM-01 | Aviso Habeas Data en upload | ✅ Nota legal visible |

---

## 8. Pendientes para Sprint 4

- [ ] Configurar bucket `documentos-kyc` con RLS en Supabase
- [ ] Página de detalle de solicitud: `/dashboard/creditos/[id]`
- [ ] Vista de cuotas del crédito desembolsado
- [ ] Integrar pasarela Wompi para pago de cuotas
- [ ] Email de confirmación de solicitud con Resend
- [ ] Implementar RN-02: bloqueo tras 3 intentos fallidos de login
