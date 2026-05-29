// ============================================================
// Migração de dados: Supabase (API) → Postgres próprio (gp2)
// Spec: docs/specs/01-primeira-mudanca.md
//
// Lê todas as linhas de cada tabela via API REST do Supabase (anon key, sem RLS)
// e insere no gp2 via driver pg, preservando os UUIDs (Invariante I2).
// Ao final, valida contagens (I1) e FKs órfãs (I2).
//
// Uso: node scripts/migrate.mjs
// Requer no .env: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, DATABASE_URL
// ============================================================
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import "dotenv/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const DATABASE_URL = process.env.DATABASE_URL;

if (!SUPABASE_URL || !SUPABASE_KEY || !DATABASE_URL) {
  console.error("Faltam variáveis no .env (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, DATABASE_URL).");
  process.exit(1);
}

const H = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

// Ordem segura de FK (pais antes dos filhos)
const ORDER = [
  "units",
  "job_roles",
  "cancellation_reasons",
  "role_permissions",
  "users",
  "candidates",
  "psychologist_evaluations",
  "promotions",
];

// Lê todas as linhas de uma tabela via API, paginando de 1000 em 1000
async function fetchAll(table) {
  const page = 1000;
  let offset = 0;
  const out = [];
  for (;;) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*&limit=${page}&offset=${offset}`, { headers: H });
    if (!res.ok) throw new Error(`GET ${table} -> ${res.status} ${await res.text()}`);
    const rows = await res.json();
    out.push(...rows);
    if (rows.length < page) break;
    offset += page;
  }
  return out;
}

async function insertRows(client, table, rows) {
  if (rows.length === 0) return 0;
  const cols = Object.keys(rows[0]);
  const colList = cols.map((c) => `"${c}"`).join(", ");
  let n = 0;
  for (const row of rows) {
    const vals = cols.map((c) => row[c]);
    const params = cols.map((_, i) => `$${i + 1}`).join(", ");
    await client.query(`INSERT INTO public."${table}" (${colList}) VALUES (${params})`, vals);
    n++;
  }
  return n;
}

async function main() {
  const client = new pg.Client({ connectionString: DATABASE_URL, connectionTimeoutMillis: 15000 });
  await client.connect();
  console.log("Conectado ao gp2.\n");

  // 1) (Re)cria o schema
  const ddl = fs.readFileSync(path.join(__dirname, "schema_gp2.sql"), "utf8");
  await client.query(ddl);
  console.log("Schema aplicado (schema_gp2.sql).\n");

  // 2) Migra os dados, tabela a tabela
  const sourceCounts = {};
  for (const table of ORDER) {
    const rows = await fetchAll(table);
    sourceCounts[table] = rows.length;
    await client.query("BEGIN");
    try {
      const n = await insertRows(client, table, rows);
      await client.query("COMMIT");
      console.log(`  ${table.padEnd(26)} ${String(n).padStart(4)} linhas migradas`);
    } catch (e) {
      await client.query("ROLLBACK");
      console.error(`  ${table}: ERRO -> ${e.message}`);
      throw e;
    }
  }

  // 3) Validação T-DATA-1: contagens source vs gp2
  console.log("\n=== Validação de contagens (Invariante I1) ===");
  let countsOk = true;
  for (const table of ORDER) {
    const r = await client.query(`SELECT count(*)::int AS c FROM public."${table}"`);
    const dst = r.rows[0].c;
    const src = sourceCounts[table];
    const ok = src === dst;
    if (!ok) countsOk = false;
    console.log(`  ${table.padEnd(26)} supabase=${String(src).padStart(4)}  gp2=${String(dst).padStart(4)}  ${ok ? "OK" : "DIVERGE!"}`);
  }

  // 4) Validação T-DATA-2: FKs órfãs
  console.log("\n=== Validação de FKs órfãs (Invariante I2) ===");
  const orphanChecks = [
    ["users.unit_id", `SELECT count(*)::int c FROM users u LEFT JOIN units x ON u.unit_id=x.id WHERE u.unit_id IS NOT NULL AND x.id IS NULL`],
    ["candidates.responsible_id", `SELECT count(*)::int c FROM candidates a LEFT JOIN users x ON a.responsible_id=x.id WHERE a.responsible_id IS NOT NULL AND x.id IS NULL`],
    ["candidates.job_role_id", `SELECT count(*)::int c FROM candidates a LEFT JOIN job_roles x ON a.job_role_id=x.id WHERE a.job_role_id IS NOT NULL AND x.id IS NULL`],
    ["candidates.unit_id", `SELECT count(*)::int c FROM candidates a LEFT JOIN units x ON a.unit_id=x.id WHERE a.unit_id IS NOT NULL AND x.id IS NULL`],
    ["candidates.cancellation_reason_id", `SELECT count(*)::int c FROM candidates a LEFT JOIN cancellation_reasons x ON a.cancellation_reason_id=x.id WHERE a.cancellation_reason_id IS NOT NULL AND x.id IS NULL`],
  ];
  let fkOk = true;
  for (const [label, sql] of orphanChecks) {
    const r = await client.query(sql);
    const orphans = r.rows[0].c;
    if (orphans > 0) fkOk = false;
    console.log(`  ${label.padEnd(34)} órfãs=${orphans}  ${orphans === 0 ? "OK" : "FALHOU"}`);
  }

  await client.end();

  console.log("\n========================================");
  if (countsOk && fkOk) {
    console.log("✅ MIGRAÇÃO OK — contagens batem e sem FKs órfãs.");
  } else {
    console.log("❌ MIGRAÇÃO COM PROBLEMAS — revisar acima.");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("\nFALHA NA MIGRAÇÃO:", e.message);
  process.exit(1);
});
