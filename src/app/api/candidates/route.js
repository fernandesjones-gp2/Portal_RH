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

  let whereClauses = [];
  const params = [];
  let paramCounter = 1;

  // FILTRO DE STATUS (Aba do sistema)
  if (statusIn) {
    params.push(statusIn.split(',').map((s) => s.trim()));
    whereClauses.push(`c.status = ANY($${paramCounter})`);
    paramCounter++;
  } else if (status) {
    params.push(status);
    whereClauses.push(`c.status = $${paramCounter}`);
    paramCounter++;
  }

  // --- 🛡️ BLINDAGEM DE ACESSO (MÚLTIPLAS UNIDADES) 🛡️ ---
  let userUnits = [];
  try {
    if (Array.isArray(g.user.unit_ids)) userUnits = g.user.unit_ids;
    else if (typeof g.user.unit_ids === 'string') userUnits = JSON.parse(g.user.unit_ids);
  } catch(e) {}
  
  // Resgate do sistema legado (caso o array esteja vazio mas o unit_id antigo exista)
  if (userUnits.length === 0 && g.user.unit_id) {
    userUnits = [g.user.unit_id];
  }

  // Se o array de unidades não estiver vazio, significa que ele tem restrição.
  // Se estiver vazio (length === 0), significa "Acesso Geral" (vê tudo).
  if (userUnits.length > 0) {
    params.push(userUnits);
    // O cast ::uuid[] garante que o banco reconheça a lista de forma nativa e super veloz
    whereClauses.push(`c.unit_id = ANY($${paramCounter}::uuid[])`);
    paramCounter++;
  }
  // ---------------------------------------------------------

  const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  try {
    const { rows } = await query(`${CANDIDATE_SELECT} ${whereString} ORDER BY c."${orderBy}" ${order} NULLS LAST`, params);
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
  
  // COLUNAS PERMITIDAS
  const allowedFields = [
    'process_type', 'name', 'mother_name', 'phone', 'cpf', 'rg', 
    'job_role_id', 'unit_id', 'interview_date', 'responsible_id',
    'gender', 'is_pcd', 'status', 'cancellation_reason_id', 'feedback',
    'expected_admission_date'
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
