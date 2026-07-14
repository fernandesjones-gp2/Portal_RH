import { query } from '@/lib/db';
import { json, requireAdmin } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  const g = await requireAdmin();
  if (g.error) return g.error;

  const sp = new URL(req.url).searchParams;
  const search   = (sp.get('search')   || '').trim();
  const dateFrom = (sp.get('dateFrom') || '').trim();
  const dateTo   = (sp.get('dateTo')   || '').trim();

  const params = [];
  const where  = [];
  let i = 1;

  if (search) {
    params.push(`%${search.toLowerCase()}%`);
    where.push(`(lower(dc.name) LIKE $${i} OR dc.cpf LIKE $${i})`);
    i++;
  }
  if (dateFrom) {
    params.push(dateFrom);
    where.push(`dc.deleted_at >= $${i}::date`);
    i++;
  }
  if (dateTo) {
    params.push(dateTo);
    where.push(`dc.deleted_at < ($${i}::date + interval '1 day')`);
    i++;
  }

  const whereStr = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  try {
    const { rows } = await query(`
      SELECT
        dc.*,
        u.name   AS unit_name,
        r.name   AS job_role_name,
        usr.name AS responsible_name,
        del.name AS deleted_by_name
      FROM deleted_candidates dc
      LEFT JOIN units     u   ON dc.unit_id       = u.id
      LEFT JOIN job_roles r   ON dc.job_role_id   = r.id
      LEFT JOIN users     usr ON dc.responsible_id = usr.id
      LEFT JOIN users     del ON dc.deleted_by_id  = del.id
      ${whereStr}
      ORDER BY dc.deleted_at DESC
    `, params);
    return json(rows);
  } catch (err) {
    console.error('Erro GET /api/candidates/archived:', err);
    return json({ error: err.message }, 500);
  }
}
