-- Migration: Adiciona coluna interview_approved para rastrear aprovação na entrevista
-- Executar no banco de produção após deploy

-- 1. Adicionar coluna em candidates
ALTER TABLE public.candidates
  ADD COLUMN IF NOT EXISTS interview_approved BOOLEAN;

-- 2. Adicionar coluna em deleted_candidates (espelho do schema de candidates)
ALTER TABLE public.deleted_candidates
  ADD COLUMN IF NOT EXISTS interview_approved BOOLEAN;

-- 3. Backfill candidates: marcar como aprovados quem claramente passou da entrevista
--    Critérios (qualquer um é suficiente):
--    a) Status terminal que implica ter passado: Concluído, Reprovado Documentação, Reprovado pelo Médico, Inapto Médico
--    b) Tem dados de etapas pós-entrevista: análise, médico ou documentação
UPDATE public.candidates
SET interview_approved = true
WHERE interview_approved IS NULL
  AND (
    status = 'Concluído'
    OR status IN ('Reprovado Documentação', 'Reprovado pelo Médico', 'Inapto Médico')
    OR analysis_request_date IS NOT NULL
    OR analysis_update_date   IS NOT NULL
    OR analysis_status        IS NOT NULL
    OR medical_request_date   IS NOT NULL
    OR medical_result_date    IS NOT NULL
    OR medical_status         IS NOT NULL
    OR docs_request_date      IS NOT NULL
    OR docs_receive_date      IS NOT NULL
    OR docs_status            IS NOT NULL
  );

-- 4. Backfill deleted_candidates com a mesma lógica
UPDATE public.deleted_candidates
SET interview_approved = true
WHERE interview_approved IS NULL
  AND (
    status = 'Concluído'
    OR status IN ('Reprovado Documentação', 'Reprovado pelo Médico', 'Inapto Médico')
    OR analysis_request_date IS NOT NULL
    OR analysis_update_date   IS NOT NULL
    OR analysis_status        IS NOT NULL
    OR medical_request_date   IS NOT NULL
    OR medical_result_date    IS NOT NULL
    OR medical_status         IS NOT NULL
    OR docs_request_date      IS NOT NULL
    OR docs_receive_date      IS NOT NULL
    OR docs_status            IS NOT NULL
  );

-- Verificação após rodar:
-- SELECT interview_approved, COUNT(*) FROM candidates GROUP BY interview_approved;
-- SELECT interview_approved, COUNT(*) FROM deleted_candidates GROUP BY interview_approved;
