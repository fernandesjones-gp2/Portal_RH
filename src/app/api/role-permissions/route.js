import { query } from '@/lib/db';
import { json, requireApproved, requireAdmin } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

// GET /api/role-permissions            -> todas
// GET /api/role-permissions?role=ADMIN -> filtra por role
export async function GET(req) {
  const g = await requireApproved();
  if (g.error) return g.error;
  const role = new URL(req.url).searchParams.get('role');
  const { rows } = role
    ? await query('SELECT * FROM role_permissions WHERE role = $1', [role])
    : await query('SELECT * FROM role_permissions');
  return json(rows);
}

// POST { role, menu_path } -> cria permissão (ADMIN)
export async function POST(req) {
  const g = await requireAdmin();
  if (g.error) return g.error;
  const { role, menu_path } = await req.json();
  if (!role || !menu_path) return json({ error: 'role_and_menu_path_required' }, 400);
  const { rows } = await query(
    'INSERT INTO role_permissions (role, menu_path) VALUES ($1, $2) RETURNING *',
    [role, menu_path]
  );
  return json(rows[0], 201);
}

// DELETE { role, menu_path } -> remove permissão (ADMIN)
export async function DELETE(req) {
  const g = await requireAdmin();
  if (g.error) return g.error;
  const { role, menu_path } = await req.json();
  await query('DELETE FROM role_permissions WHERE role = $1 AND menu_path = $2', [role, menu_path]);
  return json({ ok: true });
}
