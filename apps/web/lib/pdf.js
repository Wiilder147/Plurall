/**
 * Generación PDF con Puppeteer (disponible en dev/build Node).
 * En serverless sin Chromium, retorna null y el caller usa HTML.
 */

export async function htmlToPdfBuffer(html) {
  try {
    const puppeteer = await import('puppeteer')
    const browser = await puppeteer.default.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    })
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0' })
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '16mm', bottom: '16mm', left: '14mm', right: '14mm' },
    })
    await browser.close()
    return Buffer.from(pdf)
  } catch (err) {
    console.warn('[PDF] Puppeteer no disponible, fallback HTML:', err.message)
    return null
  }
}

export async function responderDocumento(request, html, { filename, creditoId }) {
  const url = new URL(request.url)
  const format = url.searchParams.get('format')

  if (format === 'pdf') {
    const pdf = await htmlToPdfBuffer(html)
    if (pdf) {
      return new Response(pdf, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="${filename || `plurall-${creditoId?.slice(0, 8)}.pdf`}"`,
        },
      })
    }
  }

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // H4: el HTML se sirve en el origen de la app; sin scripts permitidos.
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; img-src https: data:; base-uri 'none'; form-action 'none'",
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': format === 'download' ? `attachment; filename="${filename?.replace('.pdf', '.html')}"` : 'inline',
    },
  })
}
