#!/usr/bin/env python3
"""
Cronograma PLURALL — Genera Cronograma_PLURALL.xlsx
5 Sprints Scrum | 25 tareas reales (SCRUM-6 a SCRUM-30)
Período visual: 22-Mar-2025 → 11-Jul-2025 (~16 semanas)
"""
import datetime
import os

import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

# ─── JIRA ─────────────────────────────────────────────────────────────────────
JIRA_BASE = "https://plucardsito.atlassian.net/browse"

# ─── PALETA ───────────────────────────────────────────────────────────────────
ROSA_OK     = "FFEA899A"
AZUL_OK     = "FF7AABCF"
VERDE_OK    = "FF6AA84F"
AMARILLO_OK = "FFE6C629"
GRIS_OK     = "FF999999"

ROSA_P      = "FFFFE0E6"
AZUL_P      = "FFD6E9F8"
VERDE_P     = "FFD9EAD3"
AMARILLO_P  = "FFFFF9DB"
GRIS_P      = "FFF2F2F2"

C_HDR_DARK  = "FF1F3864"
C_HDR_MID   = "FF2E75B6"
C_HDR_LIGHT = "FFD9E2F3"
C_FASE_BG   = "FF1F1F1F"
C_WHITE     = "FFFFFFFF"
C_WEEKEND   = "FFD9D9D9"
C_SEP       = "FFDDDDDD"
C_JIRA_HDR  = "FF4472C4"

START_DATE = datetime.date(2025, 3, 22)
TOTAL_DAYS = 112   # 22-Mar-2025 → 11-Jul-2025

COL_MARGIN   = 1   # A — margen
COL_FASE     = 2   # B — Sprint
COL_ACTIVITY = 3   # C — Actividad
COL_JIRA     = 4   # D — Link Jira
COL_TIMELINE = 5   # E+ — Gantt diario

# Sprints y tareas reales de Jira (plucardsito.atlassian.net)
# Épicas: SCRUM-1…SCRUM-5 | Tareas: SCRUM-6…SCRUM-30 (todas Finalizado)
#
# Cada sprint cubre ~22 días calendario (≈ 3 semanas laborales).
# Las 5 tareas de cada sprint son paralelas (trabajo simultáneo del equipo).
#   Sprint 1 — días   0-21   (22 Mar → 12 Abr)
#   Sprint 2 — días  22-43   (13 Abr →  4 May)
#   Sprint 3 — días  44-65   (5 May  → 25 May)
#   Sprint 4 — días  66-87   (26 May → 15 Jun)
#   Sprint 5 — días  88-111  (16 Jun → 11 Jul)

MODULES = [
    {
        "header":     "SPRINT 1 — Fundación y Autenticación Segura",
        "sprint_key": "SCRUM-1",
        "ok": ROSA_OK, "pend": ROSA_P,
        "tasks": [
            # (texto, día_inicio, día_fin, status, jira_key)
            ("✅ [Camila Avila]   Implementar sistema de autenticación — login, registro, recuperar contraseña",
             0, 21, "done", "SCRUM-6"),
            ("✅ [Wilder Feo]     Configurar estructura base Next.js 16 + middleware de rutas y roles",
             0, 21, "done", "SCRUM-7"),
            ("✅ [Juan Cetina]    Diseñar esquema de BD — migraciones SQL, tablas y políticas RLS",
             0, 21, "done", "SCRUM-8"),
            ("✅ [Juan Maurello]  Crear Landing Page pública y sistema de diseño global",
             0, 21, "done", "SCRUM-9"),
            ("✅ [Jeferson Lugo]  Implementar calculadora de amortización francesa (lib/calculadora.js)",
             0, 21, "done", "SCRUM-10"),
        ],
    },
    {
        "header":     "SPRINT 2 — Dashboard y Perfil de Usuario",
        "sprint_key": "SCRUM-2",
        "ok": AZUL_OK, "pend": AZUL_P,
        "tasks": [
            ("✅ [Camila Avila]   Pantalla de perfil del cliente con datos reales de Supabase",
             22, 43, "done", "SCRUM-11"),
            ("✅ [Wilder Feo]     Crear tablas de auditoría — historial_estado, log_auditoria y config_sistema",
             22, 43, "done", "SCRUM-12"),
            ("✅ [Juan Cetina]    Panel de administración base con control de acceso por roles",
             22, 43, "done", "SCRUM-13"),
            ("✅ [Juan Maurello]  Configurar Supabase Storage — bucket documentos_kyc y tabla documento_cliente",
             22, 43, "done", "SCRUM-14"),
            ("✅ [Jeferson Lugo]  Dashboard de inicio del cliente y sidebar responsivo",
             22, 43, "done", "SCRUM-15"),
        ],
    },
    {
        "header":     "SPRINT 3 — Solicitud de Crédito y Documentos KYC",
        "sprint_key": "SCRUM-3",
        "ok": VERDE_OK, "pend": VERDE_P,
        "tasks": [
            ("✅ [Camila Avila]   Flujo completo de solicitud de crédito — stepper multi-paso y API backend",
             44, 65, "done", "SCRUM-16"),
            ("✅ [Wilder Feo]     Sistema de notificaciones email con Resend — aprobación, rechazo y recordatorio",
             44, 65, "done", "SCRUM-17"),
            ("✅ [Juan Cetina]    Motor de scoring crediticio — tablas score, score_factor y cuestionario",
             44, 65, "done", "SCRUM-18"),
            ("✅ [Juan Maurello]  Sistema de decisión analista — aprobar/rechazar con catálogo de motivos",
             44, 65, "done", "SCRUM-19"),
            ("✅ [Jeferson Lugo]  Lista y detalle de créditos del cliente (/dashboard/creditos)",
             44, 65, "done", "SCRUM-20"),
        ],
    },
    {
        "header":     "SPRINT 4 — Pagos, Cuotas y Decisiones",
        "sprint_key": "SCRUM-4",
        "ok": AMARILLO_OK, "pend": AMARILLO_P,
        "tasks": [
            ("✅ [Camila Avila]   Directorio de clientes admin — búsqueda, filtros y detalle individual",
             66, 87, "done", "SCRUM-21"),
            ("✅ [Wilder Feo]     Integración pasarela Wompi — API HMAC SHA-256 y webhook idempotente",
             66, 87, "done", "SCRUM-22"),
            ("✅ [Juan Cetina]    Panel admin de solicitudes — lista, detalle y acciones de decisión",
             66, 87, "done", "SCRUM-23"),
            ("✅ [Juan Maurello]  Módulo de documentos descargables — extracto de cuenta y paz y salvo",
             66, 87, "done", "SCRUM-24"),
            ("✅ [Jeferson Lugo]  Plan de pagos, cuotas y flujo de pago con widget Wompi",
             66, 87, "done", "SCRUM-25"),
        ],
    },
    {
        "header":     "SPRINT 5 — Producción, Auditoría y Finalización",
        "sprint_key": "SCRUM-5",
        "ok": GRIS_OK, "pend": GRIS_P,
        "tasks": [
            ("✅ [Camila Avila]   Gestión KYC avanzada — verificación de documentos y ciclo de vida del cliente",
             88, 111, "done", "SCRUM-26"),
            ("✅ [Wilder Feo]     Cron job de mora automática y panel de configuración del sistema",
             88, 111, "done", "SCRUM-27"),
            ("✅ [Juan Cetina]    Analytics y métricas del dashboard admin — KPIs de cartera",
             88, 111, "done", "SCRUM-28"),
            ("✅ [Juan Maurello]  Módulo de cobranza para asesores — gestión de clientes en mora",
             88, 111, "done", "SCRUM-29"),
            ("✅ [Jeferson Lugo]  Despliegue final en Vercel y vistas de supervisor",
             88, 111, "done", "SCRUM-30"),
        ],
    },
]


def fill_solid(color):
    return PatternFill("solid", fgColor=color)


def font(bold=False, size=9, color="FF000000", name="Calibri", underline=None):
    return Font(bold=bold, size=size, color=color, name=name, underline=underline)


def align(h="center", v="center", wrap=False):
    return Alignment(horizontal=h, vertical=v, wrap_text=wrap)


def thin_border():
    s = Side(style="thin", color="FFB0B0B0")
    return Border(left=s, right=s, top=s, bottom=s)


def sc(ws, row, col, value=None, bg=None, bold=False, size=9,
       h_align="center", v_align="center", wrap=False,
       font_color="FF000000", border=True, hyperlink=None, underline=None):
    c = ws.cell(row=row, column=col, value=value)
    if bg:
        c.fill = fill_solid(bg)
    c.font = font(bold=bold, size=size, color=font_color, underline=underline)
    c.alignment = align(h_align, v_align, wrap)
    if border:
        c.border = thin_border()
    if hyperlink:
        c.hyperlink = hyperlink
    return c


def last_timeline_col():
    return COL_TIMELINE + TOTAL_DAYS - 1


def last_col_letter():
    return get_column_letter(last_timeline_col())


def main():
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Cronograma PLURALL"
    ws.sheet_view.showGridLines = False

    last_col = last_col_letter()

    ws.column_dimensions["A"].width = 2
    ws.column_dimensions["B"].width = 38
    ws.column_dimensions["C"].width = 62
    ws.column_dimensions["D"].width = 12
    for i in range(TOTAL_DAYS):
        ws.column_dimensions[get_column_letter(COL_TIMELINE + i)].width = 3.2

    # ─── FILA 1: TÍTULO ──────────────────────────────────────────────────────
    ws.merge_cells(f"B1:{last_col}1")
    ws.row_dimensions[1].height = 28
    c = ws.cell(
        row=1, column=COL_FASE,
        value="CRONOGRAMA DE CODIFICACIÓN — PROYECTO PLURALL  |  ✅ 100% completado (5 Sprints / 25 tareas)",
    )
    c.fill = fill_solid(C_HDR_DARK)
    c.font = Font(bold=True, size=13, color="FFFFFFFF", name="Calibri")
    c.alignment = align("center", "center")

    # ─── FILA 2 ────────────────────────────────────────────────────────────────
    ws.row_dimensions[2].height = 16
    ws.merge_cells("B2:C2")
    sc(ws, 2, COL_FASE, value="SENA — Tecnólogo ADSO | Proyecto Formativo", bg=C_HDR_MID,
       bold=True, font_color="FFFFFFFF", h_align="left")
    sc(ws, 2, COL_JIRA, value="JIRA", bg=C_JIRA_HDR, bold=True, font_color="FFFFFFFF", size=8)

    info_rows = [
        ("Proyecto:",          "PLURALL — Sistema de Información para Gestión de Créditos"),
        ("Integrantes:",       "Camila Avila | Juan Cetina | Juan Maurello | Jeferson Lugo | Wilder Feo"),
        ("Instructor:",        "Jefry González — SENA ADSO"),
        ("Período Sprint:",    "22 de marzo de 2025  →  11 de julio de 2025  (16 semanas / 5 sprints Scrum)"),
        ("Stack tecnológico:", "Next.js 16 (App Router) + Supabase (PostgreSQL) + Tailwind CSS 4"),
        ("Integraciones:",     "Wompi (pagos) | Resend (emails) | Upstash Redis | Supabase Storage"),
        ("Repositorio:",       "GitHub: https://github.com/Wiilder147/Plurall"),
        ("Jira:",              f"{JIRA_BASE} — épicas SCRUM-1…SCRUM-5 | tareas SCRUM-6…SCRUM-30 (clic en columna JIRA)"),
        ("Estado general:",    "4 portales operativos (Cliente, Asesor, Supervisor, Admin) + APIs + crons"),
        ("Metodología:",       "Scrum — 5 sprints de ~3 semanas | 5 integrantes | 1 tarea por persona por sprint"),
    ]
    for i, (label, val) in enumerate(info_rows, start=3):
        ws.row_dimensions[i].height = 16
        sc(ws, i, COL_FASE, value=label, bg=C_HDR_MID, bold=True, font_color="FFFFFFFF",
           h_align="right", size=9)
        ws.merge_cells(f"C{i}:{last_col}{i}")
        sc(ws, i, COL_ACTIVITY, value=val, bg=C_HDR_LIGHT, bold=False, h_align="left", size=9)

    # ─── FILA 13: LEYENDA ─────────────────────────────────────────────────────
    ws.row_dimensions[13].height = 18
    sc(ws, 13, COL_FASE, value="LEYENDA:", bg=C_HDR_DARK, bold=True, font_color="FFFFFFFF", size=9)
    sc(ws, 13, COL_JIRA, value="Ticket", bg=C_JIRA_HDR, bold=True, font_color="FFFFFFFF", size=8)
    legend_items = [
        ("✅ Sprint 1", ROSA_OK),    ("⏩ Pendiente", ROSA_P),
        ("✅ Sprint 2", AZUL_OK),    ("⏩ Pendiente", AZUL_P),
        ("✅ Sprint 3", VERDE_OK),   ("⏩ Pendiente", VERDE_P),
        ("✅ Sprint 4", AMARILLO_OK), ("⏩ Pendiente", AMARILLO_P),
        ("✅ Sprint 5", GRIS_OK),    ("⏩ Pendiente", GRIS_P),
    ]
    leg_col = COL_TIMELINE
    cols_per = TOTAL_DAYS // len(legend_items)
    for label, color in legend_items:
        c_end = min(leg_col + cols_per - 1, last_timeline_col())
        if leg_col < c_end:
            ws.merge_cells(f"{get_column_letter(leg_col)}13:{get_column_letter(c_end)}13")
        sc(ws, 13, leg_col, value=label, bg=color, bold=True, h_align="center", size=8)
        leg_col = c_end + 1

    # ─── FILA 14: MESES ───────────────────────────────────────────────────────
    ws.row_dimensions[14].height = 16
    sc(ws, 14, COL_FASE, value="SPRINT", bg=C_HDR_DARK, bold=True, font_color="FFFFFFFF", size=9)
    sc(ws, 14, COL_ACTIVITY, value="ACTIVIDAD / ENTREGABLE", bg=C_HDR_DARK, bold=True, font_color="FFFFFFFF", size=9)
    sc(ws, 14, COL_JIRA, value="JIRA", bg=C_JIRA_HDR, bold=True, font_color="FFFFFFFF", size=8)

    month_ranges = {}
    for d in range(TOTAL_DAYS):
        dt = START_DATE + datetime.timedelta(days=d)
        mk = dt.strftime("%b %Y")
        if mk not in month_ranges:
            month_ranges[mk] = [d, d]
        else:
            month_ranges[mk][1] = d

    for mname, (s, e) in month_ranges.items():
        col_s, col_e = COL_TIMELINE + s, COL_TIMELINE + e
        if col_s < col_e:
            ws.merge_cells(f"{get_column_letter(col_s)}14:{get_column_letter(col_e)}14")
        sc(ws, 14, col_s, value=mname, bg=C_HDR_MID, bold=True, font_color="FFFFFFFF", size=8)

    # ─── FILAS 15-16: DÍAS ────────────────────────────────────────────────────
    DAYS_ES = ["L", "M", "M", "J", "V", "S", "D"]
    ws.row_dimensions[15].height = 14
    sc(ws, 15, COL_FASE, bg=C_HDR_DARK)
    sc(ws, 15, COL_ACTIVITY, bg=C_HDR_DARK)
    sc(ws, 15, COL_JIRA, bg=C_JIRA_HDR)
    for d in range(TOTAL_DAYS):
        dt = START_DATE + datetime.timedelta(days=d)
        is_we = dt.weekday() >= 5
        sc(ws, 15, COL_TIMELINE + d, value=DAYS_ES[dt.weekday()],
           bg=C_WEEKEND if is_we else C_WHITE,
           size=7, font_color="FF666666" if is_we else "FF444444")

    ws.row_dimensions[16].height = 14
    sc(ws, 16, COL_FASE, value="FASE", bg=C_FASE_BG, bold=True, font_color="FFFFFFFF", size=9)
    sc(ws, 16, COL_ACTIVITY, value="ACTIVIDAD / ENTREGABLE", bg=C_FASE_BG, bold=True, font_color="FFFFFFFF", size=9)
    sc(ws, 16, COL_JIRA, value="REVISAR", bg=C_FASE_BG, bold=True, font_color="FFFFFFFF", size=8)
    for d in range(TOTAL_DAYS):
        dt = START_DATE + datetime.timedelta(days=d)
        is_we = dt.weekday() >= 5
        sc(ws, 16, COL_TIMELINE + d, value=dt.day,
           bg="FF606060" if is_we else C_WHITE,
           bold=True, size=7,
           font_color="FFFFFFFF" if is_we else "FF444444")

    # ─── TAREAS ───────────────────────────────────────────────────────────────
    current_row = 17
    fase_start = current_row

    for mod in MODULES:
        ok_col    = mod["ok"]
        pend_col  = mod["pend"]
        sprint_key = mod["sprint_key"]

        # Fila encabezado del sprint
        ws.row_dimensions[current_row].height = 17
        sc(ws, current_row, COL_FASE, bg=C_FASE_BG)
        sc(ws, current_row, COL_ACTIVITY, value=mod["header"], bg=ok_col,
           bold=True, h_align="left", size=10, font_color="FFFFFFFF")
        # Enlazar la épica del sprint en la columna Jira
        sc(ws, current_row, COL_JIRA, value=sprint_key, bg=ok_col,
           h_align="center", size=8, font_color="FFFFFFFF",
           bold=True, hyperlink=f"{JIRA_BASE}/{sprint_key}", underline="single")
        for d in range(TOTAL_DAYS):
            dt = START_DATE + datetime.timedelta(days=d)
            sc(ws, current_row, COL_TIMELINE + d,
               bg="FFE8E8E8" if dt.weekday() >= 5 else "FFF8F8F8")
        current_row += 1

        for task_text, c0, c1, status, jira_key in mod["tasks"]:
            ws.row_dimensions[current_row].height = 15
            sc(ws, current_row, COL_FASE, bg=C_FASE_BG)

            bar_color = ok_col if status == "done" else pend_col
            task_bg   = ok_col if status == "done" else pend_col
            sc(ws, current_row, COL_ACTIVITY, value=task_text, bg=task_bg,
               bold=(status == "done"), h_align="left", size=8, font_color="FF111111")

            if status == "done" and jira_key:
                url = f"{JIRA_BASE}/{jira_key}"
                sc(ws, current_row, COL_JIRA, value=jira_key, bg=task_bg,
                   h_align="center", size=8, font_color="FF0563C1",
                   hyperlink=url, underline="single")
            else:
                sc(ws, current_row, COL_JIRA, value="—", bg=task_bg,
                   h_align="center", size=8, font_color="FF888888")

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
                sc(ws, current_row, COL_TIMELINE + d, bg=cell_bg)

            current_row += 1

        # Separador entre sprints
        ws.row_dimensions[current_row].height = 5
        for col in range(COL_FASE, last_timeline_col() + 1):
            ws.cell(row=current_row, column=col).fill = fill_solid(C_SEP)
        current_row += 1

    fase_end = current_row - 1
    ws.merge_cells(f"B{fase_start}:B{fase_end}")
    c = ws.cell(row=fase_start, column=COL_FASE)
    c.value = "SPRINTS DEL PROYECTO  (5 sprints · 25 tareas · 16 semanas)"
    c.fill = fill_solid(C_FASE_BG)
    c.font = Font(bold=True, size=9, color="FFFFFFFF", name="Calibri")
    c.alignment = Alignment(
        horizontal="center", vertical="center", wrap_text=True, text_rotation=90
    )
    c.border = thin_border()

    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "Cronograma_PLURALL.xlsx")
    wb.save(out)

    done = sum(1 for m in MODULES for t in m["tasks"] if t[3] == "done")
    todo = sum(1 for m in MODULES for t in m["tasks"] if t[3] == "todo")
    print(f"Guardado: {out}")
    print(f"Periodo:  {START_DATE} -> {START_DATE + datetime.timedelta(days=TOTAL_DAYS - 1)}")
    print(f"Tareas:   {done} completadas | {todo} pendientes | Filas {fase_start}–{fase_end}")
    print(f"Jira:     {JIRA_BASE}/SCRUM-1  …  {JIRA_BASE}/SCRUM-30")


if __name__ == "__main__":
    main()
