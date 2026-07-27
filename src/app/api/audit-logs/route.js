import db from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const result = await db.query('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 500');
    const logs = result.rows ? result.rows : result;
    return NextResponse.json(logs);
  } catch (error) {
    console.error('Erro ao buscar logs:', error);
    return NextResponse.json({ error: 'Erro ao carregar auditoria' }, { status: 500 });
  }
}