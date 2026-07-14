import { pool } from '@/lib/db';
import { json, requireAdmin } from '@/lib/api-helpers';

export async function POST(req, props) {
  const g = await requireAdmin();
  if (g.error) return g.error;

  const { id } = await props.params;
  const body = await req.json();
  const deletion_reason = (body.deletion_reason || '').trim();

  if (deletion_reason.length < 10) {
    return json({ error: 'deletion_reason_too_short', message: 'O motivo deve ter pelo menos 10 caracteres.' }, 400);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query('SELECT * FROM candidates WHERE id = $1', [id]);
    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return json({ error: 'not_found' }, 404);
    }

    if (rows[0].status === 'Concluído') {
      await client.query('ROLLBACK');
      return json({ error: 'cannot_archive_concluded', message: 'Candidatos com status Concluído não podem ser arquivados.' }, 409);
    }

    await client.query(`
      INSERT INTO deleted_candidates (
        id, process_type, name, mother_name, phone, cpf, rg,
        job_role_id, unit_id, interview_date, responsible_id,
        status, analysis_status, analysis_request_date, analysis_update_date,
        medical_status, medical_request_date, medical_result_date,
        docs_status, docs_request_date, docs_receive_date,
        admission_date, feedback, cancellation_reason_id,
        created_at, updated_at,
        deleted_at, deleted_by_id, deletion_reason
      )
      SELECT
        id, process_type, name, mother_name, phone, cpf, rg,
        job_role_id, unit_id, interview_date, responsible_id,
        status, analysis_status, analysis_request_date, analysis_update_date,
        medical_status, medical_request_date, medical_result_date,
        docs_status, docs_request_date, docs_receive_date,
        admission_date, feedback, cancellation_reason_id,
        created_at, updated_at,
        now(), $1, $2
      FROM candidates WHERE id = $3
    `, [g.user.id, deletion_reason, id]);

    await client.query('DELETE FROM candidates WHERE id = $1', [id]);

    await client.query('COMMIT');
    return json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erro ao arquivar candidato:', err);
    return json({ error: err.message }, 500);
  } finally {
    client.release();
  }
}
