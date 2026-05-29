# Plano de Migração: Supabase → Postgres próprio (EasyPanel)

> **Status:** 🔴 Em Planejamento — aguardando aprovação para iniciar (PORTÃO fechado)
> **Autor:** time + Claude (skills arquiteto/devBack)
> **Data:** 2026-05-29

## 1. Objetivo

Remover **100% a dependência do Supabase** (banco, API PostgREST e Auth/GoTrue) e
passar a usar **um Postgres próprio** hospedado no EasyPanel
(`server.rockhub.co:5438/gp2`), mantendo o app Next.js funcionando e o login com Google.

## 2. Por que isso é uma re-arquitetura (e não um ajuste)

O app hoje depende de **3 serviços** do Supabase, não só do banco:

| Serviço Supabase | O que faz hoje | Sai com a migração → vira |
|---|---|---|
| **PostgREST** | `supabase.from('x').select()` vira SQL automaticamente | API interna (Route Handlers do Next) + driver `pg` |
| **GoTrue (Auth)** | Login Google, sessão, `supabase.auth.*` | **Auth.js (NextAuth v5)** com provider Google |
| **PostgreSQL** | Banco de dados | Postgres do EasyPanel (`gp2`) |

Como o Next no navegador **não pode** falar direto com o Postgres (seria expor o banco
na internet), precisamos de uma **camada de API no servidor**. Isso é o grosso do trabalho.

## 3. Superfície de uso atual do Supabase (auditado no código)

### 3.1 Auth (`supabase.auth.*`)
- `getSession()` — em todas as telas (proteção de rota + pega usuário logado)
- `signInWithOAuth({ provider: 'google' })` — login ([src/app/page.js](../../src/app/page.js))
- `signOut()` — logout ([src/app/(sistema)/layout.js](../../src/app/(sistema)/layout.js))

### 3.2 Dados (`supabase.from(...)`)
Tabelas em uso (algumas **não existem** no `supabase_schema.sql` — ele está desatualizado):

| Tabela | Operações usadas | Consta no schema.sql? |
|---|---|---|
| `users` | select, insert, upsert, update, delete (+ coluna `status`) | ⚠️ parcial (falta `status`) |
| `candidates` | select (com joins), insert, update | ✅ |
| `units` | select, insert, update, delete | ✅ |
| `job_roles` | select, insert, update, delete | ✅ |
| `psychologist_evaluations` | (definida no schema; uso a confirmar) | ✅ |
| `promotions` | (definida no schema; uso a confirmar) | ✅ |
| `role_permissions` | select, insert, delete | ❌ **não está no schema** |
| `cancellation_reasons` | select, insert, update, delete | ❌ **não está no schema** |

> ⚠️ **Gap crítico:** o schema do repo está incompleto. A migração **tem que partir de um
> `pg_dump` do banco vivo** do Supabase, não do arquivo `.sql`.

Recursos usados que viram SQL:
- Joins embutidos: `*, job_roles(name), units(name), users(name)` → `LEFT JOIN` no SQL
- Filtros: `.eq`, `.in`, `.match`, `.order`, `.single`

## 4. Arquitetura alvo

```mermaid
graph TD
  Browser[Next.js Client Pages] -->|fetch /api/...| API[Next.js Route Handlers]
  Browser -->|/api/auth/*| Auth[Auth.js + Google]
  API --> DB[(Postgres EasyPanel gp2)]
  Auth --> DB
```

- **Mesmo deploy** (não cria backend separado): a API roda como Route Handlers
  dentro do próprio app Next, no container que já está no EasyPanel.
- **Auth.js (NextAuth v5)**: login Google, sessão via cookie JWT, tabela `users` própria.
- **Autorização por `role`**: feita no servidor (a RLS do Supabase deixa de existir).

### Decisões de stack (recomendações — sujeitas à sua aprovação)

| Decisão | Recomendado | Alternativa | Por quê |
|---|---|---|---|
| Acesso ao banco | `pg` (node-postgres) + funções de query enxutas | Drizzle / Prisma (ORM) | App pequeno (7 tabelas); SQL direto é simples e sem mágica. ORM ajuda em migrations/tipagem se o time preferir. |
| Autenticação | **Auth.js (NextAuth v5)** + Google | Lucia, Clerk | Substituto natural do GoTrue, mantém login Google, open-source, roda no mesmo app |
| Sessão | JWT em cookie httpOnly | Sessão em tabela no DB | Sem dependência extra; suficiente para o porte |
| Refatize das telas | Telas continuam `client`, trocam `supabase.from` por `fetch('/api/...')` | Reescrever como Server Components | Menos reescrita, menor risco; aproveita 90% do código atual |

## 5. Mudanças de código (escopo)

### 5.1 Novos arquivos
- `src/lib/db.js` — Pool do `pg` lendo `DATABASE_URL`
- `src/auth.js` + `src/app/api/auth/[...nextauth]/route.js` — Auth.js + Google
- `src/middleware.js` — protege as rotas `(sistema)/*`
- Route Handlers (API interna), por recurso:
  - `src/app/api/candidates/route.js` (+ `[id]/route.js`)
  - `src/app/api/units/route.js` (+ `[id]`)
  - `src/app/api/job-roles/route.js` (+ `[id]`)
  - `src/app/api/cancellation-reasons/route.js` (+ `[id]`)
  - `src/app/api/users/route.js` (+ `[id]`, `me`)
  - `src/app/api/role-permissions/route.js`
  - `src/app/api/promotions/route.js`, `src/app/api/psychologist-evaluations/route.js`

### 5.2 Arquivos alterados
- As 6 telas (`page.js`) + `(sistema)/layout.js` + `page.js` (login): trocar
  `supabase.from(...)` → `fetch('/api/...')` e `supabase.auth.*` → helpers do Auth.js
- `src/lib/supabase.js` → **removido**
- `package.json` → remove `@supabase/supabase-js`; adiciona `pg`, `next-auth`
- `Dockerfile` → remove os build-args `NEXT_PUBLIC_SUPABASE_*`; envs viram **runtime**
- `next.config.mjs` → garantir que rotas de API são dinâmicas (sem prerender estático)

### 5.3 Variáveis de ambiente (mudam!)
**Saem (build-time):** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`

**Entram (runtime, server-only — NÃO usar prefixo `NEXT_PUBLIC_`):**
```
DATABASE_URL=postgres://postgres:***@server.rockhub.co:5438/gp2
AUTH_SECRET=<gerar com: openssl rand -base64 32>
AUTH_GOOGLE_ID=<client id do Google>
AUTH_GOOGLE_SECRET=<client secret do Google>
AUTH_URL=https://gp2-rh-app.rockhub.co
```
> Vantagem: segredos deixam de ser embutidos no bundle (problema que tivemos antes) —
> ficam só no servidor.

## 6. Migração dos dados (Supabase cloud → gp2)

```
1. Instalar cliente Postgres na versão do major do Supabase (provável PG 15/17)
2. Dump do SCHEMA + DADOS do banco vivo (somente schema public):
   pg_dump "$SUPABASE_DB_URL" --schema=public --no-owner --no-privileges -Fc -f portal_rh.dump
3. (Usuários) dump de auth.users -> CSV (email, id, nome) para popular a tabela `users` própria
4. Ajustar o schema:
   - Remover a FK users.id -> auth.users(id) (auth.users deixa de existir)
   - users.id passa a ser PK própria (gerada) OU mantida = id antigo do Supabase
   - Conferir colunas faltantes (users.status) e tabelas extras (role_permissions, cancellation_reasons)
5. Restore no gp2:
   pg_restore --no-owner --no-privileges -d "$GP2_DB_URL" portal_rh.dump
6. Validar contagens (SELECT count(*)) tabela a tabela: cloud vs gp2
```

> **Decisão sobre IDs de usuário:** como `candidates.responsible_id`,
> `psychologist_evaluations.psychologist_id` e `promotions.requester_id` referenciam
> `users.id`, vamos **preservar os UUIDs atuais** dos usuários e casar o login Google
> por **e-mail** no primeiro acesso — assim nenhum vínculo quebra.

## 7. Riscos & trade-offs

| Risco | Impacto | Mitigação |
|---|---|---|
| Perda da RLS do Supabase | Alto (segurança) | Autorização por `role` no servidor + nunca expor `DATABASE_URL` ao client |
| Schema do repo desatualizado | Alto | Migração parte do `pg_dump` do banco vivo, não do `.sql` |
| Reescrever auth (Google) | Médio | Auth.js cobre; precisa novo OAuth client/redirect no Google Cloud |
| Refactor de ~2.400 linhas em 6 telas | Médio | Fazer tela a tela, testar cada uma; manter contrato de dados igual |
| Janela de migração (dados mudando) | Médio | Migrar em horário de baixo uso; congelar escrita durante o dump |
| Backup/DR do Postgres próprio | Médio | Configurar `pg_dump` agendado no EasyPanel (deixa de ter backup gerenciado do Supabase) |

## 8. Mapa de tarefas (ordem sugerida)

```
FASE 0 — Preparação (sem código de produção)
├── T0.1 Obter connection string DIRETA do banco do Supabase cloud           [P0]
├── T0.2 pg_dump do banco vivo + inventário real de tabelas/colunas          [P0]
└── T0.3 Criar OAuth client no Google Cloud (redirect do Auth.js)            [P0]

FASE 1 — Banco (gp2)
├── T1.1 Schema ajustado (sem auth.users) aplicado no gp2                     [P0]
├── T1.2 Restore dos dados + validação de contagens                          [P0]
└── T1.3 Migrar usuários (UUID preservado, match por e-mail)                 [P0]

FASE 2 — Backend no app
├── T2.1 src/lib/db.js (pool pg) + healthcheck /api/health                   [P0]
├── T2.2 Auth.js + Google + middleware de proteção de rota                   [P0]
├── T2.3 Route Handlers: users, candidates, units, job_roles                 [P0]
├── T2.4 Route Handlers: cancellation_reasons, role_permissions             [P1]
└── T2.5 Route Handlers: promotions, psychologist_evaluations               [P1]

FASE 3 — Frontend
├── T3.1 Login + layout (auth) migrados                                      [P0]
├── T3.2 Telas: agendamentos, pre-admissao, concluidos                       [P0]
├── T3.3 Telas: dashboard, configuracoes, promocoes                          [P1]
└── T3.4 Remover @supabase/supabase-js e src/lib/supabase.js                 [P0]

FASE 4 — Infra & cutover
├── T4.1 Atualizar Dockerfile (env runtime) e variáveis no EasyPanel         [P0]
├── T4.2 Testes (Harness): auth, CRUD por tela, autorização por role         [P0]
├── T4.3 Backup agendado do Postgres no EasyPanel                            [P1]
└── T4.4 Cutover: apontar domínio, desativar Supabase                        [P0]
```

## 9. Plano de rollback
- Manter o Supabase cloud **ativo e intacto** até o cutover validado.
- O deploy atual (com `@supabase/supabase-js`) fica numa branch/tag → `git revert` + rebuild volta tudo.
- Só desligar o Supabase após 1–2 dias de operação estável no Postgres próprio.

## 10. O que preciso de você para começar (Fase 0)
1. **Connection string direta do banco do Supabase cloud** (Settings → Database → URI + senha).
   _A `anon key` não serve para dump._
2. **Aprovação das decisões de stack** da seção 4 (Auth.js + `pg`), ou ajustes.
3. Confirmar a janela de migração (horário de baixo uso).
