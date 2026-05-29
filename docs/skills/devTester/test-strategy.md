# Test Strategy — Plano de Testes, Pirâmide e Decisões

## Índice
1. Test Plan Template
2. Mapeamento de Risco → Teste
3. O Que Testar (e O Que Não)
4. TDD — Test-Driven Development
5. BDD — Behavior-Driven Development
6. Contract Testing
7. Mutation Testing
8. Estratégia por Tipo de Projeto

---

## 1. Test Plan Template

```markdown
# Test Plan — [Projeto / Feature]

## Resumo
- **Objetivo:** [O que esse plano cobre]
- **Escopo:** [Features/módulos incluídos]
- **Fora do escopo:** [O que NÃO será testado e por quê]

## Pirâmide

| Camada | % | Ferramentas | Roda quando |
|--------|---|------------|-------------|
| Unit | 70% | Jest/Vitest | Toda PR |
| Integration | 20% | Supertest + TestDB | Toda PR |
| E2E | 8% | Playwright | Merge em main |
| Load | 2% | k6 | Semanal / pré-release |

## Fluxos Críticos (obrigatório testar)

| Fluxo | Camada | Prioridade |
|-------|--------|-----------|
| Registro de usuário | Integration + E2E | P0 |
| Login + refresh token | Integration + E2E | P0 |
| Criar pedido | Unit + Integration + E2E | P0 |
| Pagamento | Integration (mock gateway) + E2E | P0 |
| Listagem com filtros | Unit + Integration | P1 |

## Cobertura Alvo

| Módulo | Cobertura atual | Meta |
|--------|----------------|------|
| Services (lógica) | 45% | 85% |
| Controllers (API) | 30% | 70% |
| Repositories (DB) | 20% | 60% |
| Utils | 60% | 90% |

## Riscos de Teste

| Risco | Mitigação |
|-------|-----------|
| Flaky tests por DB compartilhado | Testcontainers (DB isolado por suite) |
| E2E lentos travando CI | Paralelizar + rodar só em main |
| Mocks desatualizados | Contract tests entre serviços |

## Timeline
- Semana 1: Setup (factories, helpers, test DB)
- Semana 2-3: Unit tests dos services
- Semana 3-4: Integration tests dos endpoints
- Semana 4: E2E dos fluxos P0
```

---

## 2. Mapeamento de Risco → Teste

```
Alto risco + Alta frequência de mudança → Testar MUITO
  Exemplos: checkout, autenticação, cálculos financeiros
  Testes: Unit + Integration + E2E + Load

Alto risco + Baixa frequência de mudança → Testar bem uma vez
  Exemplos: migração de dados, setup inicial, criptografia
  Testes: Integration + E2E (smoke)

Baixo risco + Alta frequência de mudança → Testes leves
  Exemplos: UI components, formatação, listagens
  Testes: Unit (snapshot opcional)

Baixo risco + Baixa frequência de mudança → Não priorizar
  Exemplos: about page, constantes, configs
  Testes: Skip ou smoke test mínimo
```

---

## 3. O Que Testar (e O Que Não)

### Sempre testar

```
Lógica de negócio:
├── Cálculos (preço, desconto, imposto, frete)
├── Validações (input, regras, permissões)
├── State machines (transições de status)
├── Transformações de dados (mappers, serializers)
└── Algoritmos customizados

Fluxos críticos:
├── Autenticação (login, registro, refresh, logout)
├── Pagamento (criar, confirmar, cancelar, reembolsar)
├── CRUD principal (o core do produto)
└── Integrações (APIs de terceiros — via mock)

Edge cases que causam dor:
├── Input vazio/null/undefined
├── Limites (0, -1, MAX_INT, string vazia)
├── Concorrência (double submit, race condition)
├── Timezone/locale (DST, formatos de data)
└── Permissões (user acessando recurso de outro)
```

### Não precisa testar

```
├── Getters/setters triviais
├── Constantes e configuração estática
├── Código de framework (Express route setup, React render)
├── Bibliotecas externas (axios, lodash — já testadas)
├── CSS/layout (exceto visual regression em fluxos críticos)
├── console.log / logging (testar a lógica, não o log)
├── Boilerplate gerado (migrations, seeds, configs)
└── One-off scripts (scripts de uma execução)
```

---

## 4. TDD — Test-Driven Development

```
Ciclo Red → Green → Refactor:

1. RED    → Escrever teste que FALHA
2. GREEN  → Escrever código MÍNIMO para passar
3. REFACTOR → Melhorar código mantendo testes verdes

Quando usar TDD:
├── Lógica de negócio complexa (cálculos, regras)
├── Algoritmos com muitos edge cases
├── Bug fix (escrever teste que reproduz o bug, depois fixar)
├── API contract (definir interface antes de implementar)
└── Quando não sabe por onde começar (teste força clareza)

Quando NÃO usar TDD:
├── Protótipos e spikes exploratórios
├── UI/frontend (difícil TDD com componentes visuais)
├── Código que vai mudar muito em breve
└── Integração com APIs externas (melhor testar depois)
```

### Exemplo TDD

```javascript
// 1. RED — Teste que falha
describe('calculateShipping', () => {
  it('should return free shipping for orders above R$200', () => {
    expect(calculateShipping(250, 'SP')).toBe(0);
  });
});
// ❌ ReferenceError: calculateShipping is not defined

// 2. GREEN — Implementação mínima
function calculateShipping(orderTotal, state) {
  if (orderTotal > 200) return 0;
  return 15; // placeholder
}
// ✅ Test passes

// 3. Mais testes → mais implementação
it('should return R$15 for SP', () => {
  expect(calculateShipping(100, 'SP')).toBe(1500); // centavos
});
it('should return R$25 for other states', () => {
  expect(calculateShipping(100, 'RJ')).toBe(2500);
});

// 4. REFACTOR — Código limpo
const SHIPPING_RATES = { SP: 1500, DEFAULT: 2500 };
const FREE_SHIPPING_THRESHOLD = 20000; // centavos

function calculateShipping(orderTotal, state) {
  if (orderTotal >= FREE_SHIPPING_THRESHOLD) return 0;
  return SHIPPING_RATES[state] ?? SHIPPING_RATES.DEFAULT;
}
```

---

## 5. BDD — Behavior-Driven Development

```gherkin
# Feature file (Gherkin syntax)
Feature: Checkout de pedido

  Scenario: Pedido com frete grátis
    Given um carrinho com itens totalizando R$250
    And endereço de entrega em São Paulo
    When finalizo o pedido
    Then o frete deve ser R$0
    And o total deve ser R$250

  Scenario: Pedido com frete cobrado
    Given um carrinho com itens totalizando R$100
    And endereço de entrega no Rio de Janeiro
    When finalizo o pedido
    Then o frete deve ser R$25
    And o total deve ser R$125

  Scenario: Pedido com cupom de desconto
    Given um carrinho com itens totalizando R$200
    And um cupom "SAVE10" de 10% de desconto
    When finalizo o pedido
    Then o desconto deve ser R$20
    And o total deve ser R$180
```

### Quando usar BDD

```
✅ Features com regras de negócio que o PO precisa validar
✅ Documentação viva (specs que são testes executáveis)
✅ Times onde QA e PO colaboram na definição de cenários

❌ Funções utilitárias internas (over-engineering)
❌ Times pequenos onde dev escreve tudo (overhead do Gherkin)
❌ Lógica técnica sem impacto de negócio
```

---

## 6. Contract Testing

```
Problema: Serviço A consome API do Serviço B.
Se B muda o response, A quebra silenciosamente.
Integration test pega isso? Só se roda com B real.

Contract test: Validar que o FORMATO (contrato) está correto
sem precisar rodar os dois serviços juntos.
```

```javascript
// Consumer contract (Serviço A — quem consome)
describe('Order API contract', () => {
  it('GET /api/orders/:id should match expected schema', () => {
    const schema = z.object({
      data: z.object({
        id: z.string().uuid(),
        status: z.enum(['pending', 'paid', 'shipped']),
        total: z.number().int().min(0),
        items: z.array(z.object({
          productId: z.string().uuid(),
          quantity: z.number().int().min(1),
          unitPrice: z.number().int().min(0),
        })),
        createdAt: z.string().datetime(),
      }),
    });

    const response = await api.get(`/api/orders/${testOrderId}`);
    expect(() => schema.parse(response.data)).not.toThrow();
  });
});
```

---

## 7. Mutation Testing

```
Conceito: Modificar o código de produção (mutantes) e verificar
se os testes FALHAM. Se o mutante sobrevive (teste não pega),
o teste é fraco.

Ferramenta: Stryker (JS/TS), mutmut (Python)

Mutações típicas:
├── Trocar > por >=
├── Trocar + por -
├── Remover condição de if
├── Trocar true por false
└── Remover return statement

Se trocar > por >= e nenhum teste falha, seu teste não cobre
o boundary condition. Mutation testing revela QUALIDADE do teste,
não apenas quantidade (cobertura).
```

---

## 8. Estratégia por Tipo de Projeto

| Projeto | Unit | Integration | E2E | Load | Foco |
|---------|------|------------|-----|------|------|
| **API REST** | Services, validators | Endpoints, DB queries | Fluxo de auth + CRUD crítico | Endpoints mais usados | Contrato + dados |
| **SPA React** | Hooks, utils, stores | API calls (MSW) | Fluxos de usuário (login, checkout) | — | Interação + estado |
| **CLI tool** | Commands, parsers | File system, configs | Cenários end-to-end | — | I/O + edge cases |
| **Library/SDK** | Toda API pública | — | Exemplos da doc | — | API surface + compatibility |
| **Microserviço** | Domain logic | API + messaging | Fluxo cross-service | Throughput + latência | Contract + resilience |
