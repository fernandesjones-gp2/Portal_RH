import { query } from '@/lib/db';
import { json, requireApproved } from '@/lib/api-helpers';

// ATENÇÃO: O cliente da sua aplicação usa PATCH para atualizar
export async function PATCH(req, props) {
  const g = await requireApproved();
  if (g.error) return g.error;

  // CORREÇÃO DO NEXT 15+: Await nos parâmetros tira o erro 404
  const params = await props.params;
  const { id } = params;

  const body = await req.json();

  const allowedFields = [
    'process_type', 'name', 'mother_name', 'phone', 'cpf', 'rg', 
    'job_role_id', 'unit_id', 'interview_date', 'responsible_id', 
    'status', 'analysis_status', 'medical_status', 'docs_status', 
    'feedback', 'cancellation_reason_id', 'admission_date',
    'medical_request_date', 'medical_result_date', 
    'docs_request_date', 'docs_receive_date', 'analysis_request_date', 
    'analysis_update_date', 'gender', 'is_pcd'
  ];

  const updates = [];
  const values = [];
  let i = 1;

  for (const key of Object.keys(body)) {
    if (allowedFields.includes(key) && body[key] !== undefined) {
      updates.push(`"${key}" = $${i}`);
      values.push(body[key]);
      i++;
    }
  }

  if (updates.length === 0) return json({ error: 'no_fields' }, 400);

  values.push(id);
  
  try {
    const sql = `UPDATE candidates SET ${updates.join(', ')} WHERE id = $${i} RETURNING *`;
    const { rows } = await query(sql, values);
    
    if (rows.length === 0) return json({ error: 'not_found' }, 404);
    return json(rows[0]);
  } catch (err) {
    console.error("Erro PATCH Candidates", err);
    return json({ error: err.message }, 500);
  }
}

// Alias de Segurança: Caso você mande PUT algum dia, ele redireciona pro PATCH
export const PUT = PATCH;

export async function DELETE(req, props) {
  const g = await requireApproved();
  if (g.error) return g.error;

  const params = await props.params;
  const { id } = params;

  try {
    await query('DELETE FROM candidates WHERE id = $1', [id]);
    return json({ success: true });
  } catch (err) {
    console.error("Erro DELETE", err);
    return json({ error: err.message }, 500);
  }
}
