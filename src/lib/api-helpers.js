import { auth } from '@/auth';
import { query } from '@/lib/db';

export function json(data, status = 200) {
  return Response.json(data, { status });
}

// Usuário logado resolvido no Postgres (qualquer status). null se sem sessão.
export async function getSessionUser() {
  const session = await auth();
  if (!session?.user?.email) return null;
  const { rows } = await query(
    'SELECT id, email, name, role, status, unit_id FROM users WHERE lower(email) = $1',
    [session.user.email.toLowerCase()]
  );
  return rows[0] || null;
}

// Apenas autenticado (qualquer status). Para /api/users/me.
export async function requireAuth() {
  const user = await getSessionUser();
  if (!user) return { error: json({ error: 'unauthorized' }, 401) };
  return { user };
}

// Autenticado E aprovado. Para a maioria das rotas de dados.
export async function requireApproved() {
  const r = await requireAuth();
  if (r.error) return r;
  if (r.user.status !== 'Aprovado') {
    return { error: json({ error: 'forbidden', reason: 'not_approved' }, 403) };
  }
  return r;
}

// Aprovado E ADMIN. Para gestão (usuários, unidades, cargos, permissões).
export async function requireAdmin() {
  const r = await requireApproved();
  if (r.error) return r;
  if (r.user.role !== 'ADMIN') {
    return { error: json({ error: 'forbidden', reason: 'not_admin' }, 403) };
  }
  return r;
}
