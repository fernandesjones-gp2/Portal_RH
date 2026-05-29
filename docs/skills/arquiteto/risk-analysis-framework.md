# Risk Analysis Framework — Riscos e Trade-offs

## Índice
1. Matriz de Riscos
2. Categorias de Risco
3. Registro de Decisões Técnicas (ADR)
4. Template do Documento

---

## 1. Matriz de Riscos

### Classificação

| | **Impacto Baixo** | **Impacto Médio** | **Impacto Alto** |
|---|---|---|---|
| **Prob. Alta** | 🟡 Monitorar | 🟠 Plano de ação | 🔴 Prioridade máxima |
| **Prob. Média** | 🟢 Aceitar | 🟡 Monitorar | 🟠 Plano de ação |
| **Prob. Baixa** | 🟢 Aceitar | 🟢 Aceitar | 🟡 Monitorar |

### Definições

**Probabilidade:**
- **Alta**: >70% de chance de acontecer
- **Média**: 30-70%
- **Baixa**: <30%

**Impacto:**
- **Alto**: Bloqueia lançamento, perda de dados, downtime prolongado, custo >5x budget
- **Médio**: Atrasa lançamento, experiência degradada, retrabalho significativo
- **Baixo**: Inconveniente, workaround possível, não afeta prazo

### Formato de registro

```markdown
### RISK-[número]: [Título]

**Categoria:** [Técnico / Conhecimento / Dependência / Escopo / Infra]
**Probabilidade:** [Alta / Média / Baixa]
**Impacto:** [Alto / Médio / Baixo]
**Severidade:** [🔴 / 🟠 / 🟡 / 🟢]

**Descrição:**
[O que pode acontecer e por quê]

**Mitigação (preventiva):**
[O que fazer ANTES para reduzir a probabilidade]

**Contingência (reativa):**
[O que fazer SE acontecer]

**Owner:** [Quem monitora]
**Status:** [Aberto / Mitigado / Materializado / Fechado]
```

---

## 2. Categorias de Risco

### Técnico

Riscos do código, arquitetura, performance.

| Risco comum | Sinal | Mitigação típica |
|-------------|-------|-------------------|
| Performance insuficiente | Requisitos de latência agressivos | Load test cedo, profiling, cache |
| Vulnerabilidades de segurança | Dados sensíveis, auth complexa | OWASP checklist, pentest, code review |
| Dívida técnica acumulada | Prazo apertado, atalhos | Refactoring sprints, code standards |
| Integração instável | API externa sem SLA | Circuit breaker, fallback, cache |
| Escalabilidade | Crescimento rápido esperado | Arquitetura stateless, horizontal scaling |

### Conhecimento

Riscos do time não saber o suficiente.

| Risco comum | Sinal | Mitigação típica |
|-------------|-------|-------------------|
| Stack desconhecida | Time nunca usou a tecnologia | Spike/PoC de 2-3 dias, treinamento |
| Domínio complexo | Regras de negócio intrincadas | Domain expert disponível, Event Storming |
| Bus factor = 1 | Só uma pessoa entende X | Pair programming, documentação |
| Subestimar complexidade | "É simples, é só um..." | Discovery profunda, estimativas pessimistas |

### Dependência

Riscos de depender de algo externo.

| Risco comum | Sinal | Mitigação típica |
|-------------|-------|-------------------|
| API de terceiro fora do ar | Integração crítica sem SLA | Circuit breaker, cache, fila |
| Vendor lock-in | Serviço proprietário sem alternativa | Abstração, interface, multi-cloud |
| Mudança de preço | Free tier generoso | Budget reserve, alternativas mapeadas |
| Deprecation | Lib/serviço antigo | Monitorar changelogs, atualizar |

### Escopo

Riscos de requisitos e prioridades.

| Risco comum | Sinal | Mitigação típica |
|-------------|-------|-------------------|
| Feature creep | "Só mais uma coisinha" | MVP definido, escopo negativo documentado |
| Requisitos ambíguos | "O sistema deve ser flexível" | Critérios de aceite específicos |
| Stakeholders desalinhados | Opiniões conflitantes | Discovery com todos, doc aprovado |
| Mudança de prioridade | Pivô de negócio | Arquitetura modular, entregas incrementais |

---

## 3. Registro de Decisões Técnicas (ADR)

Architectural Decision Records documentam o PORQUÊ das escolhas.
Fundamental para quem entra no projeto depois e pergunta "por que fizeram assim?"

### Formato

```markdown
### ADR-[número]: [Título da decisão]

**Data:** [YYYY-MM-DD]
**Status:** [Proposta / Aceita / Depreciada / Substituída por ADR-X]

**Contexto:**
[Qual situação motivou essa decisão? Qual problema estava sendo resolvido?]

**Opções Consideradas:**

**Opção A: [Nome]**
- ✅ [Vantagem 1]
- ✅ [Vantagem 2]
- ❌ [Desvantagem 1]

**Opção B: [Nome]**
- ✅ [Vantagem 1]
- ❌ [Desvantagem 1]
- ❌ [Desvantagem 2]

**Decisão:**
Escolhemos **Opção A** porque [justificativa principal].

**Consequências:**
- [O que ganhamos]
- [O que perdemos / abrimos mão]
- [O que precisamos fazer diferente por causa dessa escolha]
```

### Exemplo

```markdown
### ADR-001: Usar PostgreSQL ao invés de MongoDB

**Data:** 2025-01-15
**Status:** Aceita

**Contexto:**
O sistema tem entidades altamente relacionais (users, orders, products,
categories) com necessidade de transações ACID e queries complexas com
JOINs e agregações.

**Opções Consideradas:**

**PostgreSQL:**
- ✅ Relações fortes, JOINs eficientes
- ✅ ACID completo
- ✅ JSONB para dados semi-estruturados
- ✅ Time tem experiência
- ❌ Escala horizontal mais complexa

**MongoDB:**
- ✅ Flexibilidade de schema
- ✅ Escala horizontal nativa
- ❌ Sem JOINs eficientes (precisa de $lookup)
- ❌ Transações multi-document são limitadas
- ❌ Time não tem experiência

**Decisão:**
PostgreSQL, pois o domínio é relacional e o time já conhece.

**Consequências:**
- Ganhamos: Integridade referencial, queries complexas, ecossistema maduro
- Perdemos: Flexibilidade de schema (mitigado com JSONB quando necessário)
- Se precisarmos escalar leitura: read replicas. Se escalar escrita: sharding via Citus
```

---

## 4. Template do Documento

```markdown
# 07 — Riscos e Trade-offs

## Resumo de Riscos

| Severidade | Quantidade |
|-----------|-----------|
| 🔴 Crítico | [X] |
| 🟠 Alto | [X] |
| 🟡 Médio | [X] |
| 🟢 Baixo | [X] |

---

## Riscos Identificados

### Técnicos
(... RISK-001, RISK-002 ... seguir formato da seção 1 ...)

### Conhecimento
(... ...)

### Dependências
(... ...)

### Escopo
(... ...)

---

## Decisões Técnicas (ADRs)

### ADR-001: [Título]
(... seguir formato da seção 3 ...)

### ADR-002: [Título]
(... ...)

---

## Plano de Contingência

| Se acontecer... | Fazemos... | Responsável |
|-----------------|-----------|-------------|
| API X fora do ar | Ativar cache local, fila de retry | [nome] |
| Pico de tráfego 10x | Auto-scaling + throttling | [nome] |
```
