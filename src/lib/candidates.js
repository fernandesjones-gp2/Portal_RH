// Colunas permitidas em insert/update de candidates (whitelist anti-injeção).
export const CANDIDATE_COLUMNS = [
  'process_type', 'name', 'mother_name', 'phone', 'cpf', 'rg',
  'job_role_id', 'unit_id', 'interview_date', 'responsible_id', 'status',
  'analysis_status', 'analysis_request_date', 'analysis_update_date',
  'medical_status', 'medical_request_date', 'medical_result_date',
  'docs_status', 'docs_request_date', 'docs_receive_date',
  'admission_date', 'feedback', 'cancellation_reason_id',
];

// Colunas válidas para ORDER BY.
export const CANDIDATE_ORDER_COLUMNS = ['created_at', 'updated_at', 'admission_date', 'interview_date', 'name'];

// SELECT com os relacionamentos aninhados como o app esperava do Supabase:
// { ...candidate, job_roles:{name}, units:{name}, users:{name} }
export const CANDIDATE_SELECT = `
  SELECT c.*,
    CASE WHEN jr.id IS NULL THEN NULL ELSE json_build_object('name', jr.name) END AS job_roles,
    CASE WHEN un.id IS NULL THEN NULL ELSE json_build_object('name', un.name) END AS units,
    CASE WHEN usr.id IS NULL THEN NULL ELSE json_build_object('name', usr.name) END AS users
  FROM candidates c
  LEFT JOIN job_roles jr ON c.job_role_id = jr.id
  LEFT JOIN units un ON c.unit_id = un.id
  LEFT JOIN users usr ON c.responsible_id = usr.id
`;
