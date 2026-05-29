import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await query('SELECT 1');
    return Response.json({ status: 'ok', db: 'ok' });
  } catch (e) {
    return Response.json({ status: 'error', db: 'fail', error: e.message }, { status: 503 });
  }
}
