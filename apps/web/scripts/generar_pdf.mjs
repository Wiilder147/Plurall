/**
 * Generador de PDF — DBA PLURALL Presentación
 * Usa Puppeteer + Chrome headless para renderizar el HTML con fidelidad total
 */

import puppeteer from 'puppeteer';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
// __dirname = apps/web/scripts  →  subir 3 niveles llega a la raíz del repo
const repoRoot   = resolve(__dirname, '..', '..', '..');
const htmlPath   = resolve(repoRoot, 'docs', 'DBA_PLURALL_Presentacion.html');
const outputPath = resolve(repoRoot, 'docs', 'DBA_PLURALL_Presentacion.pdf');

console.log('🚀 Iniciando generación de PDF...');
console.log('📄 Fuente:', htmlPath);
console.log('📁 Destino:', outputPath);

const browser = await puppeteer.launch({
  headless: 'new',
  executablePath: '/usr/bin/google-chrome-stable',
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
  ],
});

const page = await browser.newPage();

// Cargar el HTML local con todos los estilos inline
await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle0', timeout: 30000 });

// Ocultar la barra de navegación flotante antes de imprimir
await page.addStyleTag({
  content: `.no-print { display: none !important; }`,
});

// Esperar a que los estilos y fuentes carguen
await new Promise(r => setTimeout(r, 1200));

// Generar PDF en formato 16:9 (1280x720 → A4 landscape aprox)
await page.pdf({
  path: outputPath,
  width:  '1280px',
  height: '720px',
  printBackground: true,
  margin: { top: '0', right: '0', bottom: '0', left: '0' },
  pageRanges: '',   // todas las páginas
});

await browser.close();

console.log('✅ PDF generado exitosamente:', outputPath);
