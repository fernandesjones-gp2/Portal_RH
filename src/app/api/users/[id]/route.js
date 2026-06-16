import { query } from '@/lib/db';
import { json, requireAdmin } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

// ADICIONADO unit_ids PARA PERMITIR MÚLTIPLAS UNIDADES
  const allowedFields = ['name', 'email', 'role', 'unit_id', 'unit_ids', 'status', 'avatar'];

// Atualiza role/unidade/status/nome de um usuário (ADMIN).
export async function PATCH(req, ctx) {
  const g = await requireAdmin();
  if (g.error) return g.error;
  const { id } = await ctx.params;
  const body = await req.json();
  const fields = ALLOWED.filter((k) => k in body);
  if (fields.length === 0) return json({ error: 'no_fields' }, 400);
  const set = fields.map((f, i) => `"${f}" = $${i + 1}`).join(', ');
  const values = fields.map((f) => body[f]);
  values.push(id);
  const { rows } = await query(
    `UPDATE users SET ${set} WHERE id = $${values.length} RETURNING *`,  
    values
  );
  return json(rows[0] || null);
}

// Remove um usuário (ADMIN).
export async function DELETE(req, ctx) {
  const g = await requireAdmin();
  if (g.error) return g.error;
  const { id } = await ctx.params;
  await query('DELETE FROM users WHERE id = $1', [id]);
  return json({ ok: true });
}
