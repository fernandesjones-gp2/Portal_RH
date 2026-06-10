import { query } from '@/lib/db';
import { json, requireApproved } from '@/lib/api-helpers';

export async function PATCH(req, props) {
  const g = await requireApproved();
  if (g.error) return g.error;
  const params = await props.params;
  const body = await req.json();

  const allowedFields = ['title', 'chart_type', 'metric_type', 'status_filter', 'color', 'roles_visible'];
  const updates = []; const values = []; let i = 1;

  for (const key of Object.keys(body)) {
    if (allowedFields.includes(key)) {
      updates.push(`"${key}" = $${i}`);
      values.push(body[key]);
      i++;
    }
  }

  if (updates.length === 0) return json({ error: 'no_fields' }, 400);
  values.push(params.id);
  
  try {
    const sql = `UPDATE dashboard_widgets SET ${updates.join(', ')} WHERE id = $${i} RETURNING *`;
    const { rows } = await query(sql, values);
    if (rows.length === 0) return json({ error: 'not_found' }, 404);
    return json(rows[0]);
  } catch (err) { return json({ error: err.message }, 500); }
}

export async function DELETE(req, props) {
  const g = await requireApproved();
  if (g.error) return g.error;
  const params = await props.params;
  try {
    await query('DELETE FROM dashboard_widgets WHERE id = $1', [params.id]);
    return json({ success: true });
  } catch (err) { return json({ error: err.message }, 500); }
}
