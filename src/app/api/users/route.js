import { query } from '@/lib/db';
import { json, requireApproved } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

// Lista usuários com a unidade aninhada (units: { name }) — formato igual ao
// que o app esperava do Supabase (select('*, units(name)')).
export async function GET() {
  const g = await requireApproved();
  if (g.error) return g.error;
  const { rows } = await query(`
    SELECT u.*,
      CASE WHEN un.id IS NULL THEN NULL ELSE json_build_object('name', un.name) END AS units
    FROM users u
    LEFT JOIN units un ON u.unit_id = un.id
    ORDER BY u.name
  `);
  return json(rows);
}
