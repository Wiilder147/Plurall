/**
 * smoke_login.mjs — Test de humo de login con Playwright.
 * Confirma que las credenciales de `docs/usuarios_prueba.md` funcionan
 * contra el Supabase real antes de hacer el barrido completo.
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const ROLE = process.argv[2] || 'cliente';
const CRED = {
  cliente:    { celular: '3173784693', password: 'Plurall2026*' },
  asesor:     { celular: '3100000002', password: 'Plurall2026*' },
  supervisor: { celular: '3100000001', password: 'Plurall2026*' },
  admin:      { celular: '3001234567', password: 'Plurall2026*' },
};

const c = CRED[ROLE];
if (!c) { console.error('Rol inválido:', ROLE); process.exit(1); }

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

const start = Date.now();
try {
  console.log(`[${ROLE}] Navegando a ${BASE}/login...`);
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 30000 });
  const telInput = page.locator('input[type="tel"], input[name="celular"], input[id*="celular"], input[placeholder*="celular"]').first();
  await telInput.waitFor({ timeout: 8000 });
  await telInput.fill(c.celular);
  const passInput = page.locator('input[type="password"]').first();
  await passInput.fill(c.password);
  console.log(`[${ROLE}] Click submit...`);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 20000 });
  const dt = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`[${ROLE}] ✓ Login OK en ${dt}s → ${page.url()}`);

  // Capturar la landing post-login como prueba
  await page.screenshot({ path: `smoke_${ROLE}.png`, fullPage: false });
  console.log(`[${ROLE}] Captura: smoke_${ROLE}.png`);
} catch (err) {
  const dt = ((Date.now() - start) / 1000).toFixed(1);
  console.error(`[${ROLE}] ✗ FALLÓ en ${dt}s:`, err.message);
  try { await page.screenshot({ path: `smoke_${ROLE}_fail.png`, fullPage: false }); } catch {}
  process.exit(1);
} finally {
  await browser.close();
}
