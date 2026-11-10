/**
 * smoke_login.mjs — Test de humo de login con Playwright.
 * Verifica que un usuario de prueba puede iniciar sesión contra el Supabase real.
 *
 * Uso:
 *   SMOKE_CLIENTE_CELULAR=... SMOKE_CLIENTE_PASSWORD=... node scripts/smoke_login.mjs cliente
 *
 * Las credenciales NUNCA se versionan. Define una variable por rol:
 *   SMOKE_<ROL>_CELULAR y SMOKE_<ROL>_PASSWORD
 */
import { chromium } from 'playwright';

const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:3000';
const ROLE = process.argv[2] || 'cliente';

function credenciales(rol) {
  const key = rol.toUpperCase();
  return {
    celular: process.env[`SMOKE_${key}_CELULAR`],
    password: process.env[`SMOKE_${key}_PASSWORD`],
  };
}

const c = credenciales(ROLE);
if (!c.celular || !c.password) {
  console.error(`Faltan SMOKE_${ROLE.toUpperCase()}_CELULAR y/o SMOKE_${ROLE.toUpperCase()}_PASSWORD`);
  process.exit(1);
}

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
