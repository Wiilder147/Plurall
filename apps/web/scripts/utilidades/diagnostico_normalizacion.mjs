// ============================================================
// PLURALL — FASE 0: Diagnóstico en vivo de normalización
// READ-ONLY. Usa SERVICE_ROLE (bypassa RLS) solo para leer.
// NO ejecuta writes ni DDL.
// Uso:  node apps/web/scripts/utilidades/diagnostico_normalizacion.mjs
// ============================================================
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '../../.env.local');

// -- Parseo simple de .env.local (sin dependencias) --
function parseEnv(path) {
  const out = {};
  for (const raw of readFileSync(path, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const k = line.slice(0, eq).trim();
    let v = line.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

const env = parseEnv(envPath);
const url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey =
  Object.entries(env).find(([k]) => k.includes('SERVICE_ROLE'))?.[1];

if (!url || !serviceKey) {
  console.error('❌ Falta SUPABASE_URL o SERVICE_ROLE_KEY en .env.local');
  process.exit(1);
}

const db = createClient(url, serviceKey, { auth: { persistSession: false } });

const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v));
const norm = (v) => (v === null || v === undefined ? '' : String(v).trim().toLowerCase());

async function fetchAll(table, columns = '*') {
  const rows = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await db
      .from(table)
      .select(columns)
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < pageSize) break;
  }
  return rows;
}

function tally(rows, keyFn) {
  const m = new Map();
  for (const r of rows) {
    const k = keyFn(r);
    m.set(k, (m.get(k) || 0) + 1);
  }
  return m;
}

(async () => {
  console.log('============================================================');
  console.log('PLURALL — FASE 0: Diagnóstico de normalización (READ-ONLY)');
  console.log('URL:', url);
  console.log('Fecha:', new Date().toISOString());
  console.log('============================================================\n');

  // 1) Introspección de columnas reales
  const cliente = await fetchAll('cliente');
  const detalle = await fetchAll('detalle_cliente');
  const colsCliente = cliente[0] ? Object.keys(cliente[0]) : [];
  const colsDetalle = detalle[0] ? Object.keys(detalle[0]) : [];

  console.log('## 1. COLUMNAS REALES');
  console.log(`cliente (${cliente.length} filas) → ${colsCliente.length} columnas:`);
  console.log('  ' + colsCliente.join(', '));
  console.log(`detalle_cliente (${detalle.length} filas) → ${colsDetalle.length} columnas:`);
  console.log('  ' + colsDetalle.join(', ') + '\n');

  const has = (cols, c) => cols.includes(c);
  const detalleByCliente = new Map(detalle.map((d) => [d.id_cliente, d]));

  // 2) Ubicación duplicada dentro de cliente
  console.log('## 2. UBICACIÓN DUPLICADA EN cliente (direccion vs direccion_casa)');
  if (has(colsCliente, 'direccion') && has(colsCliente, 'direccion_casa')) {
    let ambos = 0, difieren = 0, soloBase = 0, soloCasa = 0, ninguno = 0;
    for (const c of cliente) {
      const a = norm(c.direccion), b = norm(c.direccion_casa);
      if (a && b) { ambos++; if (a !== b) difieren++; }
      else if (a && !b) soloBase++;
      else if (!a && b) soloCasa++;
      else ninguno++;
    }
    console.log(`  con ambas llenas: ${ambos} (de esas DIFIEREN: ${difieren})`);
    console.log(`  solo 'direccion': ${soloBase} | solo 'direccion_casa': ${soloCasa} | ninguna: ${ninguno}`);
  } else {
    console.log('  (no aplica: falta una de las columnas — puede que ya no exista en vivo)');
  }
  console.log();

  // 3) Duplicación cliente <-> detalle_cliente
  console.log('## 3. DUPLICACIÓN cliente <-> detalle_cliente');
  const pares = [
    ['dependientes', 'personas_cargo'],
    ['ahorros', 'patrimonio_estimado'],
    ['arriendo_casa', 'egresos_mensuales'],
  ];
  for (const [cCol, dCol] of pares) {
    if (!has(colsCliente, cCol) || !has(colsDetalle, dCol)) {
      console.log(`  ${cCol} ↔ ${dCol}: (no aplica, falta columna)`);
      continue;
    }
    let comparables = 0, difieren = 0;
    for (const c of cliente) {
      const d = detalleByCliente.get(c.id_cliente);
      if (!d) continue;
      const x = num(c[cCol]), y = num(d[dCol]);
      if (x !== null && y !== null) { comparables++; if (x !== y) difieren++; }
    }
    console.log(`  ${cCol} ↔ ${dCol}: comparables=${comparables}, DIFIEREN=${difieren}`);
  }
  console.log();

  // 4) Catálogos vs texto libre
  console.log('## 4. TEXTO LIBRE vs CATÁLOGOS');
  if (has(colsDetalle, 'banco_preferido')) {
    const t = tally(detalle.filter((d) => norm(d.banco_preferido)), (d) => norm(d.banco_preferido));
    console.log(`  banco_preferido distintos (${t.size}):`, [...t.entries()].map(([k, v]) => `${k}(${v})`).join(', ') || '—');
  }
  if (has(colsCliente, 'ciudad')) {
    const t = tally(cliente.filter((c) => norm(c.ciudad)), (c) => norm(c.ciudad));
    console.log(`  cliente.ciudad distintos: ${t.size}`);
  }
  if (has(colsCliente, 'departamento')) {
    const t = tally(cliente.filter((c) => norm(c.departamento)), (c) => norm(c.departamento));
    console.log(`  cliente.departamento distintos: ${t.size}`);
  }
  console.log();

  // 5) score_credito cacheado vs histórico score
  console.log('## 5. score_credito cacheado');
  if (has(colsCliente, 'score_credito')) {
    const conScore = cliente.filter((c) => num(c.score_credito) && num(c.score_credito) > 0).length;
    console.log(`  clientes con score_credito > 0: ${conScore} / ${cliente.length}`);
  }
  console.log();

  // 6) Datos de negocio embebidos en cliente
  console.log('## 6. DATOS DE NEGOCIO EN cliente (a extraer a negocio_cliente)');
  const negocioCols = ['nombre_negocio', 'id_tipo_negocio', 'descripcion_negocio', 'antiguedad_negocio_meses', 'empleados_negocio', 'arriendo_negocio', 'direccion_negocio'];
  for (const col of negocioCols) {
    if (!has(colsCliente, col)) continue;
    const llenos = cliente.filter((c) => norm(c[col])).length;
    console.log(`  ${col}: ${llenos} llenos`);
  }
  console.log();

  // 7) Clientes sin detalle_cliente (huérfanos de perfil financiero)
  console.log('## 7. INTEGRIDAD');
  const sinDetalle = cliente.filter((c) => !detalleByCliente.has(c.id_cliente)).length;
  console.log(`  clientes SIN detalle_cliente: ${sinDetalle} / ${cliente.length}`);
  const detalleHuerfano = detalle.filter((d) => !cliente.find((c) => c.id_cliente === d.id_cliente)).length;
  console.log(`  detalle_cliente huérfanos (sin cliente): ${detalleHuerfano}`);

  console.log('\n============================================================');
  console.log('FIN DIAGNÓSTICO — read-only, no se modificó nada.');
  console.log('============================================================');
})().catch((e) => {
  console.error('❌ Error:', e.message);
  process.exit(1);
});
