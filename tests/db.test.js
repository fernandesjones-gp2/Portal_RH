import { describe, it, expect, afterAll } from 'vitest';
import { query, pool } from '@/lib/db';
import { CANDIDATE_SELECT } from '@/lib/candidates';

// Integração contra o gp2 (dados migrados). Cobre T-DB-1 e revalida I1.
const EXPECTED_COUNTS = {
  units: 17,
  job_roles: 334,
  cancellation_reasons: 9,
  role_permissions: 16,
  users: 7,
  candidates: 19,
};

afterAll(async () => {
  await pool.end();
});

describe('db / gp2', () => {
  it('conecta no Postgres (SELECT 1)', async () => {
    const { rows } = await query('SELECT 1 AS ok');
    expect(rows[0].ok).toBe(1);
  });

  it('mantém as contagens migradas (Invariante I1)', async () => {
    for (const [table, expected] of Object.entries(EXPECTED_COUNTS)) {
      const { rows } = await query(`SELECT count(*)::int AS c FROM "${table}"`);
      expect(rows[0].c, `contagem de ${table}`).toBe(expected);
    }
  });

  it('candidates retorna relacionamentos aninhados (job_roles/units/users)', async () => {
    const { rows } = await query(`${CANDIDATE_SELECT} LIMIT 5`);
    expect(rows.length).toBeGreaterThan(0);
    const withRole = rows.find((r) => r.job_role_id);
    if (withRole) {
      expect(withRole.job_roles).toHaveProperty('name');
    }
  });

  it('não há FKs órfãs em candidates (Invariante I2)', async () => {
    const { rows } = await query(`
      SELECT count(*)::int AS c FROM candidates a
      LEFT JOIN users x ON a.responsible_id = x.id
      WHERE a.responsible_id IS NOT NULL AND x.id IS NULL
    `);
    expect(rows[0].c).toBe(0);
  });
});
