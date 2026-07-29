import { chromium } from 'playwright';
import { mkdirSync, existsSync, writeFileSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE_URL    = 'http://localhost:3000';
const OUTPUT_DIR  = join(__dirname, 'screenshots');
const REPORT_PATH = join(OUTPUT_DIR, 'REPORTE.md');
const VIEWPORT    = { width: 1440, height: 900 };

// Credenciales de los usuarios semilla, validadas con `smoke_login.mjs`
// contra el Supabase real para los 4 roles (verificado 2026-07-03).
const CREDENTIALS = {
  cliente:    { celular: '3173784693', password: 'Plurall2026*' },
  asesor:     { celular: '3100000002', password: 'Plurall2026*' },
  supervisor: { celular: '3100000001', password: 'Plurall2026*' },
  admin:      { celular: '3001234567', password: 'Plurall2026*' },
};

const PREFIX_BY_ROLE = {
  cliente:    '/dashboard',
  asesor:     '/asesor',
  supervisor: '/supervisor',
  admin:      '/admin',
};

const MODULES = [
  // ── Públicas ──
  { module: '00_landing', label: 'Landing_Page',        url: '/',                             auth: null },
  { module: '01_auth',    label: 'Login',               url: '/login',                        auth: null },
  { module: '01_auth',    label: 'Registro',            url: '/registro',                     auth: null },
  { module: '01_auth',    label: 'Recuperar',           url: '/recuperar',                    auth: null },

  // ── Cliente ──
  { module: '02_cliente', label: 'Inicio',              url: '/dashboard/inicio',             auth: 'cliente' },
  { module: '02_cliente', label: 'Creditos',            url: '/dashboard/creditos',           auth: 'cliente' },
  { module: '02_cliente', label: 'Solicitar_credito',   url: '/dashboard/creditos/solicitar', auth: 'cliente' },
  { module: '02_cliente', label: 'Cuotas',              url: '/dashboard/cuotas',             auth: 'cliente' },
  { module: '02_cliente', label: 'Documentos',          url: '/dashboard/documentos',         auth: 'cliente' },
  { module: '02_cliente', label: 'Perfil',              url: '/dashboard/perfil',             auth: 'cliente' },
  { module: '02_cliente', label: 'PQR',                 url: '/dashboard/pqr',                auth: 'cliente' },
  { module: '02_cliente', label: 'Notificaciones',      url: '/dashboard/notificaciones',     auth: 'cliente' },
  { module: '02_cliente', label: 'Ayuda',               url: '/dashboard/ayuda',              auth: 'cliente' },

  // ── Asesor ──
  { module: '03_asesor',  label: 'Dashboard_Asesor',    url: '/asesor',                       auth: 'asesor' },
  { module: '03_asesor',  label: 'Solicitudes',         url: '/asesor/solicitudes',           auth: 'asesor' },
  { module: '03_asesor',  label: 'Clientes',            url: '/asesor/clientes',              auth: 'asesor' },
  { module: '03_asesor',  label: 'Creditos_asesor',     url: '/asesor/creditos',              auth: 'asesor' },
  { module: '03_asesor',  label: 'Cobranza',            url: '/asesor/cobranza',              auth: 'asesor' },
  { module: '03_asesor',  label: 'Gestiones',           url: '/asesor/gestiones',             auth: 'asesor' },
  { module: '03_asesor',  label: 'Documentos_KYC',      url: '/asesor/documentos',            auth: 'asesor' },
  { module: '03_asesor',  label: 'Pagos',               url: '/asesor/pagos',                 auth: 'asesor' },
  { module: '03_asesor',  label: 'PQR_asesor',          url: '/asesor/pqr',                   auth: 'asesor' },
  { module: '03_asesor',  label: 'Preaprobacion',       url: '/asesor/preaprobacion',         auth: 'asesor' },
  { module: '03_asesor',  label: 'Amortizacion',        url: '/asesor/amortizacion',          auth: 'asesor' },
  { module: '03_asesor',  label: 'Motivos_rechazo_ase', url: '/asesor/motivos-rechazo',       auth: 'asesor' },
  { module: '03_asesor',  label: 'Notificaciones_ase',  url: '/asesor/notificaciones',        auth: 'asesor' },

  // ── Supervisor ──
  { module: '04_supervisor', label: 'Dashboard_Supervisor',url: '/supervisor',               auth: 'supervisor' },
  { module: '04_supervisor', label: 'Solicitudes_sup',     url: '/supervisor/solicitudes',   auth: 'supervisor' },
  { module: '04_supervisor', label: 'Asesores',            url: '/supervisor/asesores',      auth: 'supervisor' },
  { module: '04_supervisor', label: 'Clientes_sup',        url: '/supervisor/clientes',      auth: 'supervisor' },
  { module: '04_supervisor', label: 'Creditos_sup',        url: '/supervisor/creditos',      auth: 'supervisor' },
  { module: '04_supervisor', label: 'Mora',                url: '/supervisor/mora',          auth: 'supervisor' },
  { module: '04_supervisor', label: 'Cartera',             url: '/supervisor/cartera',       auth: 'supervisor' },
  { module: '04_supervisor', label: 'Funnel',              url: '/supervisor/funnel',        auth: 'supervisor' },
  { module: '04_supervisor', label: 'Desembolsos',         url: '/supervisor/desembolsos',   auth: 'supervisor' },
  { module: '04_supervisor', label: 'Auditoria',           url: '/supervisor/auditoria',     auth: 'supervisor' },
  { module: '04_supervisor', label: 'Documentos_sup',      url: '/supervisor/documentos',    auth: 'supervisor' },
  { module: '04_supervisor', label: 'Busqueda_global',     url: '/supervisor/buscar',        auth: 'supervisor' },
  { module: '04_supervisor', label: 'Puntaje_scoring',     url: '/supervisor/puntaje',       auth: 'supervisor' },
  { module: '04_supervisor', label: 'Motivos_rechazo',     url: '/supervisor/motivos-rechazo',auth: 'supervisor' },
  { module: '04_supervisor', label: 'Amortizacion_sup',    url: '/supervisor/amortizacion',  auth: 'supervisor' },
  { module: '04_supervisor', label: 'PQR_sup',             url: '/supervisor/pqr',           auth: 'supervisor' },
  { module: '04_supervisor', label: 'Notificaciones_sup',  url: '/supervisor/notificaciones',auth: 'supervisor' },

  // ── Admin ──
  { module: '05_admin', label: 'Dashboard_Admin',       url: '/admin',                      auth: 'admin' },
  { module: '05_admin', label: 'Solicitudes_Admin',     url: '/admin/solicitudes',          auth: 'admin' },
  { module: '05_admin', label: 'Clientes_Admin',        url: '/admin/clientes',             auth: 'admin' },
  { module: '05_admin', label: 'Reportes',              url: '/admin/reportes',             auth: 'admin' },
  { module: '05_admin', label: 'Scoring',               url: '/admin/scoring',              auth: 'admin' },
  { module: '05_admin', label: 'Salud_sistema',         url: '/admin/salud',                auth: 'admin' },
  { module: '05_admin', label: 'Notificaciones_Admin',  url: '/admin/notificaciones',       auth: 'admin' },
];

const toFilename = (label) => label.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
const ensureDir  = (dir)   => { if (!existsSync(dir)) mkdirSync(dir, { recursive: true }); };

async function login(page, role) {
  const creds = CREDENTIALS[role];
  if (!creds) throw new Error(`Sin credenciales para rol: ${role}`);

  await page.goto(BASE_URL + '/login', { waitUntil: 'networkidle', timeout: 30000 });
  const telInput = page.locator('input[type="tel"], input[name="celular"], input[id*="celular"], input[placeholder*="celular"]').first();
  await telInput.waitFor({ timeout: 8000 });
  await telInput.fill(creds.celular);

  const passInput = page.locator('input[type="password"]').first();
  await passInput.fill(creds.password);

  const submitBtn = page.locator('button[type="submit"]').first();
  await submitBtn.click();

  // Esperar a salir de /login
  try {
    await page.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 20000 });
  } catch {
    // Capturar mensaje de error del DOM
    const errMsg = await page.locator('[class*="text-red"], [role="alert"]').first().textContent().catch(() => null);
    throw new Error(`Login no redirigió: ${errMsg || 'timeout'}`);
  }

  // Verificar prefijo del portal esperado
  const expected = PREFIX_BY_ROLE[role];
  if (expected && !page.url().includes(expected)) {
    throw new Error(`Login redirigió a ${page.url()} (esperaba prefijo ${expected})`);
  }

  return true;
}

async function captureOne(browser, view, sessions) {
  const dir = join(OUTPUT_DIR, view.module);
  ensureDir(dir);
  const filepath = join(dir, toFilename(view.label) + '.png');

  // Obtener contexto (login la primera vez por rol)
  let ctx;
  if (view.auth) {
    if (!sessions[view.auth]) {
      ctx = await browser.newContext({ viewport: VIEWPORT });
      const loginPage = await ctx.newPage();
      await login(loginPage, view.auth);
      await loginPage.close();
      sessions[view.auth] = ctx;
    } else {
      ctx = sessions[view.auth];
    }
  } else {
    ctx = await browser.newContext({ viewport: VIEWPORT });
  }

  // 1 reintento
  let lastErr = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const page = await ctx.newPage();
      const t0 = Date.now();
      await page.goto(BASE_URL + view.url, { waitUntil: 'networkidle', timeout: 45000 });
      // Espera explícita: dejar que pinten Recharts y se hidrate el árbol client.
      await page.waitForTimeout(3000);
      await page.screenshot({ path: filepath, fullPage: true });
      const dt = Date.now() - t0;
      await page.close();
      if (attempt === 2) console.log(`  ✓ Guardado (reintento): ${filepath}`);
      return { ok: true, durationMs: dt, attempt };
    } catch (err) {
      lastErr = err;
      if (attempt === 1) {
        console.log(`  ⚠ Reintentando ${view.label}...`);
        await new Promise(r => setTimeout(r, 1500));
      }
    }
  }
  return { ok: false, error: lastErr?.message || 'desconocido' };
}

async function captureAll() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║  PLURALL — Captura automática de vistas (Playwright)    ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('Base URL :', BASE_URL);
  console.log('Salida   :', OUTPUT_DIR);
  console.log('Viewport :', VIEWPORT.width, 'x', VIEWPORT.height, '\n');

  ensureDir(OUTPUT_DIR);

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const sessions = {};
  const results  = [];
  const tGlobal  = Date.now();

  for (const view of MODULES) {
    const t0 = Date.now();
    process.stdout.write(`[${String(results.length + 1).padStart(2, '0')}/${MODULES.length}] ${view.module.padEnd(15)} ${view.label.padEnd(28)} ${view.url.padEnd(36)} ... `);
    try {
      const r = await captureOne(browser, view, sessions);
      const dt = ((Date.now() - t0) / 1000).toFixed(1);
      if (r.ok) {
        console.log(`✓ ${dt}s`);
        results.push({ ...view, status: 'ok',   duration: dt, attempts: r.attempt });
      } else {
        console.log(`✗ ${dt}s — ${r.error}`);
        results.push({ ...view, status: 'fail', duration: dt, error: r.error });
      }
    } catch (err) {
      const dt = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(`✗ ${dt}s — ${err.message}`);
      results.push({ ...view, status: 'fail', duration: dt, error: err.message });
    }
  }

  for (const ctx of Object.values(sessions)) await ctx.close();
  if (Object.keys(sessions).length === 0) await browser.close().catch(() => {});
  else await browser.close();

  // ── Generar REPORTE.md ────────────────────────────────────────────────────
  const total    = results.length;
  const ok       = results.filter(r => r.status === 'ok').length;
  const fail     = results.filter(r => r.status === 'fail').length;
  const totalSec = ((Date.now() - tGlobal) / 1000).toFixed(1);

  let md = `# Reporte de capturas — PLURALL\n\n`;
  md += `**Fecha:** ${new Date().toISOString()}  \n`;
  md += `**Base URL:** ${BASE_URL}  \n`;
  md += `**Viewport:** ${VIEWPORT.width}x${VIEWPORT.height}  \n`;
  md += `**Total:** ${total} | **OK:** ${ok} | **Fallidas:** ${fail} | **Duración:** ${totalSec}s\n\n`;
  md += `## Resumen por módulo\n\n`;
  md += `| Módulo | OK | Fail |\n|---|---|---|\n`;
  const byMod = {};
  for (const r of results) {
    if (!byMod[r.module]) byMod[r.module] = { ok: 0, fail: 0 };
    byMod[r.module][r.status === 'ok' ? 'ok' : 'fail']++;
  }
  for (const m of Object.keys(byMod)) {
    md += `| \`${m}\` | ${byMod[m].ok} | ${byMod[m].fail} |\n`;
  }
  md += `\n## Detalle por vista\n\n`;
  md += `| # | Módulo | Vista | URL | Estado | Duración | Notas |\n|---|---|---|---|---|---|---|\n`;
  results.forEach((r, i) => {
    const st = r.status === 'ok' ? '✓' : '✗';
    const note = r.status === 'ok' ? (r.attempts > 1 ? `reintento ${r.attempts}` : '') : (r.error || '').replace(/\|/g, '\\|');
    md += `| ${i + 1} | \`${r.module}\` | ${r.label} | \`${r.url}\` | ${st} | ${r.duration}s | ${note} |\n`;
  });

  if (fail > 0) {
    md += `\n## Vistas fallidas (detalle)\n\n`;
    results.filter(r => r.status === 'fail').forEach(r => {
      md += `- **${r.label}** (\`${r.url}\`): ${r.error}\n`;
    });
  }

  writeFileSync(REPORT_PATH, md, 'utf8');
  console.log('\n' + '─'.repeat(60));
  console.log(`✓ Captura finalizada.`);
  console.log(`  Total: ${total} | OK: ${ok} | Fallidas: ${fail} | Duración: ${totalSec}s`);
  console.log(`  Reporte: ${REPORT_PATH}`);
  console.log('─'.repeat(60));
}

captureAll().catch(err => { console.error('Error fatal:', err); process.exit(1); });
