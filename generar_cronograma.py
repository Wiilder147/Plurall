#!/usr/bin/env python3
"""
Cronograma PLURALL — Con tareas completadas (color sólido) y pendientes (color claro)
Período: 22-Mar-2025 → 11-Jul-2025  (~16 semanas)
"""
import openpyxl
from openpyxl.styles import PatternFill, Font, Alignment, Border, Side
from openpyxl.utils import get_column_letter
import datetime

# ─── PALETA ───────────────────────────────────────────────────────────────────
# Colores "hecho" (sólidos)
ROSA_OK    = "FFEA899A"
AZUL_OK    = "FF7AABCF"
VERDE_OK   = "FF6AA84F"
AMARILLO_OK= "FFE6C629"
GRIS_OK    = "FF999999"

# Colores "pendiente" (versión clara)
ROSA_P     = "FFFFE0E6"
AZUL_P     = "FFD6E9F8"
VERDE_P    = "FFD9EAD3"
AMARILLO_P = "FFFFF9DB"
GRIS_P     = "FFF2F2F2"

C_HDR_DARK  = "FF1F3864"
C_HDR_MID   = "FF2E75B6"
C_HDR_LIGHT = "FFD9E2F3"
C_FASE_BG   = "FF1F1F1F"
C_WHITE     = "FFFFFFFF"
C_WEEKEND   = "FFD9D9D9"
C_SEP       = "FFDDDDDD"

START_DATE = datetime.date(2025, 3, 22)
TOTAL_DAYS = 112  # ~16 semanas (hasta ~11-Jul-2025)

def fill_solid(color):
    return PatternFill("solid", fgColor=color)

def font(bold=False, size=9, color="FF000000", name="Calibri"):
    return Font(bold=bold, size=size, color=color, name=name)

def align(h="center", v="center", wrap=False):
    return Alignment(horizontal=h, vertical=v, wrap_text=wrap)

def thin_border():
    s = Side(style="thin", color="FFB0B0B0")
    return Border(left=s, right=s, top=s, bottom=s)

def sc(ws, row, col, value=None, bg=None, bold=False, size=9,
       h_align="center", v_align="center", wrap=False,
       font_color="FF000000", border=True):
    c = ws.cell(row=row, column=col, value=value)
    if bg:
        c.fill = fill_solid(bg)
    c.font = font(bold=bold, size=size, color=font_color)
    c.alignment = align(h_align, v_align, wrap)
    if border:
        c.border = thin_border()
    return c

# status: 'done', 'wip', 'todo'
MODULES = [
    # ── CAMILA AVILA (Rosa) ──
    {
        "header": "MÓDULO CLIENTES Y AUTENTICACIÓN — Camila Avila",
        "ok": ROSA_OK, "pend": ROSA_P,
        "tasks": [
            ("✅ Diseño BD: cliente, perfil_usuario, rol, triggers SQL",               0,  4,  'done'),
            ("✅ Landing page pública / y middleware de sesión",                       3,  7,  'done'),
            ("✅ Página Login con glassmorphism (/login)",                             5, 10,  'done'),
            ("✅ Página Registro con validación Habeas Data (/registro)",              8, 12,  'done'),
            ("✅ Recuperar contraseña y callback Supabase Auth",                       10, 15, 'done'),
            ("✅ Directorio de clientes admin — búsqueda básica (/admin/clientes)",   13, 19, 'done'),
            ("✅ Vista Perfil del cliente (solo lectura) (/dashboard/perfil)",         16, 21, 'done'),
            ("🔄 Formulario EDICIÓN perfil cliente (PUT /api/clientes/[id])",          30, 42, 'wip'),
            ("🔄 Detalle individual cliente admin (/admin/clientes/[id])",             35, 47, 'wip'),
            ("⏳ Módulo Supervisor — Ficha 360° del cliente (/supervisor/clientes)",  48, 63, 'todo'),
            ("⏳ Módulo Asesor — Vista estado actual del cliente (/asesor/clientes)", 56, 70, 'todo'),
            ("⏳ Verificación KYC: visor de documentos + aprobar/rechazar cédula",    60, 77, 'todo'),
            ("⏳ Seguridad: rate limiting, CAPTCHA, 2FA supervisores, IP log",        70, 84, 'todo'),
            ("⏳ Exportar directorio de clientes a CSV/Excel",                        78, 88, 'todo'),
        ],
    },
    # ── JUAN CETINA (Azul) ──
    {
        "header": "MÓDULO FORMULARIOS, SCORING Y PANEL ADMIN — Juan Cetina",
        "ok": AZUL_OK, "pend": AZUL_P,
        "tasks": [
            ("✅ Diseño BD: pregunta, score, modelo_score, evaluacion_regla",          0,  4,  'done'),
            ("✅ Stepper 3 pasos + sliders monto/plazo (useMemo tiempo real)",         5, 12,  'done'),
            ("✅ Upload documentos KYC a Supabase Storage",                            10, 16, 'done'),
            ("✅ Motor scoring Experian MOCK (consultarExperian)",                     12, 18, 'done'),
            ("✅ Dashboard admin KPIs paralelos (/admin)",                             15, 20, 'done'),
            ("✅ Gestión solicitudes con tabs de filtro (/admin/solicitudes)",          17, 23, 'done'),
            ("✅ Reportes financieros con gráfica barras CSS (/admin/reportes)",       20, 26, 'done'),
            ("🔄 Formulario aprobación con condiciones (/admin/solicitudes/[id])",     28, 40, 'wip'),
            ("🔄 Resumen de condiciones en Step 3 del formulario solicitud",           30, 42, 'wip'),
            ("⏳ Supervisor — Cola solicitudes pre-aprobadas (/supervisor/solicitudes)",48, 61, 'todo'),
            ("⏳ Supervisor — Visor KYC + gauge de score (/supervisor/solicitudes/[id])",55,70,'todo'),
            ("⏳ Supervisor — Reportería avanzada con gráficas reales",               63, 79, 'todo'),
            ("⏳ Exportar reportes a CSV/Excel (/api/reportes/export)",               70, 84, 'todo'),
            ("⏳ Scoring real: conectar API Experian/TransUnion",                     80, 95, 'todo'),
        ],
    },
    # ── JUAN MAURELLO (Verde) ──
    {
        "header": "MÓDULO RECHAZOS, DECISIONES Y DOCUMENTOS — Juan Maurello",
        "ok": VERDE_OK, "pend": VERDE_P,
        "tasks": [
            ("✅ Diseño BD: motivo_rechazo, decision_solicitud",                       0,  4,  'done'),
            ("✅ API PATCH aprobar/rechazar + verificación de rol",                    10, 18, 'done'),
            ("✅ Registro en decision_solicitud + inmutabilidad HTTP 409",              15, 22, 'done'),
            ("✅ Rechazo automático por Experian en API solicitar",                    12, 20, 'done'),
            ("✅ Centro de documentos del cliente (/dashboard/documentos)",            18, 24, 'done'),
            ("✅ APIs documentos: contrato, plan-pagos, estado-cuenta, paz-y-salvo",   20, 28, 'done'),
            ("🔄 Formulario de rechazo con dropdown de motivos reales",               32, 44, 'wip'),
            ("🔄 Mejora HTML documentos: membrete, logo y cláusulas formales",        35, 48, 'wip'),
            ("⏳ Supervisor — Bandeja decisiones con historial del cliente",           50, 64, 'todo'),
            ("⏳ Notificación email al cliente al aprobar/rechazar (Resend)",          55, 68, 'todo'),
            ("⏳ Generación PDF real (Puppeteer / jsPDF)",                             65, 80, 'todo'),
            ("⏳ Firma electrónica digital en contratos",                              74, 88, 'todo'),
            ("⏳ API certificado-deuda vigente y catálogo motivos rechazo admin",      80, 92, 'todo'),
        ],
    },
    # ── JEFERSON LUGO (Amarillo) ──
    {
        "header": "MÓDULO CRÉDITOS, PLAN DE PAGOS Y CALCULADORA — Jeferson Lugo",
        "ok": AMARILLO_OK, "pend": AMARILLO_P,
        "tasks": [
            ("✅ Diseño BD: credito, plan_pago, cuota (relaciones y estados)",          0,  5,  'done'),
            ("✅ lib/calculadora.js — amortización francesa + formatCOP",               3,  8,  'done'),
            ("✅ Vista Mis Créditos (activo + historial) (/dashboard/creditos)",       10, 17, 'done'),
            ("✅ API desembolso: crédito + plan_pago + N cuotas bulk",                 13, 20, 'done'),
            ("✅ Plan amortización completo con estados (/dashboard/cuotas)",          16, 22, 'done'),
            ("✅ Dashboard inicio 4 KPIs + próxima cuota (/dashboard/inicio)",         18, 24, 'done'),
            ("✅ Pantalla pago de cuota individual (/dashboard/cuotas/[id]/pagar)",    20, 26, 'done'),
            ("🔄 Detalle de crédito individual (/dashboard/creditos/[id]) — vacío",   28, 38, 'wip'),
            ("🔄 Detección manual de mora (no automática) — requiere cron job",        30, 42, 'wip'),
            ("⏳ Cron job detectar-mora (Vercel Cron / pg_cron) — CRÍTICO",           44, 58, 'todo'),
            ("⏳ Triggers BD: cuota VENCIDA → credito EN_MORA automáticamente",       48, 62, 'todo'),
            ("⏳ Módulo Pago Anticipado / Cancelación total del crédito",              56, 70, 'todo'),
            ("⏳ Módulo Reestructuración / Refinanciación (Supervisor)",               64, 79, 'todo'),
            ("⏳ Vista Asesor — Cartera + pago en efectivo (/asesor/cartera)",         70, 85, 'todo'),
            ("⏳ calcularMoraAcumulada(), simularPagoAnticipado(), calcularRestructuracion()", 75, 90, 'todo'),
        ],
    },
    # ── WILDER FEO (Gris) ──
    {
        "header": "MÓDULO PAGOS, AUDITORÍA Y NOTIFICACIONES — Wilder Feo",
        "ok": GRIS_OK, "pend": GRIS_P,
        "tasks": [
            ("✅ Diseño BD: pago, historial_estado, log_auditoria, config_sistema",    0,  5,  'done'),
            ("✅ API iniciar pago HMAC SHA-256 + integración Wompi widget",            14, 22, 'done'),
            ("✅ Webhook Wompi: checksum + idempotencia + actualizar cuota/saldo",     18, 26, 'done'),
            ("✅ Registro pagos fallidos para auditoría",                              22, 28, 'done'),
            ("✅ API lockout + notificaciones (estructura base)",                       20, 28, 'done'),
            ("🔄 Integración Redis Upstash para lockout real de cuentas",             30, 44, 'wip'),
            ("🔄 Template emails completo + Resend en producción",                    32, 46, 'wip'),
            ("🔄 Poblar historial_estado desde webhook y APIs de decisión",           35, 50, 'wip'),
            ("⏳ PSE — Pago bancario via Wompi (POST /api/pagos/iniciar-pse)",        50, 64, 'todo'),
            ("⏳ Cron mora: Vercel Cron 8am diario — email recordatorio mora",        55, 68, 'todo'),
            ("⏳ Vista auditoría admin (/admin/auditoria) — log paginado",            60, 74, 'todo'),
            ("⏳ Panel configuración sistema (/admin/configuracion)",                  65, 79, 'todo'),
            ("⏳ Vista Asesor — Gestión cobranza (/asesor/cobranza)",                 68, 82, 'todo'),
            ("⏳ API reversar pago + pago manual efectivo asesor",                    74, 88, 'todo'),
            ("⏳ Notificación masiva clientes en mora + recordatorio cuota",          78, 95, 'todo'),
        ],
    },
]

wb = openpyxl.Workbook()
ws = wb.active
ws.title = "Cronograma PLURALL"
ws.sheet_view.showGridLines = False

# Anchos
ws.column_dimensions["A"].width = 2
ws.column_dimensions["B"].width = 38
ws.column_dimensions["C"].width = 68
for i in range(TOTAL_DAYS):
    ws.column_dimensions[get_column_letter(4 + i)].width = 3.2

# ─── FILA 1: TÍTULO ───────────────────────────────────────────────────────────
last_col = get_column_letter(3 + TOTAL_DAYS)
ws.merge_cells(f"B1:{last_col}1")
ws.row_dimensions[1].height = 28
c = ws.cell(row=1, column=2, value="CRONOGRAMA DE CODIFICACIÓN — PROYECTO PLURALL  |  ⚠️ EN DESARROLLO (45% avance)")
c.fill = fill_solid(C_HDR_DARK)
c.font = Font(bold=True, size=13, color="FFFFFFFF", name="Calibri")
c.alignment = align("center", "center")

# ─── FILA 2: ESTADO GENERAL ───────────────────────────────────────────────────
ws.row_dimensions[2].height = 16
ws.merge_cells("B2:C2")
sc(ws, 2, 2, value="SENA — Tecnólogo ADSO | Proyecto Formativo", bg=C_HDR_MID,
   bold=True, font_color="FFFFFFFF", h_align="left")

# ─── FILAS 3-12: INFO ─────────────────────────────────────────────────────────
info_rows = [
    ("Proyecto:",          "PLURALL — Sistema de Información para Gestión de Créditos"),
    ("Integrantes:",       "Camila Avila | Juan Cetina | Juan Maurello | Jeferson Lugo | Wilder Feo"),
    ("Instructor:",        "Jefry González — SENA ADSO"),
    ("Período Sprint:",    "22 de marzo de 2025  →  11 de julio de 2025  (16 semanas)"),
    ("Stack tecnológico:", "Next.js 16 (App Router) + Supabase (PostgreSQL) + Tailwind CSS"),
    ("Integraciones:",     "Wompi (pagos) | Resend (emails) | Upstash Redis | Supabase Storage"),
    ("Repositorio:",       "GitHub: Wiilder147/Plurall"),
    ("Estado general:",    "Backend ~40% completo — Faltan: rol Supervisor, rol Asesor, mora automática, PSE, auditoría"),
    ("Roles pendientes:",  "SUPERVISOR (aprobar/desembolsar/reportes) | ASESOR (ver cartera/clientes/cobros)"),
    ("Entrega estimada:",  "🔴 Proyecto NO listo para producción — ~60% del backend por implementar"),
]
for i, (label, val) in enumerate(info_rows, start=3):
    ws.row_dimensions[i].height = 16
    sc(ws, i, 2, value=label, bg=C_HDR_MID, bold=True, font_color="FFFFFFFF", h_align="right", size=9)
    ws.merge_cells(f"C{i}:{last_col}{i}")
    sc(ws, i, 3, value=val, bg=C_HDR_LIGHT, bold=False, h_align="left", size=9)

# ─── FILA 13: LEYENDA ─────────────────────────────────────────────────────────
ws.row_dimensions[13].height = 18
sc(ws, 13, 2, value="LEYENDA:", bg=C_HDR_DARK, bold=True, font_color="FFFFFFFF", size=9)
legend_items = [
    ("✅ Completado", ROSA_OK), ("⏩ Pendiente", ROSA_P),
    ("✅ Completado", AZUL_OK), ("⏩ Pendiente", AZUL_P),
    ("✅ Completado", VERDE_OK), ("⏩ Pendiente", VERDE_P),
    ("✅ Completado", AMARILLO_OK), ("⏩ Pendiente", AMARILLO_P),
    ("✅ Completado", GRIS_OK), ("⏩ Pendiente", GRIS_P),
]
leg_col = 3
cols_per = TOTAL_DAYS // len(legend_items)
for label, color in legend_items:
    c_end = min(leg_col + cols_per - 1, 3 + TOTAL_DAYS - 1)
    ws.merge_cells(f"{get_column_letter(leg_col)}13:{get_column_letter(c_end)}13")
    sc(ws, 13, leg_col, value=label, bg=color, bold=True, h_align="center", size=8)
    leg_col = c_end + 1

# ─── FILA 14: MESES ───────────────────────────────────────────────────────────
ws.row_dimensions[14].height = 16
sc(ws, 14, 2, value="MES", bg=C_HDR_DARK, bold=True, font_color="FFFFFFFF", size=9)
sc(ws, 14, 3, value="ACTIVIDAD / ENTREGABLE", bg=C_HDR_DARK, bold=True, font_color="FFFFFFFF", size=9)

month_ranges = {}
for d in range(TOTAL_DAYS):
    dt = START_DATE + datetime.timedelta(days=d)
    mk = dt.strftime("%b %Y")
    if mk not in month_ranges:
        month_ranges[mk] = [d, d]
    else:
        month_ranges[mk][1] = d

for mname, (s, e) in month_ranges.items():
    col_s, col_e = 4 + s, 4 + e
    if col_s < col_e:
        ws.merge_cells(f"{get_column_letter(col_s)}14:{get_column_letter(col_e)}14")
    sc(ws, 14, col_s, value=mname, bg=C_HDR_MID, bold=True, font_color="FFFFFFFF", size=8)

# ─── FILA 15: DÍA DE SEMANA ───────────────────────────────────────────────────
DAYS_ES = ["L", "M", "M", "J", "V", "S", "D"]
ws.row_dimensions[15].height = 14
sc(ws, 15, 2, bg=C_HDR_DARK)
sc(ws, 15, 3, bg=C_HDR_DARK)
for d in range(TOTAL_DAYS):
    dt = START_DATE + datetime.timedelta(days=d)
    is_we = dt.weekday() >= 5
    sc(ws, 15, 4+d, value=DAYS_ES[dt.weekday()],
       bg=C_WEEKEND if is_we else C_WHITE,
       bold=False, size=7, font_color="FF666666" if is_we else "FF444444")

# ─── FILA 16: NÚMERO DE DÍA ───────────────────────────────────────────────────
ws.row_dimensions[16].height = 14
sc(ws, 16, 2, value="FASE", bg=C_FASE_BG, bold=True, font_color="FFFFFFFF", size=9)
sc(ws, 16, 3, value="ACTIVIDAD / ENTREGABLE", bg=C_FASE_BG, bold=True, font_color="FFFFFFFF", size=9)
for d in range(TOTAL_DAYS):
    dt = START_DATE + datetime.timedelta(days=d)
    is_we = dt.weekday() >= 5
    sc(ws, 16, 4+d, value=dt.day,
       bg="FF606060" if is_we else C_WHITE,
       bold=True, size=7,
       font_color="FFFFFFFF" if is_we else "FF444444")

# ─── TAREAS ───────────────────────────────────────────────────────────────────
current_row = 17
STATUS_LABEL = {"done": "✅", "wip": "🔄", "todo": "⏳"}

fase_start = current_row
for mod in MODULES:
    ok_col = mod["ok"]
    pend_col = mod["pend"]

    # Cabecera del módulo
    ws.row_dimensions[current_row].height = 16
    sc(ws, current_row, 2, bg=C_FASE_BG)
    sc(ws, current_row, 3, value=mod["header"], bg=ok_col, bold=True,
       h_align="left", size=10, font_color="FFFFFFFF")
    for d in range(TOTAL_DAYS):
        dt = START_DATE + datetime.timedelta(days=d)
        sc(ws, current_row, 4+d, bg="FFE8E8E8" if dt.weekday()>=5 else "FFF8F8F8")
    current_row += 1

    for task_text, c0, c1, status in mod["tasks"]:
        ws.row_dimensions[current_row].height = 15
        sc(ws, current_row, 2, bg=C_FASE_BG)
        bar_color = ok_col if status == 'done' else pend_col
        task_bg   = ok_col if status == 'done' else (pend_col if status=='todo' else "FFFFF0D0")
        sc(ws, current_row, 3, value=task_text, bg=task_bg,
           bold=(status=='done'), h_align="left", wrap=False, size=8,
           font_color="FF111111")

        for d in range(TOTAL_DAYS):
            dt = START_DATE + datetime.timedelta(days=d)
            is_we = dt.weekday() >= 5
            in_r  = c0 <= d <= c1
            if in_r:
                cell_bg = bar_color
            elif is_we:
                cell_bg = C_WEEKEND
            else:
                cell_bg = C_WHITE
            sc(ws, current_row, 4+d, bg=cell_bg)

        current_row += 1

    # Separador
    ws.row_dimensions[current_row].height = 5
    for col in range(2, 4 + TOTAL_DAYS):
        c_obj = ws.cell(row=current_row, column=col)
        c_obj.fill = fill_solid(C_SEP)
    current_row += 1

# Merge columna FASE
fase_end = current_row - 1
ws.merge_cells(f"B17:B{fase_end}")
c = ws.cell(row=17, column=2)
c.value = "CODIFICACIÓN DE LOS MÓDULOS DEL PROYECTO"
c.fill = fill_solid(C_FASE_BG)
c.font = Font(bold=True, size=9, color="FFFFFFFF", name="Calibri")
c.alignment = Alignment(horizontal="center", vertical="center",
                        wrap_text=True, text_rotation=90)
c.border = thin_border()

# ─── GUARDAR ──────────────────────────────────────────────────────────────────
out = "/home/plurall/Documents/Estudio/Plurall/Cronograma_PLURALL.xlsx"
wb.save(out)
print(f"✅ {out}")
print(f"   Período: {START_DATE} → {START_DATE + datetime.timedelta(days=TOTAL_DAYS-1)}")
print(f"   Filas: 17 a {fase_end}  |  Columnas de días: {TOTAL_DAYS}")
