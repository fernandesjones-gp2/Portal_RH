import { query } from '@/lib/db';
import { json, requireApproved } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  const g = await requireApproved();
  if (g.error) return g.error;
  try {
    const { rows } = await query('SELECT * FROM dashboard_widgets ORDER BY created_at ASC');
    return json(rows);
  } catch (err) { return json({ error: err.message }, 500); }
}

export async function POST(req) {
  const g = await requireApproved();
  if (g.error) return g.error;
  const body = await req.json();
  
  // ADICIONADO O CAMPO advanced_config
  const allowedFields = ['title', 'chart_type', 'metric_type', 'status_filter', 'color', 'roles_visible', 'advanced_config'];
  const columns = []; const placeholders = []; const values = []; let i = 1;

  for (const key of Object.keys(body)) {
    if (allowedFields.includes(key)) {
      columns.push(`"${key}"`);
      placeholders.push(`$${i}`);
      values.push(body[key]);
      i++;
    }
  }

  if (columns.length === 0) return json({ error: 'no_fields' }, 400);

  try {
    const sql = `INSERT INTO dashboard_widgets (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`;
    const { rows } = await query(sql, values);
    return json(rows[0], 201);
  } catch (err) { return json({ error: err.message }, 500); }
}
