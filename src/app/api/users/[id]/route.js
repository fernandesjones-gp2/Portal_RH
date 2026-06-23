import { query } from '@/lib/db';
import { json, requireAdmin } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

// Lista de campos permitidos (agora aceitando as datas de férias)
const allowedFields = ['name', 'email', 'role', 'unit_id', 'unit_ids', 'status', 'avatar', 'vacation_start', 'vacation_end'];

export async function PUT(req, ctx) {
  const g = await requireAdmin();
  if (g.error) return g.error;
  
  const params = await ctx.params;
  const id = params.id;
  const body = await req.json();
  
  const fields = allowedFields.filter((k) => k in body);
  if (fields.length === 0) return json({ error: 'no_fields' }, 400);
  
  const set = fields.map((f, i) => `"${f}" = $${i + 1}`).join(', ');
  
  // Converte o Array de Unidades para String (Exigência do Postgres para JSONB)
  const values = fields.map((f) => {
    if (f === 'unit_ids' && Array.isArray(body[f])) {
      return JSON.stringify(body[f]);
    }
    return body[f];
  });
  values.push(id);
  
  try {
    const { rows } = await query(
      `UPDATE users SET ${set} WHERE id = $${values.length} RETURNING *`,  
      values
    );
    return json(rows[0] || null);
  } catch (err) {
    console.error("Erro Update User:", err);
    return json({ error: err.message }, 500);
  }
}

// Aceita o comando PATCH redirecionando para o PUT
export const PATCH = PUT;

export async function DELETE(req, ctx) {
  const g = await requireAdmin();
  if (g.error) return g.error;
  
  const params = await ctx.params;
  try {
    await query('DELETE FROM users WHERE id = $1', [params.id]);
    return json({ ok: true });
  } catch (err) {
    console.error("Erro Delete User:", err);
    return json({ error: err.message }, 500);
  }
}
