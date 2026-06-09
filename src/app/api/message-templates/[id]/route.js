import { query } from '@/lib/db';
import { json, requireApproved } from '@/lib/api-helpers';

export async function PATCH(req, props) {
  const g = await requireApproved();
  if (g.error) return g.error;

  const params = await props.params;
  const { id } = params;
  const body = await req.json();

  if (!body.content) return json({ error: 'Conteúdo vazio' }, 400);

  try {
    const sql = `UPDATE message_templates SET content = $1 WHERE id = $2 RETURNING *`;
    const { rows } = await query(sql, [body.content, id]);
    
    if (rows.length === 0) return json({ error: 'not_found' }, 404);
    return json(rows[0]);
  } catch (err) {
    console.error("Erro PATCH message_templates", err);
    return json({ error: err.message }, 500);
  }
}
