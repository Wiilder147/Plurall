// BD en memoria con la API encadenable mínima de supabase-js que usan los
// route handlers. Aplica los filtros (eq/neq/in) también en update, para que
// las transiciones condicionales (idempotencia) se comporten como en Postgres.
export function crearFakeDb(tablas = {}) {
  const db = { tablas, uniques: { pago: ['referencia_externa'] } }

  db.from = (nombre) => {
    if (!db.tablas[nombre]) db.tablas[nombre] = []
    const filas = db.tablas[nombre]
    const filtros = []
    let op = 'select'
    let valores = null
    let devolverFilas = false

    const coincide = (f) => filtros.every(([tipo, col, v]) => {
      if (tipo === 'eq')  return f[col] === v
      if (tipo === 'neq') return f[col] !== v
      if (tipo === 'in')  return v.includes(f[col])
      if (tipo === 'ilike') {
        // Solo se usa con prefijos de UUID: se conservan [\w-] y % → .*
        const re = new RegExp('^' + v.split('%').map(t => t.replace(/[^\w-]/g, '')).join('.*') + '$', 'i')
        return re.test(String(f[col] ?? ''))
      }
      return true
    })

    const ejecutar = () => {
      if (op === 'insert') {
        for (const col of db.uniques[nombre] ?? []) {
          if (valores[col] != null && filas.some(f => f[col] === valores[col])) {
            return { data: null, error: { code: '23505', message: 'duplicate key' } }
          }
        }
        const fila = { ...valores }
        filas.push(fila)
        return { data: devolverFilas ? [fila] : null, error: null }
      }
      const sel = filas.filter(coincide)
      if (op === 'update') {
        sel.forEach(f => Object.assign(f, valores))
        return { data: devolverFilas ? sel.map(f => ({ ...f })) : null, error: null }
      }
      return { data: sel.map(f => ({ ...f })), error: null }
    }

    const q = {
      select: () => { if (op !== 'select') devolverFilas = true; return q },
      eq:  (c, v) => { filtros.push(['eq', c, v]); return q },
      neq: (c, v) => { filtros.push(['neq', c, v]); return q },
      in:  (c, v) => { filtros.push(['in', c, v]); return q },
      ilike: (c, patron) => { filtros.push(['ilike', c, patron]); return q },
      order: () => q,
      limit: () => q,
      update: (v) => { op = 'update'; valores = v; return q },
      insert: (v) => { op = 'insert'; valores = v; return q },
      maybeSingle: async () => { const r = ejecutar(); return { data: r.data?.[0] ?? null, error: r.error } },
      single: async () => { const r = ejecutar(); return { data: r.data?.[0] ?? null, error: r.error } },
      then: (res, rej) => Promise.resolve(ejecutar()).then(res, rej),
    }
    return q
  }
  return db
}
