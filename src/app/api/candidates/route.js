import { query } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const sql = `
      SELECT 
        c.*, 
        u.name as unit_name, 
        j.name as job_role_name, 
        usr.name as responsible_name
      FROM candidates c
      LEFT JOIN units u ON c.unit_id = u.id
      LEFT JOIN job_roles j ON c.job_role_id = j.id
      LEFT JOIN users usr ON c.responsible_id = usr.id
      ORDER BY c.created_at DESC
    `;
    const result = await query(sql);

    // Mapeamento necessário para manter o formato do Frontend intacto
    const data = result.rows.map(row => ({
      ...row,
      units: { name: row.unit_name },
      job_roles: { name: row.job_role_name },
      users: { name: row.responsible_name }
    }));

    return NextResponse.json({ data }, { status: 200 });
  } catch (error) {
    console.error('Erro GET Candidates:', error);
    return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    
    // LISTA DE CAMPOS AUTORIZADOS - Adicionado gender e is_pcd
    const allowedFields = [
      'process_type', 'name', 'mother_name', 'phone', 'cpf', 'rg', 
      'job_role_id', 'unit_id', 'interview_date', 'responsible_id',
      'gender', 'is_pcd'
    ];

    const columns = [];
    const placeholders = [];
    const values = [];
    let i = 1;

    for (const key of Object.keys(body)) {
      if (allowedFields.includes(key)) {
        columns.push(key);
        placeholders.push(`$${i}`);
        values.push(body[key]);
        i++;
      }
    }

    if (columns.length === 0) {
      return NextResponse.json({ error: 'Sem dados válidos para inserir' }, { status: 400 });
    }

    const sql = `INSERT INTO candidates (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`;
    const result = await query(sql, values);

    return NextResponse.json({ data: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('Erro POST Candidates:', error);
    return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 });
  }
}
