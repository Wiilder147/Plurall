# PLURALL — Documento de Requerimientos del Sistema

> **Proyecto Formativo SENA** | Tecnólogo en Análisis y Desarrollo de Software (ADSO)
> Instructor: Jefry González
> Equipo: Wilder Feo · Camila Avila · Juan Cetina · Juan Maurello · Jeferson Lugo
> Tablero de referencia: Jira — Proyecto **SCRUM** (`plucardsito.atlassian.net`)

Este documento consolida los **requerimientos funcionales (RF)** y **no funcionales (RNF)**
de la plataforma fintech PLURALL, elaborado a partir de las historias, épicas y tareas
del tablero de Jira. Cada requerimiento funcional se documenta bajo la ficha de
**Análisis de Requerimiento** con los aspectos: objetivo, tipo, componentes involucrados,
viabilidad técnica, riesgos potenciales, impacto en el sistema, dependencias y priorización.

---

## Índice

**Requerimientos Funcionales**

| Código | Nombre | Épica / Tareas Jira |
|--------|--------|---------------------|
| RF-01 | Autenticación segura (login, registro, recuperación) | SCRUM-6, SCRUM-33 |
| RF-02 | Gestión de perfil del cliente | SCRUM-11 |
| RF-03 | Solicitud de crédito, cuestionario y KYC | SCRUM-16, SCRUM-34, SCRUM-35 |
| RF-04 | Gestión de créditos y documentos legales | SCRUM-20, SCRUM-24 |
| RF-05 | Motor de scoring crediticio automático | SCRUM-18 |
| RF-06 | Decisión de analista (aprobar / rechazar) | SCRUM-19, SCRUM-23 |
| RF-07 | Pagos, plan de cuotas e integración Wompi | SCRUM-22, SCRUM-25 |
| RF-08 | Notificaciones transaccionales por email | SCRUM-17 |
| RF-09 | Módulo de cobranza para asesores | SCRUM-29 |
| RF-10 | Detección automática de mora (Cron) | SCRUM-27 |
| RF-11 | Analítica y KPIs de cartera | SCRUM-28, SCRUM-30 |
| RF-12 | Panel administrativo y control de acceso por roles | SCRUM-13, SCRUM-21 |
| RF-13 | Auditoría y trazabilidad del sistema | SCRUM-12 |
| RF-14 | PQR y asistencia al usuario (chatbot / ayuda) | SCRUM-31 |

**Requerimientos No Funcionales**

| Código | Categoría |
|--------|-----------|
| RNF-01 | Seguridad |
| RNF-02 | Rendimiento |
| RNF-03 | Disponibilidad y despliegue |
| RNF-04 | Usabilidad y diseño responsivo |
| RNF-05 | Escalabilidad |
| RNF-06 | Mantenibilidad |
| RNF-07 | Monitoreo y observabilidad |
| RNF-08 | Cumplimiento legal (Habeas Data) |
| RNF-09 | Compatibilidad |
| RNF-10 | Integridad y consistencia de datos |

---

# Requerimientos Funcionales

## Análisis Requerimiento Funcional – RF-01 · Autenticación Segura

| Aspecto | Descripción |
|---------|-------------|
| **Objetivo del requisito** | Permitir que un usuario se registre, inicie sesión y recupere su contraseña de forma segura, usando el celular colombiano de 10 dígitos como identificador único de acceso. |
| **Tipo de requisito** | Funcional – Autenticación y gestión de acceso. |
| **Componentes involucrados** | Frontend (pantallas login / registro / recuperar), Backend (Supabase Auth, API de OTP y bloqueo), Base de datos (`perfil_usuario`, `otp_recuperacion`). |
| **Viabilidad técnica** | Alta. Supabase Auth provee el manejo de sesiones y credenciales; el OTP y el bloqueo se implementan con tablas y API Routes propias. |
| **Riesgos potenciales** | 1. Ataques de fuerza bruta sobre cuentas.  2. Correos electrónicos inválidos o duplicados en el registro.  3. Fuga de sesión si el middleware no valida correctamente. |
| **Impacto en el sistema** | Alto. Es la puerta de entrada a los cuatro portales; una falla compromete toda la plataforma. |
| **Dependencias** | Supabase Auth, servicio de email (Resend) para OTP, middleware de sesión, catálogo de roles. |
| **Priorización** | Alta. Sin autenticación no es posible acceder a ninguna funcionalidad del sistema. |

**Reglas de negocio asociadas:** RN-01 (celular único), RN-02 (bloqueo tras 3 intentos fallidos por 30 min), validación de correo con dominio `.com` (SCRUM-33).

---

## Análisis Requerimiento Funcional – RF-02 · Gestión de Perfil del Cliente

| Aspecto | Descripción |
|---------|-------------|
| **Objetivo del requisito** | Permitir al cliente visualizar y editar sus datos de contacto y cambiar su contraseña, mostrando información real proveniente de la base de datos. |
| **Tipo de requisito** | Funcional – Gestión de datos personales. |
| **Componentes involucrados** | Frontend (pantalla de perfil), Backend (consulta/actualización), Base de datos (`cliente`, `detalle_cliente`, `perfil_usuario`). |
| **Viabilidad técnica** | Alta. Operaciones CRUD estándar sobre tablas ya modeladas con RLS. |
| **Riesgos potenciales** | 1. Edición no autorizada de datos de otro usuario si RLS falla.  2. Inconsistencia entre datos de contacto y datos de contrato. |
| **Impacto en el sistema** | Medio. Afecta la experiencia del cliente y la exactitud de los datos de contacto para cobranza y notificaciones. |
| **Dependencias** | Módulo de autenticación (RF-01), políticas RLS, base de datos de clientes. |
| **Priorización** | Media. Necesario para la operación pero no bloquea el flujo crediticio principal. |

---

## Análisis Requerimiento Funcional – RF-03 · Solicitud de Crédito, Cuestionario y KYC

| Aspecto | Descripción |
|---------|-------------|
| **Objetivo del requisito** | Guiar al cliente a través de un flujo multi-paso (cotizador → cuestionario de perfil → carga de documentos KYC → resumen) para radicar una solicitud de crédito. |
| **Tipo de requisito** | Funcional – Originación de crédito. |
| **Componentes involucrados** | Frontend (stepper de 4 pasos, formularios validados), Backend (`POST /api/creditos/solicitar`), Storage (bucket `documentos_kyc`), Base de datos (`solicitud_credito`, `respuesta_cliente`, `documento_cliente`). |
| **Viabilidad técnica** | Alta. El flujo se apoya en componentes de formulario, validación de campos numéricos y carga de archivos a Supabase Storage. |
| **Riesgos potenciales** | 1. Envío de solicitudes incompletas si la validación por paso falla.  2. Documentos KYC de baja calidad o no legibles.  3. Solicitudes duplicadas si no se respeta el cooldown. |
| **Impacto en el sistema** | Alto. Es el punto de partida de todo el ciclo de vida del crédito. |
| **Dependencias** | Motor de scoring (RF-05), Storage, módulo de perfil (RF-02), calculadora de amortización. |
| **Priorización** | Alta. Núcleo funcional del negocio. |

**Reglas de negocio asociadas:** RN-03 (cooldown de 90 días entre solicitudes), RN-04 (KYC obligatorio: cédula frontal + trasera), campos numéricos validados (SCRUM-34), carga de documentos (SCRUM-35).

---

## Análisis Requerimiento Funcional – RF-04 · Gestión de Créditos y Documentos Legales

| Aspecto | Descripción |
|---------|-------------|
| **Objetivo del requisito** | Mostrar el historial de créditos del usuario, con detalles como saldo, cuotas, estado de pago y documentos como contrato y paz y salvo. |
| **Tipo de requisito** | Funcional – Gestión de créditos y documentos. |
| **Componentes involucrados** | Frontend (visualización de historial de créditos), Backend (consulta de créditos y pagos, generación de PDF con Puppeteer), Base de datos (información financiera). |
| **Viabilidad técnica** | Alta. La información de los créditos está organizada en la base de datos y es accesible para su consulta. |
| **Riesgos potenciales** | 1. Inexactitudes en la visualización del saldo o pagos realizados.  2. Problemas con la descarga de documentos si no se implementa un sistema de almacenamiento adecuado. |
| **Impacto en el sistema** | Alto. La correcta visualización y acceso a documentos legales es esencial para la transparencia. |
| **Dependencias** | Módulo de créditos, servicio de documentos (paz y salvo, contratos, extracto de cuenta), base de datos financiera. |
| **Priorización** | Alta. Es fundamental que el usuario pueda acceder a su historial de créditos y descargar los documentos relacionados. |

**Documentos generados:** contrato de crédito, plan de pagos, extracto/estado de cuenta y certificado de paz y salvo (PDF vía Puppeteer).

---

## Análisis Requerimiento Funcional – RF-05 · Motor de Scoring Crediticio Automático

| Aspecto | Descripción |
|---------|-------------|
| **Objetivo del requisito** | Calcular automáticamente un puntaje crediticio a partir de las respuestas del cuestionario y factores ponderados, definiendo si la solicitud se aprueba, se rechaza o pasa a revisión manual. |
| **Tipo de requisito** | Funcional – Evaluación de riesgo. |
| **Componentes involucrados** | Backend (cálculo de score dentro de `POST /api/creditos/solicitar`), Base de datos (`score`, `score_factor`, cuestionario de preguntas). |
| **Viabilidad técnica** | Alta. El modelo es determinista (respuestas × factores) y se ejecuta en el mismo endpoint de la solicitud. |
| **Riesgos potenciales** | 1. Umbrales mal calibrados que aprueben clientes de alto riesgo.  2. Falta de trazabilidad del puntaje si no se persiste el detalle. |
| **Impacto en el sistema** | Alto. Determina la decisión automática y la carga de trabajo de los analistas. |
| **Dependencias** | Solicitud de crédito (RF-03), catálogo de preguntas y factores. |
| **Priorización** | Alta. Es el mecanismo que automatiza la mayor parte de las decisiones. |

**Reglas de negocio asociadas:** RN-09 (scoring visible para analista/supervisor en el panel de decisión).

---

## Análisis Requerimiento Funcional – RF-06 · Decisión de Analista (Aprobar / Rechazar)

| Aspecto | Descripción |
|---------|-------------|
| **Objetivo del requisito** | Permitir que un analista/supervisor revise las solicitudes en estudio y las apruebe o rechace, seleccionando un motivo del catálogo, con registro trazable de la decisión. |
| **Tipo de requisito** | Funcional – Gestión de decisiones. |
| **Componentes involucrados** | Frontend (panel de decisión con detalle de solicitud), Backend (`PATCH /api/admin/solicitud/[id]`), Base de datos (`decision_solicitud`, `motivo_rechazo`). |
| **Viabilidad técnica** | Alta. Cambios de estado controlados sobre la solicitud con catálogo de motivos configurable. |
| **Riesgos potenciales** | 1. Cambio de una decisión ya tomada (inmutabilidad).  2. Rechazos sin motivo registrado que afecten la auditoría. |
| **Impacto en el sistema** | Alto. Habilita el paso de solicitud a desembolso. |
| **Dependencias** | Scoring (RF-05), catálogo de motivos de rechazo, auditoría (RF-13). |
| **Priorización** | Alta. Cierra el flujo de originación previo al desembolso. |

**Reglas de negocio asociadas:** RN-05 (analista asignado), RN-06 (decisión inmutable).

---

## Análisis Requerimiento Funcional – RF-07 · Pagos, Plan de Cuotas e Integración Wompi

| Aspecto | Descripción |
|---------|-------------|
| **Objetivo del requisito** | Permitir al cliente consultar su plan de pagos y pagar cuotas a través del widget de Wompi, confirmando el pago mediante un webhook seguro e idempotente. |
| **Tipo de requisito** | Funcional – Procesamiento de pagos. |
| **Componentes involucrados** | Frontend (plan de pagos, widget Wompi), Backend (`POST /api/pagos/iniciar`, `POST /api/webhooks/wompi`), Rate limiting (Upstash Redis), Base de datos (`plan_pago`, `cuota`, `pago`). |
| **Viabilidad técnica** | Media-Alta. Requiere firma HMAC SHA-256, validación de webhook e idempotencia para evitar dobles registros. |
| **Riesgos potenciales** | 1. Pagos duplicados si el webhook no es idempotente.  2. Manipulación de montos si falla la validación de firma.  3. Abuso del endpoint sin rate limiting. |
| **Impacto en el sistema** | Alto. Afecta directamente el saldo del crédito y la salud de la cartera. |
| **Dependencias** | Créditos y cuotas (RF-04), Wompi, Upstash Redis, notificaciones (RF-08). |
| **Priorización** | Alta. Es el mecanismo de recaudo de la plataforma. |

**Reglas de negocio asociadas:** RN-12 (cada pago genera registro con referencia Wompi), BD-03 (tasa congelada al desembolso).

---

## Análisis Requerimiento Funcional – RF-08 · Notificaciones Transaccionales por Email

| Aspecto | Descripción |
|---------|-------------|
| **Objetivo del requisito** | Enviar correos transaccionales al cliente ante eventos clave: aprobación, rechazo, confirmación de pago y recordatorio de vencimiento. |
| **Tipo de requisito** | Funcional – Comunicación con el usuario. |
| **Componentes involucrados** | Backend (`/api/notificaciones/*`, templates HTML), Servicio Resend, Base de datos (`notificacion`). |
| **Viabilidad técnica** | Alta. Resend ofrece envío transaccional simple mediante API y plantillas HTML. |
| **Riesgos potenciales** | 1. Correos marcados como spam.  2. Fallos silenciosos de envío sin reintento.  3. Datos de contacto desactualizados. |
| **Impacto en el sistema** | Medio. Mejora la experiencia y el recaudo, pero no bloquea las operaciones críticas. |
| **Dependencias** | Resend, decisión de analista (RF-06), pagos (RF-07), perfil (RF-02). |
| **Priorización** | Media. Complementa los flujos principales. |

---

## Análisis Requerimiento Funcional – RF-09 · Módulo de Cobranza para Asesores

| Aspecto | Descripción |
|---------|-------------|
| **Objetivo del requisito** | Proveer al asesor herramientas para gestionar la cartera asignada: cola de cobranza, ficha de cliente en mora y registro de gestiones (llamadas, visitas, promesas de pago). |
| **Tipo de requisito** | Funcional – Gestión de cobranza. |
| **Componentes involucrados** | Frontend (portal `/asesor`), Backend (APIs de gestiones y asignación), Base de datos (`gestion_cobranza`, `asignacion_asesor`). |
| **Viabilidad técnica** | Alta. Se apoya en las tablas de cartera y mora ya existentes. |
| **Riesgos potenciales** | 1. Asignaciones inconsistentes de clientes a asesores.  2. Falta de trazabilidad de las gestiones registradas. |
| **Impacto en el sistema** | Medio-Alto. Impacta la recuperación de cartera en mora. |
| **Dependencias** | Detección de mora (RF-10), créditos y cuotas (RF-04), control de roles (RF-12). |
| **Priorización** | Media-Alta. Clave para la salud financiera del portafolio. |

---

## Análisis Requerimiento Funcional – RF-10 · Detección Automática de Mora (Cron)

| Aspecto | Descripción |
|---------|-------------|
| **Objetivo del requisito** | Ejecutar diariamente un proceso automático que marque cuotas vencidas, ponga créditos en mora y recupere créditos cuando ya no tengan cuotas vencidas. |
| **Tipo de requisito** | Funcional – Proceso automático (batch). |
| **Componentes involucrados** | Vercel Cron / pg_cron, Backend (`GET /api/cron/mora` autenticado con `CRON_SECRET`), Base de datos (`cuota`, `credito`). |
| **Viabilidad técnica** | Alta. Vercel Cron dispara el endpoint a las 6 AM Colombia; alternativa con pg_cron disponible. |
| **Riesgos potenciales** | 1. Ejecución no autenticada del endpoint.  2. Zona horaria mal configurada.  3. Estados inconsistentes si el proceso se interrumpe. |
| **Impacto en el sistema** | Alto. Mantiene actualizado el estado de mora que alimenta cobranza y analítica. |
| **Dependencias** | Créditos y cuotas (RF-04), Vercel Cron, secreto de cron. |
| **Priorización** | Alta. Sostiene la exactitud del estado de la cartera. |

**Reglas de negocio asociadas:** RN-08 (cuota vencida automáticamente cuando `fecha_vencimiento < hoy` y estado PENDIENTE).

---

## Análisis Requerimiento Funcional – RF-11 · Analítica y KPIs de Cartera

| Aspecto | Descripción |
|---------|-------------|
| **Objetivo del requisito** | Presentar a supervisores y administradores indicadores de negocio (cartera, mora, funnel de originación, desembolsos) mediante dashboards con gráficas y drill-down. |
| **Tipo de requisito** | Funcional – Reportería y analítica. |
| **Componentes involucrados** | Frontend (dashboards con Recharts), Backend (`/api/analitica`, `/api/reportes/export`), Base de datos (vistas `vw_kpi_cartera`, `vw_cohortes_desembolso`, `evento_funnel`). |
| **Viabilidad técnica** | Alta. Se apoya en vistas materializadas y componentes de gráficas. |
| **Riesgos potenciales** | 1. Métricas incorrectas por vistas desactualizadas.  2. Consultas pesadas que degraden el rendimiento. |
| **Impacto en el sistema** | Medio-Alto. Soporta la toma de decisiones gerenciales. |
| **Dependencias** | Datos de créditos, pagos y funnel; vistas de reportería; control de roles (RF-12). |
| **Priorización** | Media-Alta. Aporta valor de gestión sin bloquear la operación transaccional. |

---

## Análisis Requerimiento Funcional – RF-12 · Panel Administrativo y Control de Acceso por Roles

| Aspecto | Descripción |
|---------|-------------|
| **Objetivo del requisito** | Ofrecer portales diferenciados (cliente, asesor, supervisor, admin) con acceso restringido según el rol del usuario, tanto en la interfaz como en los datos. |
| **Tipo de requisito** | Funcional – Autorización y administración. |
| **Componentes involucrados** | Frontend (layouts por rol, directorio de clientes), Middleware de sesión, Base de datos (`rol`, `perfil_usuario`, políticas RLS en todas las tablas). |
| **Viabilidad técnica** | Alta. RLS de Supabase + verificación en layout garantizan el aislamiento por rol. |
| **Riesgos potenciales** | 1. Escalamiento de privilegios si una política RLS es incompleta.  2. Exposición de datos entre clientes. |
| **Impacto en el sistema** | Alto. Es la base de la seguridad de acceso a la información. |
| **Dependencias** | Autenticación (RF-01), modelo de datos con RLS, middleware. |
| **Priorización** | Alta. Transversal a todos los módulos. |

---

## Análisis Requerimiento Funcional – RF-13 · Auditoría y Trazabilidad del Sistema

| Aspecto | Descripción |
|---------|-------------|
| **Objetivo del requisito** | Registrar quién realizó cada acción sensible, cuándo y desde qué IP, así como el historial de cambios de estado, para garantizar la trazabilidad. |
| **Tipo de requisito** | Funcional – Auditoría y control. |
| **Componentes involucrados** | Backend (registro de eventos), Base de datos (`auditoria`, `historial_estado`, `config_sistema`). |
| **Viabilidad técnica** | Alta. Registro de eventos mediante inserciones controladas y/o triggers. |
| **Riesgos potenciales** | 1. Registros incompletos que impidan reconstruir un incidente.  2. Crecimiento no controlado de la tabla de auditoría. |
| **Impacto en el sistema** | Medio-Alto. Esencial para control interno y cumplimiento. |
| **Dependencias** | Decisiones (RF-06), pagos (RF-07), autenticación (RF-01). |
| **Priorización** | Media-Alta. Requerido para operación confiable y auditable. |

---

## Análisis Requerimiento Funcional – RF-14 · PQR y Asistencia al Usuario

| Aspecto | Descripción |
|---------|-------------|
| **Objetivo del requisito** | Permitir al cliente radicar Peticiones, Quejas o Reclamos (PQR) y ofrecer una sesión de ayuda o chatbot de soporte dentro de la plataforma. |
| **Tipo de requisito** | Funcional – Atención al usuario. |
| **Componentes involucrados** | Frontend (formulario PQR, componente de ayuda/chat), Backend (`/api/pqr`), Base de datos (`pqr`). |
| **Viabilidad técnica** | Alta para PQR (CRUD estándar); media para el chatbot según el alcance de la asistencia. |
| **Riesgos potenciales** | 1. PQR sin seguimiento ni SLA.  2. Expectativas del chatbot superiores a su alcance real. |
| **Impacto en el sistema** | Medio. Mejora la experiencia y el cumplimiento de atención al cliente. |
| **Dependencias** | Autenticación (RF-01), notificaciones (RF-08). |
| **Priorización** | Media. Complementa la experiencia del cliente. |

---

# Requerimientos No Funcionales

## RNF-01 · Seguridad

| Aspecto | Descripción |
|---------|-------------|
| **Objetivo del requisito** | Garantizar la confidencialidad, integridad y disponibilidad de los datos mediante autenticación robusta, autorización por RLS y validación de integridad en pagos. |
| **Tipo de requisito** | No funcional – Seguridad. |
| **Componentes involucrados** | Supabase Auth y RLS, middleware, HMAC SHA-256 (Wompi), headers HTTP (HSTS, X-Frame-Options, X-Content-Type-Options), rate limiting. |
| **Criterios de aceptación** | 100% de tablas con políticas RLS; webhooks validados por firma; bloqueo tras 3 intentos fallidos; headers de seguridad presentes en todas las respuestas. |
| **Riesgos potenciales** | Fuerza bruta, escalamiento de privilegios, manipulación de webhooks, secuestro de sesión. |
| **Impacto en el sistema** | Crítico. Afecta a toda la plataforma y a la confianza del usuario. |
| **Dependencias** | RF-01, RF-07, RF-12. |
| **Priorización** | Alta. |

---

## RNF-02 · Rendimiento

| Aspecto | Descripción |
|---------|-------------|
| **Objetivo del requisito** | Mantener tiempos de respuesta aceptables en la navegación y las consultas, incluso en dashboards con agregaciones. |
| **Tipo de requisito** | No funcional – Rendimiento. |
| **Componentes involucrados** | Server Components (SSR) de Next.js, vistas materializadas, índices en base de datos, Edge/CDN de Vercel. |
| **Criterios de aceptación** | Páginas principales cargan en menos de ~3 s en condiciones normales; los KPIs se sirven desde vistas para evitar consultas costosas en tiempo real. |
| **Riesgos potenciales** | Consultas no indexadas, vistas desactualizadas, sobrecarga en horas pico. |
| **Impacto en el sistema** | Medio-Alto. Afecta la experiencia de todos los roles. |
| **Dependencias** | RF-11, modelo de datos. |
| **Priorización** | Media-Alta. |

---

## RNF-03 · Disponibilidad y Despliegue

| Aspecto | Descripción |
|---------|-------------|
| **Objetivo del requisito** | Asegurar que la plataforma esté disponible de forma continua mediante hosting serverless y despliegue automatizado. |
| **Tipo de requisito** | No funcional – Disponibilidad. |
| **Componentes involucrados** | Vercel (Serverless + Edge + Cron), Supabase gestionado, integración continua desde el repositorio. |
| **Criterios de aceptación** | Despliegues reproducibles desde Git; cron de mora ejecutándose diariamente; variables de entorno gestionadas por entorno. |
| **Riesgos potenciales** | Caídas de servicios externos (Wompi, Resend), errores de configuración de entorno. |
| **Impacto en el sistema** | Alto. La indisponibilidad detiene la operación. |
| **Dependencias** | RF-10, infraestructura Vercel/Supabase. |
| **Priorización** | Alta. |

---

## RNF-04 · Usabilidad y Diseño Responsivo

| Aspecto | Descripción |
|---------|-------------|
| **Objetivo del requisito** | Ofrecer una interfaz clara, consistente y utilizable desde dispositivos móviles y de escritorio, con un sistema de diseño unificado. |
| **Tipo de requisito** | No funcional – Usabilidad. |
| **Componentes involucrados** | Tailwind CSS, componentes reutilizables, sidebar responsivo, sistema de diseño global. |
| **Criterios de aceptación** | Navegación funcional en móvil y escritorio; componentes visibles y consistentes; mejoras de visibilidad aplicadas (SCRUM-32). |
| **Riesgos potenciales** | Inconsistencias visuales entre portales, componentes poco visibles en algunas resoluciones. |
| **Impacto en el sistema** | Medio. Afecta adopción y satisfacción del usuario. |
| **Dependencias** | Todos los módulos con interfaz. |
| **Priorización** | Media. |

---

## RNF-05 · Escalabilidad

| Aspecto | Descripción |
|---------|-------------|
| **Objetivo del requisito** | Permitir el crecimiento del número de usuarios, créditos y transacciones sin rediseñar la arquitectura. |
| **Tipo de requisito** | No funcional – Escalabilidad. |
| **Componentes involucrados** | Arquitectura serverless (Vercel), PostgreSQL gestionado (Supabase), rate limiting distribuido (Upstash Redis). |
| **Criterios de aceptación** | La aplicación escala horizontalmente en funciones serverless; la base de datos soporta el crecimiento con índices y vistas. |
| **Riesgos potenciales** | Límites de plan gratuito, cuellos de botella en la base de datos. |
| **Impacto en el sistema** | Medio. Relevante a mediano plazo. |
| **Dependencias** | Infraestructura, RNF-02. |
| **Priorización** | Media. |

---

## RNF-06 · Mantenibilidad

| Aspecto | Descripción |
|---------|-------------|
| **Objetivo del requisito** | Facilitar la evolución del sistema mediante código organizado, migraciones versionadas y documentación por módulo y sprint. |
| **Tipo de requisito** | No funcional – Mantenibilidad. |
| **Componentes involucrados** | Estructura de repositorio (`apps/web`, `db`, `docs`), migraciones SQL numeradas, componentes reutilizables. |
| **Criterios de aceptación** | Migraciones aplicables en orden; documentación de sprints y módulos actualizada; convenciones de código consistentes. |
| **Riesgos potenciales** | Deuda técnica, migraciones fuera de orden, base de datos sin normalizar (SCRUM-36). |
| **Impacto en el sistema** | Medio. Afecta la velocidad de desarrollo futuro. |
| **Dependencias** | Todo el proyecto. |
| **Priorización** | Media. |

---

## RNF-07 · Monitoreo y Observabilidad

| Aspecto | Descripción |
|---------|-------------|
| **Objetivo del requisito** | Detectar y diagnosticar errores en producción mediante captura de excepciones y repetición de sesiones. |
| **Tipo de requisito** | No funcional – Observabilidad. |
| **Componentes involucrados** | Sentry (errores + Session Replay), tabla de auditoría, logs de Vercel. |
| **Criterios de aceptación** | Errores capturados en Sentry omitiendo 401/403 esperados; posibilidad de reconstruir incidentes. |
| **Riesgos potenciales** | Ruido de errores esperados, falta de alertas oportunas. |
| **Impacto en el sistema** | Medio-Alto. Reduce el tiempo de detección y resolución de fallos. |
| **Dependencias** | RF-13, infraestructura. |
| **Priorización** | Media-Alta. |

---

## RNF-08 · Cumplimiento Legal (Habeas Data)

| Aspecto | Descripción |
|---------|-------------|
| **Objetivo del requisito** | Cumplir con la normativa colombiana de tratamiento de datos personales (Habeas Data), publicando la política de tratamiento y garantizando el consentimiento. |
| **Tipo de requisito** | No funcional – Legal / Cumplimiento. |
| **Componentes involucrados** | Documento legal público de tratamiento de datos (`/legal`), gestión de consentimiento, seguridad de datos personales. |
| **Criterios de aceptación** | Política de tratamiento accesible públicamente (PDF); datos personales protegidos por RLS y cifrado en tránsito (HTTPS). |
| **Riesgos potenciales** | Incumplimiento normativo, exposición de datos sensibles. |
| **Impacto en el sistema** | Alto. Riesgo legal y reputacional. |
| **Dependencias** | RNF-01, RF-01. |
| **Priorización** | Alta. |

---

## RNF-09 · Compatibilidad

| Aspecto | Descripción |
|---------|-------------|
| **Objetivo del requisito** | Garantizar el funcionamiento correcto en navegadores modernos y en distintos tamaños de pantalla. |
| **Tipo de requisito** | No funcional – Compatibilidad. |
| **Componentes involucrados** | Frontend Next.js, Tailwind CSS, estándares web. |
| **Criterios de aceptación** | Funciona en versiones recientes de Chrome, Firefox, Edge y Safari, en móvil y escritorio. |
| **Riesgos potenciales** | Comportamientos divergentes entre navegadores. |
| **Impacto en el sistema** | Medio. Afecta el alcance de usuarios. |
| **Dependencias** | RNF-04. |
| **Priorización** | Media. |

---

## RNF-10 · Integridad y Consistencia de Datos

| Aspecto | Descripción |
|---------|-------------|
| **Objetivo del requisito** | Mantener la coherencia de la información financiera y de estados mediante restricciones, triggers y procesos idempotentes. |
| **Tipo de requisito** | No funcional – Integridad de datos. |
| **Componentes involucrados** | Restricciones e índices en PostgreSQL, triggers, webhook idempotente de pagos, normalización de tablas. |
| **Criterios de aceptación** | Un solo crédito ACTIVO por cliente; pagos sin duplicados; estados de crédito y cuota consistentes tras cada proceso. |
| **Riesgos potenciales** | Registros duplicados, estados inconsistentes, datos sin normalizar (SCRUM-36 pendiente). |
| **Impacto en el sistema** | Alto. La exactitud financiera depende de esta integridad. |
| **Dependencias** | RF-07, RF-10, modelo de datos. |
| **Priorización** | Alta. |

**Reglas de negocio asociadas:** RN-07 (un solo crédito ACTIVO simultáneo por cliente), RN-12, BD-03.

---

## Trazabilidad Requerimiento ↔ Jira

| Requerimiento | Tareas / Épicas Jira | Estado en tablero |
|---------------|----------------------|-------------------|
| RF-01 | SCRUM-6, SCRUM-33 | Finalizado |
| RF-02 | SCRUM-11 | Finalizado |
| RF-03 | SCRUM-16, SCRUM-34, SCRUM-35 | Finalizado |
| RF-04 | SCRUM-20, SCRUM-24 | Finalizado |
| RF-05 | SCRUM-18 | Finalizado |
| RF-06 | SCRUM-19, SCRUM-23 | Finalizado |
| RF-07 | SCRUM-22, SCRUM-25 | Finalizado |
| RF-08 | SCRUM-17 | Finalizado |
| RF-09 | SCRUM-29 | Finalizado |
| RF-10 | SCRUM-27 | Finalizado |
| RF-11 | SCRUM-28, SCRUM-30 | Finalizado |
| RF-12 | SCRUM-13, SCRUM-21 | Finalizado |
| RF-13 | SCRUM-12 | Finalizado |
| RF-14 | SCRUM-31 | Finalizado |
| RNF-04 | SCRUM-32 | Finalizado |
| RNF-06 / RNF-10 | SCRUM-36 (normalizar base de datos) | Por hacer |

**Épicas (Sprints):** SCRUM-1 (Fundación y Autenticación), SCRUM-2 (Dashboard y Perfil), SCRUM-3 (Solicitud de Crédito y KYC), SCRUM-4 (Pagos, Cuotas y Decisiones), SCRUM-5 (Producción, Auditoría y Finalización).

---

*Documento elaborado para el Proyecto Formativo SENA — Tecnólogo en Análisis y Desarrollo de Software (ADSO). Basado en el tablero de Jira del proyecto SCRUM y en la arquitectura implementada de PLURALL.*
