import { Pool } from 'pg';

// Pool singleton (evita criar múltiplos pools no hot-reload do dev).
function createPool() {
  return new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });
}

const globalForPg = globalThis;
const pool = globalForPg.__pgPool ?? createPool();
if (!globalForPg.__pgPool) globalForPg.__pgPool = pool;

export function query(text, params) {
  return pool.query(text, params);
}

export { pool };
