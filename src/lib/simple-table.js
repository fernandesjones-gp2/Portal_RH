import { query } from '@/lib/db';
import { json, requireApproved, requireAdmin } from '@/lib/api-helpers';

// Factory para tabelas de cadastro simples no formato (id, name, ...).
// Leitura: qualquer usuário aprovado. Escrita: somente ADMIN.
const TABLES = { units: 'units', 'job_roles': 'job_roles', 'cancellation_reasons': 'cancellation_reasons' };

function assertTable(table) {
  if (!TABLES[table]) throw new Error(`Tabela não permitida: ${table}`);
  return TABLES[table];
}

export function nameTableHandlers(tableName) {
  const table = assertTable(tableName);
  return {
    async GET() {
      const g = await requireApproved();
      if (g.error) return g.error;
      const { rows } = await query(`SELECT * FROM "${table}" ORDER BY name`);
      return json(rows);
    },
    async POST(req) {
      const g = await requireAdmin();
      if (g.error) return g.error;
      const body = await req.json();
      if (!body?.name) return json({ error: 'name_required' }, 400);
      const { rows } = await query(`INSERT INTO "${table}" (name) VALUES ($1) RETURNING *`, [body.name]);
      return json(rows[0], 201);
    },
  };
}

export function nameTableIdHandlers(tableName) {
  const table = assertTable(tableName);
  return {
    async PATCH(req, ctx) {
      const g = await requireAdmin();
      if (g.error) return g.error;
      const { id } = await ctx.params;
      const body = await req.json();
      const { rows } = await query(`UPDATE "${table}" SET name = $1 WHERE id = $2 RETURNING *`, [body.name, id]);
      return json(rows[0] || null);
    },
    async DELETE(req, ctx) {
      const g = await requireAdmin();
      if (g.error) return g.error;
      const { id } = await ctx.params;
      await query(`DELETE FROM "${table}" WHERE id = $1`, [id]);
      return json({ ok: true });
    },
  };
}
