import { json, requireAuth } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

// Usuário logado (qualquer status). O layout usa isto para detectar 'Pendente'
// e exibir a tela de bloqueio, além de aplicar permissões por role.
export async function GET() {
  const g = await requireAuth();
  if (g.error) return g.error;
  return json(g.user);
}
