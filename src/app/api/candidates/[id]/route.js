import { query } from '@/lib/db';
import { json, requireApproved } from '@/lib/api-helpers';
import { CANDIDATE_COLUMNS } from '@/lib/candidates';

export const dynamic = 'force-dynamic';

// PATCH /api/candidates/:id -> atualização parcial. updated_at é setado sempre.
export async function PATCH(req, ctx) {
  const g = await requireApproved();
  if (g.error) return g.error;
  const { id } = await ctx.params;
  const body = await req.json();
  const cols = CANDIDATE_COLUMNS.filter((c) => c in body);
  if (cols.length === 0) return json({ error: 'no_fields' }, 400);
  const set = cols.map((c, i) => `"${c}" = $${i + 1}`);
  const values = cols.map((c) => body[c]);
  set.push(`updated_at = now()`);
  values.push(id);
  const { rows } = await query(
    `UPDATE candidates SET ${set.join(', ')} WHERE id = $${values.length} RETURNING *`,
    values
  );
  return json(rows[0] || null);
}
