# Spec: Arquivamento de Candidatos (ADMIN only)

**Data:** 2026-07-14  
**Status:** Aprovada — pronta para implementação

## Comportamento Atual
- `DELETE /api/candidates/:id` apaga o registro permanentemente sem verificação de role, sem motivo e sem rastro.
- Nenhum `.remove` está exposto no `api-client.js` (rota existia mas sem uso no frontend).
- Dashboard lê apenas da tabela `candidates` via `GET /api/candidates`.

## Comportamento Alvo
- **Exclusão lógica com auditoria:** ao "excluir" um candidato, seu registro é copiado para `deleted_candidates` (com motivo + quem excluiu + quando) e removido de `candidates` — em transação atômica.
- **Restrição ADMIN:** somente usuários com `role = 'ADMIN'` podem executar a operação.
- **Motivo obrigatório:** mínimo 10 caracteres; rejeitado com 400 se inválido.
- **Candidatos Concluídos são intocáveis:** status `'Concluído'` bloqueia o arquivamento (409 server-side + botão oculto no client).
- **Dashboard:** não requer nenhuma alteração — candidatos arquivados somem automaticamente pois não existem mais em `candidates`.
- **Visualização:** aba "Arquivados" em Configurações (ADMIN only) com busca, filtro de data, tabela detalhada.
- **Sem restauração:** fora de escopo.

## Invariantes
1. Operação atômica: INSERT na `deleted_candidates` + DELETE em `candidates` dentro de transação.
2. Candidatos com `status = 'Concluído'` nunca são arquivados (bloqueio duplo: server-side 409 + botão oculto).
3. O `DELETE /api/candidates/:id` legado retorna 405 Method Not Allowed.
4. As páginas `dashboard`, `concluidos` não são tocadas.
5. Dados de candidatos arquivados são somente-leitura.

## Arquivos Alterados / Criados
| # | Arquivo | Ação |
|---|---------|------|
| 1 | `scripts/migration_archive_candidates.sql` | CRIAR — tabela `deleted_candidates` |
| 2 | `src/app/api/candidates/[id]/archive/route.js` | CRIAR — POST (transação) |
| 3 | `src/app/api/candidates/archived/route.js` | CRIAR — GET listagem |
| 4 | `src/app/api/candidates/[id]/route.js` | MODIFICAR — DELETE → 405 |
| 5 | `src/lib/api-client.js` | MODIFICAR — adicionar `archive`, `listArchived` |
| 6 | `src/app/(sistema)/agendamentos/page.js` | MODIFICAR — botão + modal |
| 7 | `src/app/(sistema)/pre-admissao/page.js` | MODIFICAR — botão + modal |
| 8 | `src/app/(sistema)/configuracoes/page.js` | MODIFICAR — aba Arquivados |

## Schema da Nova Tabela
```sql
CREATE TABLE public.deleted_candidates (
  -- espelho de candidates (sem FKs — os registros referenciados podem ser deletados depois)
  id UUID PRIMARY KEY,
  process_type TEXT,
  name TEXT,
  mother_name TEXT,
  phone TEXT,
  cpf TEXT,
  rg TEXT,
  job_role_id UUID,
  unit_id UUID,
  interview_date TIMESTAMPTZ,
  responsible_id UUID,
  status TEXT,
  analysis_status TEXT,
  analysis_request_date TIMESTAMPTZ,
  analysis_update_date TIMESTAMPTZ,
  medical_status TEXT,
  medical_request_date TIMESTAMPTZ,
  medical_result_date TIMESTAMPTZ,
  docs_status TEXT,
  docs_request_date TIMESTAMPTZ,
  docs_receive_date TIMESTAMPTZ,
  admission_date TIMESTAMPTZ,
  feedback TEXT,
  cancellation_reason_id UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  -- colunas de auditoria
  deleted_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  deleted_by_id UUID REFERENCES public.users(id),
  deletion_reason TEXT NOT NULL
);
```
