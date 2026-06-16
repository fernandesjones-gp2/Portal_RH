import { query } from '@/lib/db';
import { json, requireApproved } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  const g = await requireApproved(); if(g.error) return g.error;
  try {
    const { rows } = await query('SELECT * FROM custom_roles ORDER BY created_at ASC');
    return json(rows);
  } catch (err) { return json({ error: err.message }, 500); }
}

export async function POST(req) {
  const g = await requireApproved(); if(g.error) return g.error;
  const body = await req.json();
  try {
    const { rows } = await query('INSERT INTO custom_roles (name, permissions) VALUES ($1, $2) RETURNING *', [body.name, body.permissions]);
    return json(rows[0], 201);
  } catch (err) { return json({ error: err.message }, 500); }
}
