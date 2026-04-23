# Documentación de Triggers y Funciones - PLURALL

Este documento contiene todos los scripts SQL automatizados (Triggers y Funciones) que se crearon en Supabase para manejar el registro de usuarios de forma transparente, evadiendo las confirmaciones de correo obligatorias y sincronizando la autenticación con la lógica de negocio.

## 1. Auto-Confirmación de Correo (Bypass)
Supabase (desde 2024) obliga a confirmar los correos si se usa su servidor SMTP gratuito. Al estar usando el login por número de celular convertido internamente a correo (`[celular]@plurall.app`), los clientes nunca recibirán ese correo. 
Este gatillo marca el correo como confirmado en el milisegundo en que se crea la cuenta.

```sql
CREATE OR REPLACE FUNCTION public.auto_confirm_user()
RETURNS trigger AS $$
BEGIN
  -- Engañamos a Supabase marcando el correo como confirmado inmediatamente
  UPDATE auth.users
  SET email_confirmed_at = NOW()
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_auto_confirm_user ON auth.users;
CREATE TRIGGER trg_auto_confirm_user
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_confirm_user();
```

---

## 2. Inserción Automática en Tablas de Negocio
Cuando un usuario le da a "Crear Cuenta", sus datos (Nombre, Documento, Celular y Correo Secundario de Google) se guardan temporalmente en los metadatos (`raw_user_meta_data`) dentro de `auth.users`.
Este gatillo se encarga de extraerlos y crear un espejo en las tablas `perfil_usuario` y `cliente` sin bloquear el registro principal si es que ocurre un error o un conflicto (gracias al `ON CONFLICT DO NOTHING`).

```sql
-- Función reforzada para extraer metadatos y llenar el negocio
CREATE OR REPLACE FUNCTION public.handle_new_user_registration()
RETURNS trigger AS $$
DECLARE
  v_rol_id UUID;
  v_estado_id UUID;
BEGIN
  -- Buscamos los IDs correspondientes en los catálogos base
  SELECT id_rol INTO v_rol_id FROM public.rol WHERE nombre_rol ILIKE 'CLIENTE' LIMIT 1;
  SELECT id_estado_cliente INTO v_estado_id FROM public.estado_cliente WHERE nombre ILIKE 'ACTIVO' LIMIT 1;

  -- Intentamos insertar silenciosamente en el perfil para asociarlo a Supabase Auth
  BEGIN
    INSERT INTO public.perfil_usuario (id, id_rol, nombre_completo)
    VALUES (NEW.id, v_rol_id, NEW.raw_user_meta_data->>'nombre_completo')
    ON CONFLICT (id) DO NOTHING;

    -- Luego insertamos el perfil financiero / de datos personales del Cliente
    INSERT INTO public.cliente (
      id_usuario_cuenta, 
      id_estado_cliente, 
      nombre_completo, 
      dni, 
      email, 
      telefono
    )
    VALUES (
      NEW.id,
      v_estado_id,
      NEW.raw_user_meta_data->>'nombre_completo',
      COALESCE(NEW.raw_user_meta_data->>'dni', 'SN-' || NEW.id), 
      COALESCE(NEW.raw_user_meta_data->>'email_real', NEW.email),
      COALESCE(NEW.raw_user_meta_data->>'telefono', '0000000000')
    )
    ON CONFLICT DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    -- Resiliencia total: Si hay un choque, el usuario se crea de todas formas en 'auth.users'
    RETURN NEW;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_handle_new_user_registration ON auth.users;
CREATE TRIGGER trg_handle_new_user_registration
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_registration();
```

---

## 3. Comandos Útiles de Mantenimiento / Depuración

**Insertar variables Base para Testing Seguro:**
```sql
INSERT INTO public.rol (nombre_rol, descripcion) 
VALUES ('CLIENTE', 'Usuario final') ON CONFLICT DO NOTHING;

INSERT INTO public.estado_cliente (nombre, descripcion) 
VALUES ('ACTIVO', 'Cuenta activa') ON CONFLICT DO NOTHING;
```

**Limpieza total y reseteo de pruebas (SÓLO USO EN DESARROLLO):**
```sql
DELETE FROM public.cliente;
DELETE FROM public.perfil_usuario;
-- NOTA: auth.users debe limpiarse desde el panel Authentication >> Users directamente.
```
