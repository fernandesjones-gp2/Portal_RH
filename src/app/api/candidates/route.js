import { query } from '@/lib/db';
import { json, requireApproved } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

const CANDIDATE_SELECT = `
  SELECT c.*,
         u.name as unit_name,
         r.name as job_role_name,
         usr.name as responsible_name,
         cr.name as cancellation_reason_name
  FROM candidates c
  LEFT JOIN units u ON c.unit_id = u.id
  LEFT JOIN job_roles r ON c.job_role_id = r.id
  LEFT JOIN users usr ON c.responsible_id = usr.id
  LEFT JOIN cancellation_reasons cr ON c.cancellation_reason_id = cr.id
`;

export async function GET(req) {
  const g = await requireApproved();
  if (g.error) return g.error;

  const sp = new URL(req.url).searchParams;
  const status = sp.get('status');
  const statusIn = sp.get('statusIn');
  const orderBy = sp.get('orderBy') || 'created_at';
  const order = (sp.get('order') || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  let where = '';
  const params = [];
  
  // RESTAURAÇÃO DOS FILTROS (Conserta a tela de Concluídos)
  if (statusIn) {
    params.push(statusIn.split(',').map((s) => s.trim()));
    where = `WHERE c.status = ANY($1)`;
  } else if (status) {
    params.push(status);
    where = `WHERE c.status = $1`;
  }

  try {
    const { rows } = await query(`${CANDIDATE_SELECT} ${where} ORDER BY c."${orderBy}" ${order} NULLS LAST`, params);
    return json(rows);
  } catch (err) {
    console.error("Erro GET Candidates", err);
    return json({ error: err.message }, 500);
  }
}

export async function POST(req) {
  const g = await requireApproved();
  if (g.error) return g.error;
  
  const body = await req.json();
  
  // COLUNAS PERMITIDAS (Incluindo os novos Gender e PCD)
  const allowedFields = [
    'process_type', 'name', 'mother_name', 'phone', 'cpf', 'rg', 
    'job_role_id', 'unit_id', 'interview_date', 'responsible_id',
    'gender', 'is_pcd', 'status', 'cancellation_reason_id', 'feedback'
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

  if (columns.length === 0) return json({ error: 'no_fields' }, 400);

  try {
    const sql = `INSERT INTO candidates (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`;
    const { rows } = await query(sql, values);
    return json(rows[0], 201);
  } catch (err) {
    console.error("Erro POST Candidates", err);
    return json({ error: err.message }, 500);
  }
}
