-- Migration: Adiciona coluna interview_approved para rastrear aprovação na entrevista
-- Coluna preenchida via código (handleApprove em Agendamentos) a partir do deploy.
-- O backfill abaixo foi aplicado manualmente via banco para dados históricos.

-- 1. Adicionar coluna em candidates
ALTER TABLE public.candidates
  ADD COLUMN IF NOT EXISTS interview_approved BOOLEAN;

-- 2. Adicionar coluna em deleted_candidates (espelho do schema de candidates)
ALTER TABLE public.deleted_candidates
  ADD COLUMN IF NOT EXISTS interview_approved BOOLEAN;

-- 3. Backfill aplicado manualmente (regra definida pelo negócio):
--    true  → analysis_update_date IS NOT NULL AND docs_status IN ('Solicitada', 'Recebida')
--             (análise psicológica registrada + documentação solicitada ou recebida)
--    null  → todos os demais (sem evidência clara de aprovação na entrevista)
--
-- UPDATE public.candidates
-- SET interview_approved = true
-- WHERE analysis_update_date IS NOT NULL
--   AND docs_status IN ('Solicitada', 'Recebida');
--
-- UPDATE public.deleted_candidates
-- SET interview_approved = true
-- WHERE analysis_update_date IS NOT NULL
--   AND docs_status IN ('Solicitada', 'Recebida');

-- Verificação:
-- SELECT interview_approved, COUNT(*) FROM candidates GROUP BY interview_approved;
-- SELECT interview_approved, COUNT(*) FROM deleted_candidates GROUP BY interview_approved;
