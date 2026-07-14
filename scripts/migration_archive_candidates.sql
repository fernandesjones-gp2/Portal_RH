-- Migration: Arquivamento de Candidatos
-- Data: 2026-07-14
-- Descrição: Cria a tabela deleted_candidates para armazenar candidatos
--            excluídos logicamente com motivo e auditoria de quem excluiu.
--
-- EXECUTE NO BANCO DE PRODUÇÃO ANTES DE FAZER O DEPLOY.

CREATE TABLE IF NOT EXISTS public.deleted_candidates (
  -- Espelho das colunas de candidates (sem FK constraints pois os registros
  -- referenciados podem ser deletados depois do arquivamento)
  id                     UUID PRIMARY KEY,
  process_type           TEXT,
  name                   TEXT,
  mother_name            TEXT,
  phone                  TEXT,
  cpf                    TEXT,
  rg                     TEXT,
  job_role_id            UUID,
  unit_id                UUID,
  interview_date         TIMESTAMPTZ,
  responsible_id         UUID,
  status                 TEXT,
  analysis_status        TEXT,
  analysis_request_date  TIMESTAMPTZ,
  analysis_update_date   TIMESTAMPTZ,
  medical_status         TEXT,
  medical_request_date   TIMESTAMPTZ,
  medical_result_date    TIMESTAMPTZ,
  docs_status            TEXT,
  docs_request_date      TIMESTAMPTZ,
  docs_receive_date      TIMESTAMPTZ,
  admission_date         TIMESTAMPTZ,
  feedback               TEXT,
  cancellation_reason_id UUID,
  created_at             TIMESTAMPTZ,
  updated_at             TIMESTAMPTZ,
  -- Colunas de auditoria de exclusão
  deleted_at             TIMESTAMPTZ DEFAULT now() NOT NULL,
  deleted_by_id          UUID REFERENCES public.users(id) ON DELETE SET NULL,
  deletion_reason        TEXT NOT NULL
);

-- Índices para buscas comuns na tela de arquivados
CREATE INDEX IF NOT EXISTS idx_deleted_candidates_deleted_at ON public.deleted_candidates(deleted_at DESC);
CREATE INDEX IF NOT EXISTS idx_deleted_candidates_name      ON public.deleted_candidates(lower(name));
