import { query } from '@/lib/db';
import { json, requireApproved } from '@/lib/api-helpers';

export async function PATCH(req, props) {
  const g = await requireApproved(); if(g.error) return g.error;
  const params = await props.params;
  const body = await req.json();
  try {
    const { rows } = await query('UPDATE custom_roles SET name = $1, permissions = $2 WHERE id = $3 RETURNING *', [body.name, body.permissions, params.id]);
    if (rows.length === 0) return json({ error: 'not_found' }, 404);
    return json(rows[0]);
  } catch (err) { return json({ error: err.message }, 500); }
}

export async function DELETE(req, props) {
  const g = await requireApproved(); if(g.error) return g.error;
  const params = await props.params;
  try {
    await query('DELETE FROM custom_roles WHERE id = $1', [params.id]);
    return json({ success: true });
  } catch (err) { return json({ error: err.message }, 500); }
}
