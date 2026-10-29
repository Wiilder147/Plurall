import { describe, it, expect } from 'vitest'
import { boxDeudor, firmasDoc } from '../lib/documentosLegal'
import { responderDocumento } from '../lib/pdf'

// H4: el cliente controla su nombre/cédula/correo; esos valores se insertan
// en HTML que abre el staff en el origen de la app → deben escaparse.
const payload = '<img src=x onerror=alert(1)>'
const titular = {
  primer_nombre: `<script>alert(1)</script>`,
  primer_apellido: payload,
  dni: `"><svg onload=alert(1)>`,
  email: `a@b.co<script>x</script>`,
}

describe('documentos legales — escape de datos del titular (H4)', () => {
  for (const [nombre, fn] of [['boxDeudor', boxDeudor], ['firmasDoc', firmasDoc]]) {
    it(`${nombre} no emite etiquetas ni atributos del usuario`, () => {
      const html = fn(titular)
      expect(html).not.toMatch(/<script/i)
      expect(html).not.toMatch(/<img/i)
      expect(html).not.toMatch(/<svg/i)
      expect(html).toContain('&lt;script&gt;')
    })
  }

  it('la respuesta HTML lleva una CSP que impide ejecutar scripts', async () => {
    const res = await responderDocumento(new Request('http://localhost/api/documentos/contrato/x'), '<p>ok</p>', { filename: 'f.pdf', creditoId: 'x' })
    const csp = res.headers.get('content-security-policy') ?? ''
    expect(csp).toMatch(/default-src 'none'/)
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/)
  })
})
