# Onboarding & Contributing — Guias para Times

## Índice
1. Onboarding Guide
2. CONTRIBUTING.md
3. PR Template
4. Code Style Guide
5. Glossário do Projeto

---

## 1. Onboarding Guide

### Template

```markdown
# Onboarding — Bem-vindo ao [Projeto]!

**Objetivo:** Em 1 semana, você deve conseguir rodar o projeto,
entender a arquitetura, e fazer sua primeira contribuição.

## Dia 1 — Setup e Contexto

### Setup do ambiente
1. Pedir acessos (listar quais: GitHub, Slack, Grafana, cloud, etc.)
2. Clonar o repositório: `git clone ...`
3. Seguir o [README.md](../README.md) para rodar localmente
4. Verificar que tudo funciona: `npm run test` deve passar

### Entender o projeto
- [ ] Ler o [README.md](../README.md) — O que é, para quem, o que faz
- [ ] Ler [docs/architecture.md](architecture.md) — Como os componentes se conectam
- [ ] Ler os 3 ADRs mais recentes — Por que as decisões foram tomadas

### Pessoas
| Papel | Nome | Perguntar sobre |
|-------|------|-----------------|
| Tech Lead | [nome] | Arquitetura, prioridades |
| Frontend Lead | [nome] | UI, componentes, design system |
| DBA | [nome] | Banco, migrations, queries |
| Product | [nome] | Requisitos, roadmap |

## Dia 2-3 — Explorar o Código

### Áreas para explorar
- [ ] Fazer um request pela UI e seguir o fluxo no código
- [ ] Ler um controller + service + repository de ponta a ponta
- [ ] Rodar os testes e entender como estão organizados
- [ ] Ler o [CONTRIBUTING.md](../CONTRIBUTING.md)

### Exercícios
1. **Bug fix simples** — Pegar uma issue marcada como `good-first-issue`
2. **Adicionar teste** — Encontrar uma função sem teste e cobrir
3. **Documentar** — Algo que você não entendeu? Documente para o próximo

## Dia 4-5 — Primeira Contribuição

- [ ] Criar branch, fazer PR, pedir review
- [ ] Participar de 1 code review de outra pessoa
- [ ] Fazer deploy em staging (com acompanhamento)

## Dia 5+ — Referência Rápida

| Preciso de... | Onde encontrar |
|---------------|---------------|
| Rodar o projeto | [README.md](../README.md) |
| Entender a arquitetura | [docs/architecture.md](architecture.md) |
| Criar uma feature | [CONTRIBUTING.md](../CONTRIBUTING.md) |
| Fazer deploy | [docs/runbooks/deploy.md](runbooks/deploy.md) |
| Debugar algo em produção | [docs/runbooks/](runbooks/) |
| Entender uma decisão técnica | [docs/adrs/](adrs/) |
| Termos do domínio | [docs/glossary.md](glossary.md) |

## Dúvidas?

- Canal #dev no Slack
- Pergunte! Nenhuma pergunta é boba no primeiro mês.
```

---

## 2. CONTRIBUTING.md

### Template

```markdown
# Contribuindo para [Projeto]

Obrigado por considerar contribuir! Este guia explica como
participar do desenvolvimento.

## Como Contribuir

### Reportar Bug

1. Verifique se o bug já não foi reportado nas [Issues](link)
2. Crie uma nova issue usando o template de Bug Report
3. Inclua: passos para reproduzir, comportamento esperado vs atual, screenshots

### Sugerir Feature

1. Abra uma issue usando o template de Feature Request
2. Descreva o problema que a feature resolve (não só a solução)
3. Aguarde discussão antes de implementar

### Contribuir com Código

1. Fork o repositório
2. Crie uma branch: `git checkout -b feat/minha-feature`
3. Faça suas mudanças seguindo o [Style Guide](#style-guide)
4. Escreva/atualize testes
5. Garanta que CI passa: `npm run lint && npm run test`
6. Commit com [Conventional Commits](#commits)
7. Abra um Pull Request seguindo o [template](#pr-template)

## Convenções

### Branches

```
feat/descricao-curta      → Nova feature
fix/descricao-curta       → Bug fix
docs/descricao-curta      → Documentação
refactor/descricao-curta  → Refatoração (sem mudança de comportamento)
chore/descricao-curta     → Manutenção (deps, config, CI)
```

### Commits

Seguimos [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: adicionar endpoint de exportação de pedidos
fix: corrigir cálculo de frete para pacotes acima de 10kg
docs: atualizar README com novo setup de Docker
refactor: extrair lógica de desconto para DiscountService
test: adicionar testes para OrderService.create
chore: atualizar dependências de segurança
```

Regras:
- Mensagem em português, imperativo, minúscula
- Máximo 72 caracteres no título
- Body opcional para contexto adicional
- Footer para breaking changes: `BREAKING CHANGE: ...`

### Pull Requests

- Título segue o formato de commit (`feat: ...`)
- Descrição explica O QUE e POR QUÊ
- Link para a issue relacionada
- Screenshots para mudanças visuais
- Pelo menos 1 aprovação para merge
- CI deve estar verde

## Style Guide

### Código

- Usar ESLint + Prettier (config no repo)
- `npm run lint` deve passar sem erros
- Sem `console.log` (usar logger)
- Sem `any` em TypeScript (exceto emergência documentada)
- Funções < 50 linhas, arquivos < 300 linhas

### Testes

- Testes para toda lógica de negócio
- Naming: `should [expected] when [condition]`
- Usar factories/fixtures em vez de dados inline
- Não mockar o que está testando

### Documentação

- Atualizar README se mudar setup, config ou dependências
- Criar ADR para decisões técnicas significativas
- Changelog atualizado em todo PR para `main`

## Ambiente de Desenvolvimento

```bash
# Setup
git clone [repo]
cd [repo]
cp .env.example .env
npm install
npm run db:setup

# Desenvolvimento
npm run dev          # Hot reload em localhost:3000
npm run test:watch   # Testes em watch mode
npm run lint:fix     # Auto-fix de lint

# Antes de commitar
npm run lint         # Sem erros
npm run test         # Todos passando
npm run build        # Build funciona
```

## Code Review

### Como revisor
- Foco em: bugs, segurança, performance, legibilidade
- Tom construtivo: sugerir, não criticar
- Aprovar quando pronto, sem exigir perfeição

### Como autor
- PR pequeno (< 400 linhas idealmente)
- Auto-review antes de pedir review
- Responder todos os comentários
- Não fazer force push após review iniciar
```

---

## 3. PR Template

```markdown
<!-- .github/PULL_REQUEST_TEMPLATE.md -->

## Descrição

[O que essa PR faz e por quê]

## Tipo de Mudança

- [ ] Bug fix (correção que não quebra funcionalidade existente)
- [ ] Nova feature (mudança que adiciona funcionalidade)
- [ ] Breaking change (correção ou feature que quebra funcionalidade existente)
- [ ] Documentação
- [ ] Refatoração
- [ ] Chore (dependências, config, CI)

## Issue Relacionada

Closes #[número]

## Como Testar

1. [Passo 1]
2. [Passo 2]
3. [Verificar que...]

## Checklist

- [ ] Código segue o style guide do projeto
- [ ] Self-review feito
- [ ] Testes adicionados/atualizados
- [ ] Documentação atualizada (se necessário)
- [ ] Changelog atualizado
- [ ] CI passando

## Screenshots (se aplicável)

| Antes | Depois |
|-------|--------|
| | |
```

---

## 4. Code Style Guide

### Template mínimo

```markdown
# Style Guide — [Projeto]

## Linguagem e Formatação

- **Linguagem:** TypeScript (strict mode)
- **Formatter:** Prettier (config em `.prettierrc`)
- **Linter:** ESLint (config em `.eslintrc`)
- **Rodar:** `npm run lint` / `npm run format`

## Nomenclatura

| Tipo | Convenção | Exemplo |
|------|-----------|---------|
| Variáveis/funções | camelCase | `getUserById` |
| Classes/Types | PascalCase | `OrderService` |
| Constantes | UPPER_SNAKE | `MAX_RETRIES` |
| Arquivos | kebab-case | `order-service.ts` |
| Componentes React | PascalCase | `OrderList.tsx` |
| Tabelas DB | snake_case | `order_items` |
| Env vars | UPPER_SNAKE | `DATABASE_URL` |

## Estrutura de Arquivo

```
// 1. Imports externos
import express from 'express';

// 2. Imports internos
import { UserService } from '../services/user-service';

// 3. Types/Interfaces
interface CreateUserDTO { ... }

// 4. Constantes
const MAX_RETRIES = 3;

// 5. Implementação
export class UserController { ... }
```

## Regras do Projeto

- Sem `console.log` — usar `logger.info/warn/error`
- Sem `any` — tipar tudo (exceções documentadas com `// eslint-disable-next-line`)
- Sem magic numbers — usar constantes nomeadas
- Funções async sempre com try/catch ou error boundary
- Erros tipados: `throw new NotFoundError()` não `throw new Error()`
- Validação de input no controller, lógica no service, acesso no repository
```

---

## 5. Glossário do Projeto

### Template

```markdown
# Glossário — [Projeto]

Termos do domínio usados no código e na documentação.
Usar estes termos de forma consistente em código, docs e comunicação.

| Termo | Definição | Usado em |
|-------|-----------|----------|
| **Order** | Pedido feito por um usuário contendo 1+ items | `orders`, `OrderService` |
| **Order Item** | Linha individual do pedido (produto + quantidade) | `order_items` |
| **SKU** | Stock Keeping Unit — identificador único do produto | `products.sku` |
| **Fulfillment** | Processo de preparação e envio do pedido | `FulfillmentService` |
| **Tenant** | Empresa/cliente no modelo multi-tenant | `tenant_id` |
| **Backoffice** | Painel administrativo interno | `/admin/*` |

## Termos Técnicos do Projeto

| Termo | Significado no contexto |
|-------|----------------------|
| **Worker** | Processo background que consome fila (BullMQ) |
| **Job** | Tarefa enfileirada para processamento assíncrono |
| **Migration** | Script DDL versionado (Knex/Prisma) |
| **Seed** | Script que popula dados de teste/exemplo |
```
