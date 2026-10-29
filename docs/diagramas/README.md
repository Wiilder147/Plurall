# PLURALL — Diagramas de Arquitectura y Diseño

Diagramas en **Mermaid** (`.mmd`). Organización:

- **Por requerimiento (RF-01…RF-14):** cada carpeta tiene los 4 diagramas a nivel de módulo/requerimiento
  1. `1-casos-de-uso.mmd` — Casos de uso + extensibilidad (`«include»` / `«extend»`)
  2. `2-actividad.mmd` — Diagrama de actividades
  3. `3-secuencia.mmd` — Diagrama de secuencia
  4. `4-clases.mmd` — Diagrama de clases
- **A nivel de proyecto** (carpeta `proyecto/`):
  5. `5-componentes.mmd` — Componentes
  6. `6-despliegue.mmd` — Despliegue
  7. `7-mer.mmd` — MER (Modelo Entidad-Relación, 3FN)

## Requerimientos (diagramas 1–4 por cada uno)

| Carpeta | Requerimiento (RF) |
|---------|--------------------|
| [`RF-01-autenticacion/`](RF-01-autenticacion) | Autenticación segura (login, registro, recuperación OTP) |
| [`RF-02-perfil-cliente/`](RF-02-perfil-cliente) | Gestión de perfil del cliente |
| [`RF-03-solicitud-kyc/`](RF-03-solicitud-kyc) | Solicitud de crédito, cuestionario y KYC |
| [`RF-04-creditos-documentos/`](RF-04-creditos-documentos) | Gestión de créditos y documentos legales |
| [`RF-05-scoring/`](RF-05-scoring) | Motor de scoring crediticio automático |
| [`RF-06-decision-analista/`](RF-06-decision-analista) | Decisión de analista (aprobar / rechazar) |
| [`RF-07-pagos-wompi/`](RF-07-pagos-wompi) | Pagos, plan de cuotas e integración Wompi |
| [`RF-08-notificaciones/`](RF-08-notificaciones) | Notificaciones transaccionales por email |
| [`RF-09-cobranza/`](RF-09-cobranza) | Módulo de cobranza para asesores |
| [`RF-10-mora-cron/`](RF-10-mora-cron) | Detección automática de mora (Cron) |
| [`RF-11-analitica-kpis/`](RF-11-analitica-kpis) | Analítica y KPIs de cartera |
| [`RF-12-roles-rls/`](RF-12-roles-rls) | Panel administrativo y control de acceso por roles |
| [`RF-13-auditoria/`](RF-13-auditoria) | Auditoría y trazabilidad del sistema |
| [`RF-14-pqr/`](RF-14-pqr) | PQR y asistencia al usuario |

## Diagramas de proyecto

| Archivo | Diagrama |
|---------|----------|
| [`proyecto/5-componentes.mmd`](proyecto/5-componentes.mmd) | Componentes (Next.js/Vercel + Supabase + externos) |
| [`proyecto/6-despliegue.mmd`](proyecto/6-despliegue.mmd) | Despliegue (serverless, nodos físicos) |
| [`proyecto/7-mer.mmd`](proyecto/7-mer.mmd) | MER — Modelo Entidad-Relación (3FN) |

> El MER refleja el modelo normalizado (rama `feat/normalizacion-bd`): `cliente` adelgazada + `direccion`/`negocio_cliente`/`perfil_financiero`/`cuenta_bancaria`. El score vigente vive en la vista `vw_cliente_score` (no es tabla).

## Cómo renderizar / exportar

- **VS Code**: extensión *Markdown Preview Mermaid Support* o *Mermaid Editor* (abre `.mmd` directo).
- **Online**: pegar el contenido en <https://mermaid.live>.
- **Exportar uno a SVG/PNG**:
  ```bash
  npx -y @mermaid-js/mermaid-cli -i RF-01-autenticacion/1-casos-de-uso.mmd -o RF-01-autenticacion/1-casos-de-uso.svg
  ```
- **Exportar todos** (Bash desde `docs/diagramas`):
  ```bash
  find . -name '*.mmd' -exec sh -c 'npx -y @mermaid-js/mermaid-cli -i "$1" -o "${1%.mmd}.svg"' _ {} \;
  ```
