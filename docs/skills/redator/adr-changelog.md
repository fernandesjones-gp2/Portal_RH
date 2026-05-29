# ADRs & Changelog — Decisões Técnicas e Histórico de Mudanças

## Índice
1. ADR — Architectural Decision Records
2. ADR Template
3. Exemplos de ADR
4. Changelog — Convenções
5. Changelog Template
6. Release Notes

---

## 1. ADR — Architectural Decision Records

### O que é

Um ADR documenta UMA decisão técnica significativa com o contexto,
alternativas consideradas, e consequências. É o "porquê" por trás
das escolhas técnicas do projeto.

### Quando criar ADR

```
CRIAR ADR quando:
├── Escolher banco de dados, framework, linguagem
├── Definir padrão arquitetural (monolito, microservices)
├── Escolher estratégia de autenticação
├── Decidir sobre caching, messaging, search
├── Mudar stack significativamente
├── Adotar ou abandonar uma lib/ferramenta
└── Qualquer decisão que alguém vai perguntar "por que fizeram assim?"

NÃO CRIAR ADR para:
├── Escolhas triviais (tabs vs spaces, naming convention)
├── Decisões temporárias (workaround que vai ser refeito)
└── Implementação (COMO fazer, não O QUE decidir)
```

### Regra fundamental

**ADRs são imutáveis.** Nunca editar um ADR existente.
Se a decisão mudar, criar novo ADR que referencia e supera o anterior.

---

## 2. ADR Template

```markdown
# ADR-NNN: [Título da Decisão]

**Data:** YYYY-MM-DD
**Status:** Proposta | Aceita | Depreciada | Superada por ADR-XXX
**Participantes:** [Nomes/times envolvidos]

## Contexto

[Qual é a situação? Qual problema precisa ser resolvido?
Quais são os requisitos e constraints?
Mínimo 2-3 parágrafos explicando o cenário.]

## Opções Consideradas

### Opção A: [Nome]

**Descrição:** [O que é e como funcionaria]

| Prós | Contras |
|------|---------|
| [Vantagem 1] | [Desvantagem 1] |
| [Vantagem 2] | [Desvantagem 2] |

### Opção B: [Nome]

**Descrição:** [O que é e como funcionaria]

| Prós | Contras |
|------|---------|
| [Vantagem 1] | [Desvantagem 1] |
| [Vantagem 2] | [Desvantagem 2] |

### Opção C: [Nome] (se houver)

[...]

## Decisão

**Escolhemos a Opção [X]** porque [justificativa principal].

[2-3 frases expandindo a justificativa, referenciando os prós
que pesaram mais e como os contras serão mitigados.]

## Consequências

### Positivas
- [O que ganhamos]
- [O que fica mais fácil]

### Negativas
- [O que perdemos ou fica mais difícil]
- [Trade-offs aceitos]

### Riscos
- [O que pode dar errado]
- [Mitigação planejada]

## Referências

- [Links para documentação, benchmarks, artigos relevantes]
- [ADRs relacionados]
```

---

## 3. Exemplos de ADR

### ADR-001: PostgreSQL como banco principal

```markdown
# ADR-001: PostgreSQL como Banco de Dados Principal

**Data:** 2025-01-10
**Status:** Aceita
**Participantes:** Time Backend, CTO

## Contexto

Estamos iniciando o projeto X que é um sistema de gestão de pedidos
com relacionamentos complexos entre entidades (Users, Orders, Products,
Inventory, Payments). Esperamos 10K usuários ativos no primeiro ano
com crescimento de 3x ao ano.

Precisamos de um banco que suporte: transações ACID, queries complexas
com JOINs, full-text search básico, e JSONB para dados semi-estruturados.

## Opções Consideradas

### Opção A: PostgreSQL

| Prós | Contras |
|------|---------|
| ACID completo | Mais pesado que SQLite/MySQL para setup |
| JSONB para flexibilidade | Requer tuning para alta escala |
| Full-text search nativo | Ecossistema de hosting menor que MySQL |
| Extensões (PostGIS, pg_trgm) | Time tem experiência moderada |
| Comunidade ativa | — |

### Opção B: MongoDB

| Prós | Contras |
|------|---------|
| Schema flexível | Sem JOINs nativos (lookup é limitado) |
| Horizontal scaling nativo | Consistência eventual por default |
| Boa DX para protótipos | Modelo relacional não se encaixa bem |
| — | Transações multi-document são complexas |

### Opção C: MySQL

| Prós | Contras |
|------|---------|
| Amplamente usado | JSONB inferior ao PostgreSQL |
| Hosting barato e abundante | Sem full-text search tão robusto |
| Time tem experiência | Extensões limitadas |

## Decisão

**Escolhemos PostgreSQL** porque nosso domínio é fortemente relacional
(pedidos, itens, pagamentos, endereços) e precisamos de transações ACID
garantidas. O JSONB nos dá flexibilidade para atributos dinâmicos de
produtos sem sacrificar o modelo relacional. O full-text search nativo
elimina a necessidade de Elasticsearch no MVP.

## Consequências

### Positivas
- Modelo relacional natural para o domínio
- Transações ACID sem workarounds
- JSONB para flexibilidade + indexação

### Negativas
- Setup inicial mais complexo que SQLite
- Requer tuning em produção (autovacuum, shared_buffers)

### Riscos
- Se escalar além de 1M orders/dia, pode precisar de read replicas
- Mitigação: Começar com índices otimizados + connection pooling (PgBouncer)
```

---

## 4. Changelog — Convenções

### Keep a Changelog (padrão da comunidade)

Baseado em https://keepachangelog.com

```
Categorias:
├── Added      → Funcionalidades novas
├── Changed    → Mudanças em funcionalidades existentes
├── Deprecated → Funcionalidades que serão removidas em breve
├── Removed    → Funcionalidades removidas
├── Fixed      → Correções de bugs
└── Security   → Correções de vulnerabilidades
```

### Regras

```
1. Escrito para HUMANOS, não para máquinas
2. Cada versão tem data no formato ISO (YYYY-MM-DD)
3. Versões em ordem cronológica reversa (mais recente primeiro)
4. Unreleased no topo para mudanças ainda não publicadas
5. Sem jargão interno — qualquer dev deve entender
6. Link para diff do git entre versões
```

---

## 5. Changelog Template

```markdown
# Changelog

Todas as mudanças notáveis deste projeto estão documentadas aqui.

O formato segue [Keep a Changelog](https://keepachangelog.com/),
e o projeto adere ao [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- Endpoint de exportação de pedidos em CSV (#123)

### Changed
- Timeout de sessão aumentado de 15min para 30min (#125)

---

## [1.2.0] - 2025-01-15

### Added
- Sistema de cupons de desconto (#110)
- Notificações por email ao mudar status do pedido (#112)
- Endpoint `GET /api/orders/:id/timeline` (#115)

### Changed
- Paginação usa cursor-based em vez de offset (#108)
- Rate limit de login reduzido de 10 para 5 tentativas (#113)

### Fixed
- Cálculo de frete incorreto para pedidos acima de 10kg (#111)
- Race condition ao processar pagamento simultâneo (#114)

### Security
- Atualizado jsonwebtoken de 8.5 para 9.0 (CVE-2023-XXXX) (#116)

---

## [1.1.0] - 2025-01-01

### Added
- Autenticação com refresh token (#95)
- Suporte a múltiplos endereços por usuário (#98)

### Fixed
- Erro 500 ao criar pedido sem endereço (#97)

---

## [1.0.0] - 2024-12-15

### Added
- CRUD de usuários com autenticação JWT
- CRUD de produtos com categorias
- Sistema de pedidos (criar, listar, detalhar)
- Painel administrativo básico
- Docker setup para desenvolvimento
- CI/CD com GitHub Actions

[Unreleased]: https://github.com/org/repo/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/org/repo/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/org/repo/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/org/repo/releases/tag/v1.0.0
```

---

## 6. Release Notes

Para comunicação com stakeholders não-técnicos:

```markdown
# Release Notes — v1.2.0 (15 de Janeiro de 2025)

## Novidades

### Sistema de Cupons
Agora é possível criar cupons de desconto (porcentagem ou valor fixo)
e aplicá-los no checkout. Cupons podem ter data de validade e limite
de uso.

### Notificações por Email
Clientes recebem email automático quando o status do pedido muda
(confirmado, enviado, entregue).

## Melhorias

- Listagem de pedidos agora carrega mais rápido para contas com
  muitos pedidos (otimização de paginação)

## Correções

- Corrigido cálculo de frete que cobrava a mais em pacotes pesados
- Corrigido problema raro de cobrança duplicada

## Segurança

- Atualizada biblioteca de autenticação (correção de vulnerabilidade)

---

**Atualização automática.** Nenhuma ação necessária.
Dúvidas: dev@example.com
```
