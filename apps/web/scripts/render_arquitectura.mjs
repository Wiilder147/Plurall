/**
 * render_arquitectura.mjs — Exporta el diagrama AWS de docs/diagramas a PNG.
 *
 * Uso: node scripts/render_arquitectura.mjs
 * Requiere Chrome instalado (canal "chrome") o el Chromium de Puppeteer.
 * El PNG es un artefacto generado: no se versiona (ver .gitignore).
 */
import puppeteer from 'puppeteer'
import { pathToFileURL } from 'url'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { mkdirSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '..', '..', '..')
const html = resolve(repoRoot, 'docs', 'diagramas', 'arquitectura_aws.html')
const outDir = resolve(repoRoot, 'docs', 'diagramas')
const out = resolve(outDir, 'arquitectura_aws.png')

mkdirSync(outDir, { recursive: true })

async function lanzar() {
  const base = { headless: 'new', args: ['--no-sandbox'] }
  try {
    return await puppeteer.launch({ ...base, channel: 'chrome' })
  } catch {
    return await puppeteer.launch(base)
  }
}

const browser = await lanzar()
try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1384, height: 1200, deviceScaleFactor: 2 })
  await page.goto(pathToFileURL(html).href, { waitUntil: 'networkidle0' })
  await page.evaluate(() => document.fonts && document.fonts.ready)
  const el = await page.$('.wrap')
  if (!el) throw new Error('No se encontró el contenedor .wrap en el HTML')
  await el.screenshot({ path: out })
  console.log('OK ->', out)
} finally {
  await browser.close()
}
