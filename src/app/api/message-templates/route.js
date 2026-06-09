import { query } from '@/lib/db';
import { json, requireApproved } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  const g = await requireApproved();
  if (g.error) return g.error;

  try {
    const { rows } = await query('SELECT * FROM message_templates ORDER BY id ASC');
    return json(rows);
  } catch (err) {
    console.error("Erro GET message_templates", err);
    return json({ error: err.message }, 500);
  }
}
