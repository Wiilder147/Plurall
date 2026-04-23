# PLURALL

Plataforma de Gestión de Créditos para Comerciantes Colombianos.

**Proyecto Formativo SENA** | Tecnólogo ADSO | Instructor: Jefry González

## Estado del proyecto

| Sprint | Estado | Descripción |
|--------|--------|-------------|
| Sprint 1 | ✅ Completado | Landing, Auth (login/registro/recuperar), BD completa |
| Sprint 2 | ✅ Completado | Dashboard, Sidebar, Perfil de usuario |
| Sprint 3 | ✅ Completado | Simulador crédito, Solicitud, Documentos KYC |
| Sprint 4 | ✅ Completado | Wompi, cuotas, RN-02 lockout, emails Resend |
| Sprint 5 | ✅ Completado | Panel Admin, aprobar/rechazar, desembolso, reportes |

## Inicio rápido

```bash
cd apps/web
npm install
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000)

## Rutas disponibles

| Ruta | Acceso | Sprint |
|------|--------|--------|
| `/` | Público | 1 |
| `/login` `/registro` `/recuperar` | Público | 1 |
| `/dashboard/inicio` | Privado | 2 |
| `/dashboard/perfil` | Privado | 2 |
| `/dashboard/creditos` | Privado | 3 |
| `/dashboard/creditos/solicitar` | Privado | 3 |
| `/dashboard/documentos` | Privado | 3 |
| `/dashboard/creditos/[id]` | Privado | 4 |
| `/dashboard/cuotas` | Privado | 4 |
| `/dashboard/cuotas/[id]/pagar` | Privado | 4 |
| `/admin` `/admin/solicitudes` | Admin | 5 |
| `/admin/clientes` `/admin/reportes` | Admin | 5 |

## Documentación

- [Sprint 1 — README técnico](docs/sprint1_readme.md)
- [Sprint 2 — Dashboard y perfil](docs/sprint2_readme.md)
- [Sprint 3 — Créditos y documentos KYC](docs/sprint3_readme.md)
- [Sprint 4 — Pagos Wompi, cuotas, RN-02](docs/sprint4_readme.md)
- [Sprint 5 — Panel Admin, desembolso, reportes](docs/sprint5_readme.md)
- [Guía de integraciones](docs/setup_services.md)
- [Diagrama de arquitectura](docs/arquitectura_plurall.mmd)
- [Triggers y funciones SQL](docs/triggers_y_funciones.md)
- [Base de datos completa](plurall_database_completa.sql)