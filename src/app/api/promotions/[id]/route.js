import { query } from '@/lib/db';
import { json, requireApproved } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

export async function PUT(req, ctx) {
  const g = await requireApproved();
  if (g.error) return g.error;
  
  const params = await ctx.params;
  const body = await req.json();
  const allowedFields = ['status', 'feedback', 'leadership_approver_id', 'leadership_signature_date', 'gp2_approver_id', 'gp2_signature_date', 'dp_approver_id', 'dp_signature_date'];
  
  const fields = allowedFields.filter((k) => k in body);
  const set = fields.map((f, i) => `"${f}" = $${i + 1}`).join(', ');
  const values = fields.map((f) => body[f]);
  values.push(params.id);
  
  try {
    const { rows } = await query(`UPDATE promotions SET ${set} WHERE id = $${values.length} RETURNING *`, values);
    return json(rows[0] || null);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
