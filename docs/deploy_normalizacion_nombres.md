# Deploy — Normalización de nombres (migración 23)

## Qué cambió

- Se eliminó la columna `nombre_completo` de `cliente` y `perfil_usuario`.
- Fuente canónica del cliente: `primer_nombre`, `segundo_nombre`, `primer_apellido`, `segundo_apellido` en **`cliente`**.
- En `perfil_usuario` el nombre atómico queda solo para roles internos (asesor / supervisor / admin).
- La app concatena con `formatNombre()` (`apps/web/lib/nombre.js`).

## Orden obligatorio (evitar downtime)

1. **Código listo** en la rama a desplegar (registro con 4 campos + selects sin `nombre_completo`).
2. **Ejecutar en Supabase → SQL Editor** el archivo:
   - [`db/23_eliminar_nombre_completo.sql`](../db/23_eliminar_nombre_completo.sql)
3. **Deploy inmediato a Vercel** de la misma versión de la app.
4. **No** dejar código viejo contra BD nueva (romperá selects de `nombre_completo`).

## Checklist de prueba

- [ ] Registro manual con primer nombre + primer apellido (segundos opcionales)
- [ ] Autocompletar con Google → partes del nombre precargadas
- [ ] Login → dashboard muestra saludo con `primer_nombre` del cliente
- [ ] Admin / Supervisor → listado y búsqueda de clientes por nombre o apellido
- [ ] Asesor → ve nombre del cliente formateado
- [ ] Iniciar pago Wompi → nombre del pagador correcto
- [ ] En Supabase Table Editor: `cliente` tiene las 4 columnas y **no** tiene `nombre_completo`

## Verificación SQL rápida

```sql
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('cliente', 'perfil_usuario')
  AND column_name IN (
    'nombre_completo',
    'primer_nombre', 'segundo_nombre', 'primer_apellido', 'segundo_apellido'
  )
ORDER BY table_name, column_name;
```

No debe aparecer `nombre_completo`.
