# Project Constitution (CLAUDE.md) - Brownfield Edition

Este arquivo define as regras globais, padrões de código e o fluxo de trabalho (workflow) para este projeto existente. Ele atua como a "memória persistente" e a fonte da verdade para o comportamento do Claude Code.

> **Projeto:** Portal RH Saritur — sistema de gestão de RH (recrutamento, pipeline de admissão, promoções).
> **Última auditoria arquitetural:** 2026-05-29.

## 1. Workflow: Brownfield Spec-Driven Development (SDD)

Ciclo obrigatório em fases estritas: **Explore → Plan → Implement → Commit.**

- **NUNCA inicie a codificação diretamente.** Toda mudança passa por: auditoria do código relacionado → spec → testes → implementação.
- **Auditoria Contínua:** Antes de qualquer alteração, rastreie (`grep`/`find`/leitura) o código existente relacionado para entender contexto e dependências.
- **Change-Level Specs:** Em vez de especificar o sistema inteiro, crie specs focadas apenas no **delta** da mudança em `docs/specs/*.md`. Cada spec deve conter: Comportamento Atual, Comportamento Alvo, Invariantes (o que NÃO pode quebrar) e Plano de Testes.
- **Test Harness Primeiro:** Para cada nova funcionalidade ou correção, escreva/atualize os testes **antes** da implementação. Os testes devem falhar primeiro (provar o bug/ausência) e passar depois.
- **Validação Dupla:** Após implementar, rode os testes. Eles confirmam que a mudança funciona E que o comportamento existente não quebrou.
- **Portão de aprovação:** não escrever código de implementação até o usuário aprovar explicitamente a spec da mudança.

## 2. Tech Stack & Padrões de Código (Descobertos na Auditoria)

### Stack
- **Frontend:** Next.js **16.2.6** (App Router) + React **19.2.4**. UI com `lucide-react` (ícones) e `recharts` (gráficos).
- **Linguagem:** **JavaScript** puro (`.js`). Existe `tsconfig.json` + `@types/*`, mas TypeScript **não é usado** no código — não introduzir `.ts`/tipos sem decisão explícita.
- **Backend/DB:** **Supabase** (PostgreSQL gerenciado) via `@supabase/supabase-js`. Auth por **Google OAuth**. Acesso a dados direto do client (PostgREST). _(Em migração para Postgres próprio — ver `docs/specs/`.)_
- **Build/Deploy:** Next em modo `standalone` + Docker multi-stage (`node:22-alpine`, usuário non-root) → **EasyPanel**. Healthcheck segue `$PORT`.
- **Node:** 22.

### Padrões a manter (consistência)
- **Componentes:** funcionais com Hooks (`export default function`), `'use client'` nas páginas. Sem class components.
- **Estado:** `useState`/`useEffect` por página. `localStorage` apenas para config não-crítica (metas de dashboard, templates de mensagem). Sem Context/Redux.
- **Nomenclatura:** **português** no domínio (`handleSaveCandidate`, `userRole`, `filterUnit`); PascalCase em componentes; camelCase em funções/variáveis.
- **Estilização:** CSS variables em `globals.css` (`--saritur-orange`, `--bg-color`, etc.) + classes utilitárias (`.btn-primary`, `.glass-panel`). Estilos inline predominam.
- **Data fetching:** hoje chamadas diretas ao Supabase em `useEffect`/handlers, com `Promise.all` para paralelizar.

### Dívidas técnicas conhecidas (não piorar; melhorar quando tocar)
- Código **não-DRY**: auth, filtros e CRUD duplicados entre telas. Não há camada de serviços, hooks customizados nem componentes reaproveitáveis.
- **Tratamento de erros** inconsistente (`console.error` + `alert()`, sem error boundaries).
- **Autorização client-side** sem RLS — risco de segurança (a `anon key` é pública). Endereçar na migração.
- `supabase_schema.sql` **desatualizado**: faltam `cancellation_reasons`, `role_permissions` e a coluna `users.status`. Fonte da verdade do schema = banco vivo.
- Código-fantasma no schema: `promotions` e `psychologist_evaluations` definidas mas sem uso. Página `promocoes` é stub com dados mockados.

## 3. Estrutura de Diretórios
```
src/app/                 # App Router
  layout.js              # Root layout (fontes, estilos globais)
  page.js                # Login (público, OAuth Google)
  (sistema)/             # Route group autenticado
    layout.js            # Guard de auth + sidebar + permissões por role
    dashboard|agendamentos|pre-admissao|concluidos|promocoes|configuracoes/page.js
src/lib/supabase.js      # Único módulo compartilhado (client Supabase)
docs/specs/              # Change-Level Specs (specs de mudança)
docs/skills/             # Skills de referência (arquiteto, devBack, etc.)
tests/                   # Test Harness (a estabelecer)
public/                  # Assets estáticos
Dockerfile, .dockerignore, .env.example   # Infra de deploy
```
Não existem (ainda): pasta de componentes, camada de serviços, API routes, hooks, utils, testes.

## 4. Comandos Essenciais
- Instalar dependências: `npm install`
- Rodar em dev: `npm run dev` (http://0.0.0.0:3000)
- Build de produção: `npm run build` (gera `.next/standalone`)
- Iniciar produção: `npm run start`
- Lint: `npm run lint`
- Rodar testes (Harness): _a definir na primeira spec que introduzir testes (provável `vitest`)._

## 5. Fronteiras e Restrições (O que NÃO fazer)
- **NUNCA** modifique arquivos fora do escopo da Change-Level Spec atual sem permissão explícita.
- **NUNCA** reescreva ou refatore código legado não relacionado à tarefa atual, a menos que solicitado.
- **NUNCA** inclua credenciais, chaves de API ou segredos no código-fonte. Use variáveis de ambiente (`.env`, que está no `.gitignore`).
- **NUNCA** pule a etapa de testes. O Test Harness é inegociável.
- **NUNCA** exponha o banco diretamente ao client nem segredos de servidor via `NEXT_PUBLIC_*` (essas vars são embutidas no bundle no build).
- Se o contexto ficar muito grande ou confuso, sugira `/compact` ou uma nova sessão.
