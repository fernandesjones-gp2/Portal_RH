import { query } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function PUT(req, { params }) {
  try {
    const { id } = params;
    const body = await req.json();

    // LISTA DE CAMPOS AUTORIZADOS (Porteiro da API) - Adicionado gender e is_pcd
    const allowedFields = [
      'process_type', 'name', 'mother_name', 'phone', 'cpf', 'rg', 
      'job_role_id', 'unit_id', 'interview_date', 'responsible_id', 
      'status', 'analysis_status', 'medical_status', 'docs_status', 
      'feedback', 'cancellation_reason_id', 'admission_date',
      'medical_request_date', 'medical_result_date', 
      'docs_request_date', 'docs_receive_date', 'analysis_request_date', 
      'analysis_update_date', 'gender', 'is_pcd'
    ];

    const updates = [];
    const values = [];
    let i = 1;

    for (const key of Object.keys(body)) {
      if (allowedFields.includes(key)) {
        updates.push(`${key} = $${i}`);
        values.push(body[key]);
        i++;
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'Nenhum dado válido para atualizar' }, { status: 400 });
    }

    values.push(id);
    const sql = `UPDATE candidates SET ${updates.join(', ')} WHERE id = $${i} RETURNING *`;
    
    const result = await query(sql, values);
    
    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Candidato não encontrado' }, { status: 404 });
    }

    return NextResponse.json({ data: result.rows[0] }, { status: 200 });

  } catch (error) {
    console.error('Erro no PUT /api/candidates/[id]:', error);
    return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const { id } = params;
    await query('DELETE FROM candidates WHERE id = $1', [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 });
  }
}
