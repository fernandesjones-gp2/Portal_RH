import { query } from '@/lib/db';
import { json, requireApproved } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  const g = await requireApproved();
  if (g.error) return g.error;

  try {
    const { rows } = await query(`
      SELECT p.*, 
             u_curr.name as current_unit_name, 
             u_prop.name as proposed_unit_name,
             req_usr.name as requester_name
      FROM promotions p
      LEFT JOIN units u_curr ON p.current_unit_id = u_curr.id
      LEFT JOIN units u_prop ON p.proposed_unit_id = u_prop.id
      LEFT JOIN users req_usr ON p.requester_id = req_usr.id
      ORDER BY p.created_at DESC
    `);
    return json(rows);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

export async function POST(req) {
  const g = await requireApproved();
  if (g.error) return g.error;
  
  const body = await req.json();
  const allowedFields = [
    'type', 'collaborator_name', 'collaborator_cpf', 'admission_date', 
    'current_role', 'proposed_role', 'current_salary', 'proposed_salary', 
    'current_sector', 'proposed_sector', 'current_unit_id', 'proposed_unit_id', 
    'promotion_month_year', 'requester_id', 'candidate_id', 'status'
  ];

  const columns = [];
  const placeholders = [];
  const values = [];
  let i = 1;

  for (const key of Object.keys(body)) {
    if (allowedFields.includes(key) && body[key] !== undefined) {
      columns.push(`"${key}"`);
      placeholders.push(`$${i}`);
      values.push(body[key]);
      i++;
    }
  }

  try {
    const { rows } = await query(`INSERT INTO promotions (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`, values);
    return json(rows[0], 201);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
