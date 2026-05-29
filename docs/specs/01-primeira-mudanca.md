# Change-Level Spec 01 — Migração completa: Supabase → Postgres próprio

> **Status:** 🟢 Implementada localmente e validada (build + 9 testes + smoke test). Falta deploy no EasyPanel.
> **Escopo escolhido:** Migração completa de uma vez (dados + API + Auth + telas + cutover)
> **Plano de arquitetura detalhado:** [migracao-supabase-para-postgres.md](./migracao-supabase-para-postgres.md)
> **Data:** 2026-05-29

---

## 1. Comportamento Atual

- O app Next.js (client-side) fala **direto com o Supabase** via `@supabase/supabase-js`:
  - **Auth:** `supabase.auth.getSession()`, `signInWithOAuth('google')`, `signOut()`.
  - **Dados:** `supabase.from('<tabela>')...` em 6 tabelas (`candidates`, `users`, `units`, `job_roles`, `cancellation_reasons`, `role_permissions`).
- A autorização é **client-side**: o `(sistema)/layout.js` lê `users.status` e `role_permissions` e filtra o menu; páginas checam `role`.
- Segredos `NEXT_PUBLIC_SUPABASE_*` são embutidos no bundle no build.
- Os dados de produção vivem no Supabase cloud (`hjiarobzrldgxgowoyks.supabase.co`).
- **Não há** API interna, camada de serviços nem testes.

## 2. Comportamento Alvo (o delta preciso)

A aplicação deixa de usar o Supabase **por completo** e passa a usar o Postgres próprio (`server.rockhub.co:5438/gp2`), mantendo **a mesma experiência de usuário** (login Google, mesmas telas e fluxos).

### 2.1 Dados
- Schema + dados migrados do banco **vivo** do Supabase para o `gp2` (não do `.sql` desatualizado).
- FK `users.id → auth.users(id)` **removida**; `users` passa a ser tabela própria e autossuficiente.
- UUIDs de usuários **preservados** (para não quebrar `responsible_id`, `psychologist_id`, `requester_id`).
- Tabelas/colunas faltantes no `.sql` (`cancellation_reasons`, `role_permissions`, `users.status`) incluídas conforme o banco vivo.

### 2.2 Camada de acesso (nova)
- `src/lib/db.js`: pool `pg` lendo `DATABASE_URL` (server-only).
- **Route Handlers** (API interna, no mesmo app) substituindo cada chamada Supabase:
  - `candidates`, `units`, `job-roles`, `cancellation-reasons`, `users` (+ `me`), `role-permissions`.
  - Joins do PostgREST (`*, job_roles(name)...`) reescritos como `LEFT JOIN` em SQL.
- **Autorização movida para o servidor:** cada handler valida sessão e `role` antes de executar (compensa a ausência de RLS).

### 2.3 Autenticação (nova)
- **Auth.js (NextAuth v5)** com provider Google substitui o GoTrue.
- `src/auth.js`, `src/app/api/auth/[...nextauth]/route.js`, `src/middleware.js` (protege `(sistema)/*`).
- Match de usuário por **e-mail** no primeiro login (vincula ao UUID preservado).

### 2.4 Telas
- As 6 telas + 2 layouts trocam `supabase.from(...)` → `fetch('/api/...')` e `supabase.auth.*` → helpers do Auth.js. UI/fluxos inalterados.
- `src/lib/supabase.js` removido; dependência `@supabase/supabase-js` removida; `pg` + `next-auth` adicionadas.

### 2.5 Infra / env
- Saem (build-arg): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Entram (runtime, server-only): `DATABASE_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_URL`.
- `Dockerfile`/`.env.example` atualizados; variáveis configuradas no EasyPanel.

### Ordem de implementação (incremental, dentro desta spec)
1. Banco no `gp2` (schema + dados + validação de contagens)
2. `db.js` + `/api/health`
3. Auth.js + middleware
4. Route Handlers (CRUD por recurso)
5. Telas (uma a uma)
6. Remoção do Supabase + infra/cutover

## 3. Invariantes (o que NÃO pode quebrar)

- **I1 — Paridade de dados:** contagem por tabela e integridade referencial idênticas entre Supabase e `gp2` (0 linhas perdidas).
- **I2 — Vínculos de usuário:** `candidates.responsible_id`, `psychologist_evaluations.psychologist_id`, `promotions.requester_id` continuam apontando para os usuários corretos (UUIDs preservados).
- **I3 — Login Google:** o mesmo usuário entra com a mesma conta Google e mantém seu `role`/`status`.
- **I4 — Autorização:** as mesmas regras de acesso continuam valendo (usuário `Pendente` bloqueado; menu filtrado por `role_permissions`; `configuracoes` só `ADMIN`). Agora **reforçadas no servidor**.
- **I5 — Fluxos de negócio:** pipeline de status (`Agendado → Pré-Admissão (Pendente/Pronto) → Concluído`) e o retorno de cancelamento DP funcionam igual.
- **I6 — UX:** telas, textos (pt-BR), filtros e ações idênticos do ponto de vista do usuário.
- **I7 — Segredos:** nenhum segredo de servidor exposto via `NEXT_PUBLIC_*` nem no bundle; `DATABASE_URL` só no servidor.
- **I8 — Reversibilidade:** Supabase cloud permanece intacto e ativo até o cutover validado (rollback via revert + rebuild).

## 4. Plano de Testes (Test Harness)

> Não há infra de teste hoje. Esta spec **introduz** o Harness com **Vitest**.
> Script: `npm test` (a adicionar). Testes de integração rodam contra um Postgres de teste
> (container local ou schema dedicado no `gp2`), nunca contra produção.

### 4.1 Migração de dados (scripts validáveis)
- `T-DATA-1`: contagem `SELECT count(*)` por tabela — Supabase vs `gp2` deve bater (cobre **I1**).
- `T-DATA-2`: checagem de FKs órfãs no `gp2` (nenhuma) (cobre **I2**).
- `T-DATA-3`: amostragem de N usuários — UUID e e-mail idênticos (cobre **I2/I3**).

### 4.2 Camada de dados / API (Vitest, integração)
- `T-DB-1`: `db.js` conecta e responde `SELECT 1`.
- `T-API-1..n`: para cada Route Handler, casos de **select/insert/update/delete** retornam o esperado e os joins trazem os campos certos (paridade com o retorno antigo do Supabase).
- `T-AUTHZ-1`: handler nega acesso sem sessão (401) e por `role` insuficiente (403) (cobre **I4**).

### 4.3 Autenticação (Auth.js)
- `T-AUTH-1`: callback do Google cria/associa usuário por e-mail mantendo UUID (cobre **I3**).
- `T-AUTH-2`: middleware redireciona não autenticado para `/`; usuário `Pendente` é bloqueado (cobre **I4**).

### 4.4 Regressão por tela (checklist manual + smoke)
- Para cada tela (`agendamentos`, `pre-admissao`, `concluidos`, `dashboard`, `configuracoes`): carregar, executar 1 ação de escrita, confirmar persistência no `gp2` (cobre **I5/I6**).

### 4.5 Critério de aceite (Definition of Done)
- [ ] Todos os testes acima passam.
- [ ] `grep -r "supabase" src/` retorna **vazio**; `@supabase/supabase-js` fora do `package.json`.
- [ ] App buildando e rodando no EasyPanel apontando só para `gp2`.
- [ ] Contagens batem (I1) e logins reais validados (I3).
- [ ] Supabase mantido ativo por 1–2 dias pós-cutover (I8).

---

## 5. Pré-requisitos para a Fase 4 (implementação)
1. **Connection string DIRETA do banco do Supabase** (Settings → Database → URI + senha). _A `anon key` não serve para `pg_dump`._
2. **Credenciais do Google OAuth** para o Auth.js (client ID/secret) + redirect `https://gp2-rh-app.rockhub.co/api/auth/callback/google`.
3. **Cliente Postgres** (instalar `pg_dump`/`psql` na versão do major do Supabase) ou Docker disponível.
4. Definição da **janela de migração** (baixo uso).
