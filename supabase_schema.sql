-- ==========================================
-- SCRIPT DE RESET E CRIAÇÃO (SEGURO PARA RODAR VÁRIAS VEZES)
-- ==========================================

-- 1. Apaga as tabelas antigas (se existirem) para evitar erros
DROP TABLE IF EXISTS public.promotions CASCADE;
DROP TABLE IF EXISTS public.psychologist_evaluations CASCADE;
DROP TABLE IF EXISTS public.candidates CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;
DROP TABLE IF EXISTS public.job_roles CASCADE;
DROP TABLE IF EXISTS public.units CASCADE;

-- 2. Apaga os tipos (ENUMS) antigos
DROP TYPE IF EXISTS eval_status;
DROP TYPE IF EXISTS promotion_status;
DROP TYPE IF EXISTS promotion_type;
DROP TYPE IF EXISTS candidate_status;
DROP TYPE IF EXISTS process_type;
DROP TYPE IF EXISTS user_role;

-- Enable the UUID extension se não existir
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 3. Cria custom types para ENUMS
CREATE TYPE user_role AS ENUM ('ADMIN', 'RECRUITER', 'RECRUITER_ANALYST', 'MANAGER', 'SUPERINTENDENT', 'GP2', 'DP', 'PSYCHOLOGIST');
CREATE TYPE process_type AS ENUM ('Admissão', 'Readmissão', 'Promoção');
CREATE TYPE candidate_status AS ENUM ('Agendado', 'Banco de Talentos', 'Reprovado', 'Pré-Admissão (Pendente)', 'Pré-Admissão (Pronto)', 'Concluído', 'Cancelado');
CREATE TYPE promotion_type AS ENUM ('Horizontal', 'Vertical');
CREATE TYPE promotion_status AS ENUM ('Aguardando Entrevista', 'Aguardando Superintendência', 'Aguardando GP2', 'Aguardando DP', 'Concluído', 'Reprovado', 'Cancelado', 'Pendente Correção');
CREATE TYPE eval_status AS ENUM ('Aprovado', 'Reprovado', 'Pendente');

-- 4. Criação das Tabelas Base
CREATE TABLE public.units (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  is_adm_central BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE public.job_roles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Users
CREATE TABLE public.users (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  role user_role DEFAULT 'RECRUITER',
  unit_id UUID REFERENCES public.units(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Recruitment Candidates
CREATE TABLE public.candidates (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  process_type process_type NOT NULL,
  name TEXT NOT NULL,
  mother_name TEXT,
  phone TEXT,
  cpf TEXT,
  rg TEXT,
  job_role_id UUID REFERENCES public.job_roles(id),
  unit_id UUID REFERENCES public.units(id),
  interview_date TIMESTAMP WITH TIME ZONE,
  responsible_id UUID REFERENCES public.users(id),
  status candidate_status DEFAULT 'Agendado',
  analysis_status TEXT DEFAULT 'Pendente',
  analysis_request_date TIMESTAMP WITH TIME ZONE,
  analysis_update_date TIMESTAMP WITH TIME ZONE,
  medical_status TEXT DEFAULT 'Pendente',
  medical_request_date TIMESTAMP WITH TIME ZONE,
  medical_result_date TIMESTAMP WITH TIME ZONE,
  docs_status TEXT DEFAULT 'Pendente',
  docs_request_date TIMESTAMP WITH TIME ZONE,
  docs_receive_date TIMESTAMP WITH TIME ZONE,
  admission_date TIMESTAMP WITH TIME ZONE,
  feedback TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Psychologist Evaluations
CREATE TABLE public.psychologist_evaluations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  candidate_name TEXT NOT NULL,
  cpf TEXT NOT NULL,
  status eval_status DEFAULT 'Pendente',
  evaluation_date TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  psychologist_id UUID REFERENCES public.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Promotions
CREATE TABLE public.promotions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  type promotion_type NOT NULL,
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
  status promotion_status DEFAULT 'Aguardando Superintendência',
  rejection_reason TEXT,
  pdf_url TEXT,
  zapsign_token TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Inserção de Dados Iniciais
INSERT INTO public.units (name, is_adm_central) VALUES ('Adm Central', true), ('Garagem Contagem', false);
INSERT INTO public.job_roles (name) VALUES ('Motorista'), ('Cobrador'), ('Analista de RH'), ('Aux. Administrativo');
