import { query } from '@/lib/db';
import { json, requireApproved } from '@/lib/api-helpers';
import { CANDIDATE_COLUMNS, CANDIDATE_ORDER_COLUMNS, CANDIDATE_SELECT } from '@/lib/candidates';

export const dynamic = 'force-dynamic';

// GET /api/candidates?status=Concluído
// GET /api/candidates?statusIn=Agendado,Banco de Talentos,Reprovado
// &orderBy=created_at&order=desc
export async function GET(req) {
  const g = await requireApproved();
  if (g.error) return g.error;

  const sp = new URL(req.url).searchParams;
  const status = sp.get('status');
  const statusIn = sp.get('statusIn');
  const orderBy = CANDIDATE_ORDER_COLUMNS.includes(sp.get('orderBy')) ? sp.get('orderBy') : 'created_at';
  const order = (sp.get('order') || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  let where = '';
  const params = [];
  if (statusIn) {
    params.push(statusIn.split(',').map((s) => s.trim()));
    where = `WHERE c.status = ANY($1)`;
  } else if (status) {
    params.push(status);
    where = `WHERE c.status = $1`;
  }

  const { rows } = await query(`${CANDIDATE_SELECT} ${where} ORDER BY c."${orderBy}" ${order} NULLS LAST`, params);
  return json(rows);
}

// POST /api/candidates -> cria candidato
export async function POST(req) {
  const g = await requireApproved();
  if (g.error) return g.error;
  const body = await req.json();
  const cols = CANDIDATE_COLUMNS.filter((c) => c in body && body[c] !== undefined);
  if (cols.length === 0) return json({ error: 'no_fields' }, 400);
  const colList = cols.map((c) => `"${c}"`).join(', ');
  const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
  const values = cols.map((c) => body[c]);
  const { rows } = await query(
    `INSERT INTO candidates (${colList}) VALUES (${placeholders}) RETURNING *`,
    values
  );
  return json(rows[0], 201);
}
