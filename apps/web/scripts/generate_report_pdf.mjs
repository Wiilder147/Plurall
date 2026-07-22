/**
 * generate_report_pdf.mjs — Genera un informe PDF con la paleta de colores,
 * los componentes de diseño y todos los screenshots del frontend PLURALL.
 * Renderiza un HTML con Playwright y exporta a PDF en la carpeta Descargas.
 */
import { chromium } from 'playwright';
import { readdirSync, readFileSync, existsSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SHOTS_DIR = join(__dirname, 'screenshots');
const OUT_PDF   = join(os.homedir(), 'Downloads', 'PLURALL_Informe_Diseno.pdf');
const HTML_PATH = join(SHOTS_DIR, '_informe.html');

// ── Paleta real extraída de app/globals.css (@theme) ─────────────────────────
const NAVY = [
  ['50', '#E8EDF4'], ['100', '#C5D0E3'], ['200', '#9FB2D0'], ['300', '#7893BC'],
  ['400', '#5B7CAD'], ['500', '#3E659E'], ['600', '#375A8E'], ['700', '#2D4A79'],
  ['800', '#243B64'], ['900', '#0F1B2D'], ['950', '#080E18'],
];
const ACCENT = [
  ['50', '#FFF3E0'], ['100', '#FFE0B2'], ['200', '#FFCC80'], ['300', '#FFB74D'],
  ['400', '#FFA726'], ['500', '#FF9800'], ['600', '#FB8C00'], ['700', '#F57C00'],
  ['800', '#EF6C00'], ['900', '#E65100'],
];
const SEMANTIC = [
  ['Success', '#10B981'], ['Danger', '#EF4444'], ['Warning', '#F59E0B'], ['Info', '#3B82F6'],
];
const BASE = [
  ['Background', '#FFFFFF'], ['Foreground', '#0F1B2D'],
];

const MODULE_TITLES = {
  '00_landing':    'Público — Landing',
  '01_auth':       'Autenticación',
  '02_cliente':    'Portal Cliente',
  '03_asesor':     'Portal Asesor',
  '04_supervisor': 'Portal Supervisor',
  '05_admin':      'Portal Administrador',
};

const toB64 = (p) => `data:image/png;base64,${readFileSync(p).toString('base64')}`;
const prettyLabel = (f) => f.replace(/\.png$/, '').replace(/_/g, ' ')
  .replace(/\b\w/g, c => c.toUpperCase());

function isLight(hex) {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) > 150;
}

function swatchRow(pairs) {
  return pairs.map(([name, hex]) => `
    <div class="swatch">
      <div class="chip" style="background:${hex};color:${isLight(hex) ? '#0F1B2D' : '#fff'}">${name}</div>
      <div class="hex">${hex}</div>
    </div>`).join('');
}

// ── Recolectar screenshots por módulo ────────────────────────────────────────
const modules = readdirSync(SHOTS_DIR)
  .filter(d => existsSync(join(SHOTS_DIR, d)) && !d.startsWith('_') && !d.endsWith('.md') && !d.endsWith('.html'))
  .filter(d => { try { return readdirSync(join(SHOTS_DIR, d)).some(f => f.endsWith('.png')); } catch { return false; } })
  .sort();

let totalShots = 0;
const moduleSections = modules.map(mod => {
  const dir = join(SHOTS_DIR, mod);
  const pngs = readdirSync(dir).filter(f => f.endsWith('.png')).sort();
  totalShots += pngs.length;
  const cards = pngs.map(f => `
    <figure class="shot">
      <figcaption>${prettyLabel(f)}</figcaption>
      <img src="${toB64(join(dir, f))}" />
    </figure>`).join('');
  return `
    <section class="module">
      <h2 class="module-title">${MODULE_TITLES[mod] || mod} <span class="count">${pngs.length} vistas</span></h2>
      <div class="grid">${cards}</div>
    </section>`;
}).join('');

const fecha = new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });

const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  @page { size: A4; margin: 14mm 12mm; }
  body { font-family: 'Segoe UI', system-ui, sans-serif; color: #0F1B2D; -webkit-print-color-adjust: exact; print-color-adjust: exact; }

  /* Portada */
  .cover { height: 258mm; display: flex; flex-direction: column; justify-content: center;
           background: linear-gradient(135deg, #0F1B2D 0%, #2D4A79 60%, #375A8E 100%); color: #fff;
           padding: 0 22mm; position: relative; overflow: hidden; page-break-after: always; }
  .cover::after { content: ''; position: absolute; top: 0; right: 0; width: 180mm; height: 180mm;
                  background: #FB8C00; clip-path: polygon(100% 0, 30% 0, 100% 70%); opacity: .9; }
  .cover .brand { font-size: 15mm; font-weight: 800; letter-spacing: -1px; z-index: 1; }
  .cover .sub { font-size: 6mm; font-weight: 300; margin-top: 4mm; opacity: .9; z-index: 1; }
  .cover .meta { margin-top: 18mm; font-size: 3.6mm; line-height: 1.9; z-index: 1; opacity: .85; }
  .cover .tag { display:inline-block; margin-top: 8mm; background: rgba(255,255,255,.15); border:1px solid rgba(255,255,255,.35);
                padding: 2mm 5mm; border-radius: 999px; font-size: 3.2mm; z-index:1; }

  h1.section { font-size: 8mm; color: #0F1B2D; border-bottom: 3px solid #FB8C00; padding-bottom: 3mm; margin: 4mm 0 6mm; }
  h2.module-title { font-size: 6mm; color: #2D4A79; margin: 8mm 0 4mm; padding-left: 3mm; border-left: 5px solid #FB8C00; page-break-after: avoid; }
  .count { font-size: 3.2mm; font-weight: 400; color: #64748b; }

  .palette-block { margin-bottom: 8mm; page-break-inside: avoid; }
  .palette-block h3 { font-size: 4.4mm; margin-bottom: 3mm; color: #375A8E; }
  .row { display: flex; flex-wrap: wrap; gap: 2mm; }
  .swatch { width: 22mm; }
  .chip { height: 16mm; border-radius: 2mm 2mm 0 0; display: flex; align-items: flex-end; justify-content: center;
          padding-bottom: 1.5mm; font-size: 3mm; font-weight: 600; }
  .hex { font-size: 2.6mm; text-align: center; padding: 1mm 0; background: #f1f5f9; border-radius: 0 0 2mm 2mm; font-family: monospace; }

  .tokens { display: flex; flex-wrap: wrap; gap: 4mm; margin-top: 2mm; }
  .token-card { border: 1px solid #C5D0E3; border-radius: 3mm; padding: 4mm; width: 82mm; page-break-inside: avoid; }
  .token-card h4 { font-size: 3.8mm; color: #2D4A79; margin-bottom: 2mm; }
  .token-card p { font-size: 3mm; color: #475569; line-height: 1.6; }
  .demo-btn-primary { background:#FB8C00; color:#fff; border:none; padding:2.5mm 6mm; border-radius:999px; font-weight:600; font-size:3.2mm; }
  .demo-btn-secondary { background:transparent; color:#375A8E; border:1px solid #375A8E; padding:2.5mm 6mm; border-radius:999px; font-weight:600; font-size:3.2mm; }
  .demo-input { display:block; width:100%; margin-top:2mm; padding:2.5mm 4mm; border-radius:999px; border:1px solid transparent; background:#E5E7EB; font-size:3mm; }
  .demo-card { margin-top:2mm; background:#fff; border:1px solid #C5D0E3; border-radius:3mm; padding:3mm; box-shadow:0 2px 6px rgba(0,0,0,.06); font-size:3mm; }

  .module { page-break-before: always; }
  .grid { display: flex; flex-direction: column; gap: 6mm; }
  .shot { border: 1px solid #C5D0E3; border-radius: 3mm; overflow: hidden; page-break-inside: avoid; box-shadow: 0 2px 8px rgba(15,27,45,.08); }
  .shot figcaption { background: #0F1B2D; color: #fff; font-size: 3.4mm; font-weight: 600; padding: 2.5mm 4mm; }
  .shot img { width: 100%; display: block; }
</style></head>
<body>

  <div class="cover">
    <div class="brand">PLURALL</div>
    <div class="sub">Informe de Diseño &amp; Identidad Visual</div>
    <div class="tag">Sistema de gestión de créditos</div>
    <div class="meta">
      Paleta de colores · Componentes UI · ${totalShots} capturas del frontend<br/>
      6 módulos · Cliente · Asesor · Supervisor · Administrador<br/>
      Generado el ${fecha}
    </div>
  </div>

  <h1 class="section">1. Paleta de colores</h1>
  <div class="palette-block">
    <h3>Navy — Color primario de marca</h3>
    <div class="row">${swatchRow(NAVY)}</div>
  </div>
  <div class="palette-block">
    <h3>Accent — Naranja (acción / CTA)</h3>
    <div class="row">${swatchRow(ACCENT)}</div>
  </div>
  <div class="palette-block">
    <h3>Colores semánticos</h3>
    <div class="row">${swatchRow(SEMANTIC)}</div>
  </div>
  <div class="palette-block">
    <h3>Base</h3>
    <div class="row">${swatchRow(BASE)}</div>
  </div>

  <h1 class="section" style="page-break-before:always">2. Sistema de diseño</h1>
  <div class="tokens">
    <div class="token-card">
      <h4>Tipografía</h4>
      <p><b>Montserrat</b> (var --font-sans), fallback system-ui / sans-serif.<br/>
      Pesos usados: 300 · 400 · 600 · 700 · 800.</p>
      <p style="font-weight:800;font-size:5mm;margin-top:2mm">Aa Bb Cc 123</p>
    </div>
    <div class="token-card">
      <h4>Botones</h4>
      <p>Radio completo (pill), transición y elevación al hover.</p>
      <div style="margin-top:3mm;display:flex;gap:3mm">
        <span class="demo-btn-primary">Primario</span>
        <span class="demo-btn-secondary">Secundario</span>
      </div>
    </div>
    <div class="token-card">
      <h4>Campos de entrada</h4>
      <p>Fondo gris, radio pill, focus con anillo naranja.</p>
      <input class="demo-input" value="cliente@ejemplo.com" readonly />
    </div>
    <div class="token-card">
      <h4>Tarjetas</h4>
      <p>Fondo blanco, borde navy-100, radio 1rem, sombra suave.</p>
      <div class="demo-card">Contenido de tarjeta · KPI · panel</div>
    </div>
    <div class="token-card">
      <h4>Formas decorativas</h4>
      <p>Triángulos diagonales (clip-path) en naranja accent-600 y navy-900 como sello de marca.</p>
    </div>
    <div class="token-card">
      <h4>Modo claro / oscuro</h4>
      <p>Tema conmutable vía <code>[data-theme]</code>; los paneles staff invierten la escala slate.</p>
    </div>
  </div>

  <h1 class="section" style="page-break-before:always">3. Capturas del frontend</h1>
  ${moduleSections}

</body></html>`;

writeFileSync(HTML_PATH, html, 'utf8');
console.log(`HTML generado (${(html.length / 1024 / 1024).toFixed(1)} MB) · ${totalShots} capturas`);

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newContext().then(c => c.newPage());
await page.goto('file://' + HTML_PATH.replace(/\\/g, '/'), { waitUntil: 'networkidle', timeout: 120000 });
await page.pdf({
  path: OUT_PDF,
  format: 'A4',
  printBackground: true,
  margin: { top: '0', bottom: '0', left: '0', right: '0' },
});
await browser.close();

console.log(`\n✓ PDF generado: ${OUT_PDF}`);
