/**
 * Genera el PDF de la Política/Autorización de Tratamiento de Datos Personales.
 * Renderiza el HTML legal con Puppeteer (Chrome headless) a A4 y lo guarda en
 * public/legal/ para servirlo como documento público (URL estática de Next).
 *
 * Uso:  node scripts/generar_politica_pdf.mjs
 */
import puppeteer from 'puppeteer'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { mkdirSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const webRoot   = resolve(__dirname, '..')                       // apps/web
const htmlPath  = resolve(__dirname, 'legal', 'politica-tratamiento-datos.html')
const outDir    = resolve(webRoot, 'public', 'legal')
const outputPath = resolve(outDir, 'politica-tratamiento-datos-personales.pdf')

mkdirSync(outDir, { recursive: true })

console.log('🚀 Generando PDF de política de tratamiento de datos...')
console.log('📄 Fuente:', htmlPath)
console.log('📁 Destino:', outputPath)

// Intenta usar el Chrome instalado del sistema; si no, el Chromium de puppeteer.
async function lanzar() {
  const base = { headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] }
  try {
    return await puppeteer.launch({ ...base, channel: 'chrome' })
  } catch {
    return await puppeteer.launch(base)
  }
}

const browser = await lanzar()
const page = await browser.newPage()
await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle0', timeout: 30000 })
await new Promise(r => setTimeout(r, 600))

await page.pdf({
  path: outputPath,
  format: 'A4',
  printBackground: true,
  displayHeaderFooter: false,
  margin: { top: '0', right: '0', bottom: '0', left: '0' }, // los márgenes van en @page del HTML
})

await browser.close()
console.log('✅ PDF generado:', outputPath)
