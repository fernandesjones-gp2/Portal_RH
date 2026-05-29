-- ============================================================
-- Schema do Postgres próprio (gp2) — migração do Supabase
-- Spec: docs/specs/01-primeira-mudanca.md
--
-- Diferenças vs supabase_schema.sql (decisões da migração):
--  - users.id deixa de referenciar auth.users (Supabase Auth removido) → PK própria
--  - users.status incluído (existe no banco vivo, faltava no .sql)
--  - cancellation_reasons e role_permissions incluídas (faltavam no .sql)
--  - candidates.cancellation_reason_id incluído (existe no banco vivo)
--  - ENUMs do Supabase → TEXT (app trata como string; evita perda de dados na migração)
-- Idempotente: dropa e recria (seguro re-rodar enquanto gp2 é destino limpo).
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DROP TABLE IF EXISTS public.promotions CASCADE;
DROP TABLE IF EXISTS public.psychologist_evaluations CASCADE;
DROP TABLE IF EXISTS public.candidates CASCADE;
DROP TABLE IF EXISTS public.role_permissions CASCADE;
DROP TABLE IF EXISTS public.cancellation_reasons CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;
DROP TABLE IF EXISTS public.job_roles CASCADE;
DROP TABLE IF EXISTS public.units CASCADE;

CREATE TABLE public.units (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  is_adm_central BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE public.job_roles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE public.cancellation_reasons (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE public.role_permissions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  role TEXT NOT NULL,
  menu_path TEXT NOT NULL
);

-- Sem FK para auth.users — id próprio (UUIDs preservados do Supabase: Invariante I2)
CREATE TABLE public.users (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  role TEXT DEFAULT 'RECRUITER',
  status TEXT DEFAULT 'Pendente',
  unit_id UUID REFERENCES public.units(id),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE public.candidates (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  process_type TEXT NOT NULL,
  name TEXT NOT NULL,
  mother_name TEXT,
  phone TEXT,
  cpf TEXT,
  rg TEXT,
  job_role_id UUID REFERENCES public.job_roles(id),
  unit_id UUID REFERENCES public.units(id),
  interview_date TIMESTAMPTZ,
  responsible_id UUID REFERENCES public.users(id),
  status TEXT DEFAULT 'Agendado',
  analysis_status TEXT DEFAULT 'Pendente',
  analysis_request_date TIMESTAMPTZ,
  analysis_update_date TIMESTAMPTZ,
  medical_status TEXT DEFAULT 'Pendente',
  medical_request_date TIMESTAMPTZ,
  medical_result_date TIMESTAMPTZ,
  docs_status TEXT DEFAULT 'Pendente',
  docs_request_date TIMESTAMPTZ,
  docs_receive_date TIMESTAMPTZ,
  admission_date TIMESTAMPTZ,
  feedback TEXT,
  cancellation_reason_id UUID REFERENCES public.cancellation_reasons(id),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE public.psychologist_evaluations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  candidate_name TEXT NOT NULL,
  cpf TEXT NOT NULL,
  status TEXT DEFAULT 'Pendente',
  evaluation_date TIMESTAMPTZ,
  notes TEXT,
  psychologist_id UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE public.promotions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  type TEXT NOT NULL,
  employee_name TEXT NOT NULL,
  admission_date DATE NOT NULL,
  current_role_id UUID REFERENCES public.job_roles(id),
  new_role_id UUID REFERENCES public.job_roles(id),
  current_salary NUMERIC(10, 2),
  new_salary NUMERIC(10, 2),
  current_unit_id UUID REFERENCES public.units(id),
  new_unit_id UUID REFERENCES public.units(id),
  current_department TEXT,
  new_department TEXT,
  promotion_month INTEGER NOT NULL,
  promotion_year INTEGER NOT NULL,
  requester_id UUID REFERENCES public.users(id),
  status TEXT DEFAULT 'Aguardando Superintendência',
  rejection_reason TEXT,
  pdf_url TEXT,
  zapsign_token TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Índices para queries frequentes do app
CREATE INDEX idx_candidates_status ON public.candidates(status);
CREATE INDEX idx_candidates_responsible ON public.candidates(responsible_id);
CREATE INDEX idx_role_permissions_role ON public.role_permissions(role);
