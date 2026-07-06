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
             req_usr.name as requester_name,
             lead_usr.name as leadership_approver_name,
             gp2_usr.name as gp2_approver_name,
             dp_usr.name as dp_approver_name
      FROM promotions p
      LEFT JOIN units u_curr ON p.current_unit_id = u_curr.id
      LEFT JOIN units u_prop ON p.proposed_unit_id = u_prop.id
      LEFT JOIN users req_usr ON p.requester_id = req_usr.id
      LEFT JOIN users lead_usr ON p.leadership_approver_id = lead_usr.id
      LEFT JOIN users gp2_usr ON p.gp2_approver_id = gp2_usr.id
      LEFT JOIN users dp_usr ON p.dp_approver_id = dp_usr.id
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

  if (!body.admission_date) {
    return json({ error: 'A Data de Admissão atual do colaborador é obrigatória e não foi recebida pelo servidor.' }, 400);
  }
  if (!body.promotion_month_year) {
    return json({ error: 'A Data da Promoção (Mês/Ano) é obrigatória.' }, 400);
  }
  
  const allowedFields = [
    'type', 'collaborator_name', 'collaborator_cpf', 'admission_date', 
    'current_role', 'proposed_role', 'current_salary', 'proposed_salary', 
    'current_sector', 'proposed_sector', 'current_unit_id', 'proposed_unit_id', 
    'promotion_month_year', 'requester_id', 'candidate_id', 'status',
    'current_role_id', 'proposed_role_id' // <-- Adicionados aqui    
  ];

  const columns = [];
  const placeholders = [];
  const values = [];
  let i = 1;

  for (const key of allowedFields) {
    if (body[key] !== undefined && body[key] !== null && body[key] !== '') {
      columns.push(`"${key}"`); 
      placeholders.push(`$${i}`);
      values.push(body[key]);
      i++;
    }
  }

  try {
    const queryStr = `INSERT INTO promotions (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`;
    const { rows } = await query(queryStr, values);
    return json(rows[0], 201);
  } catch (err) {
    console.error("Erro no DB:", err);
    return json({ error: err.message }, 500);
  }
}
