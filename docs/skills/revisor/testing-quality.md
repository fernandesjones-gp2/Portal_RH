# Testing Quality — Cobertura, Testabilidade e Padrões

## Índice
1. Pirâmide de Testes
2. O Que Testar (e O Que Não Testar)
3. Anatomia de um Bom Teste
4. Testabilidade do Código
5. Mocking — Quando e Como
6. Padrões de Teste por Camada
7. Anti-Patterns de Testes
8. Sugestão de Testes no Review

---

## 1. Pirâmide de Testes

```
          /\
         /  \        E2E (poucos, lentos, frágeis)
        / E2E\       Testa o sistema completo
       /------\
      /        \     Integration (médios)
     /Integração\    Testa interação entre módulos/DB/APIs
    /------------\
   /              \  Unit (muitos, rápidos, estáveis)
  /   Unitários    \ Testa funções/classes isoladas
 /------------------\
```

| Tipo | Quantidade | Velocidade | Foco |
|------|-----------|-----------|------|
| Unit | 70-80% | ms | Lógica de negócio, utils, transformações |
| Integration | 15-25% | segundos | DB queries, API endpoints, serviços |
| E2E | 5-10% | minutos | Fluxos críticos do usuário |

---

## 2. O Que Testar (e O Que Não Testar)

### Sempre testar

```
Regras de negócio:
  - Cálculo de preço, desconto, imposto
  - Validações (input, permissões, limites)
  - State machines (status transitions)
  - Algoritmos customizados

Fluxos críticos:
  - Autenticação (login, registro, reset password)
  - Pagamento (checkout, refund)
  - Dados sensíveis (CRUD de recursos do usuário)

Edge cases:
  - Input vazio, null, undefined
  - Limites (primeiro, último, zero, máximo)
  - Erros esperados (network failure, DB down)
  - Concorrência (double submit)
```

### Não precisa testar

```
  - Getters/setters triviais
  - Constantes e configuração
  - Código do framework (Express route setup, React render sem lógica)
  - Bibliotecas externas (axios, lodash — eles já testam)
  - CSS/layout (a menos que tenha visual regression testing)
```

---

## 3. Anatomia de um Bom Teste

### Padrão AAA (Arrange, Act, Assert)

```javascript
describe('OrderService', () => {
  describe('calculateTotal', () => {
    it('should apply percentage discount correctly', () => {
      // Arrange — Preparar dados
      const items = [
        { name: 'Widget', price: 100, quantity: 2 },
        { name: 'Gadget', price: 50, quantity: 1 },
      ];
      const coupon = { type: 'percentage', value: 10 };

      // Act — Executar
      const total = calculateTotal(items, coupon);

      // Assert — Verificar
      expect(total).toBe(225); // (200 + 50) * 0.9 = 225
    });
  });
});
```

### Regras de um bom teste

```
1. Nome descreve o comportamento, não a implementação
   Ruim:  'test calculateTotal method'
   Bom:   'should apply 10% discount when percentage coupon is provided'

2. Um assert por teste (idealmente)
   Ruim:  expect(result.total).toBe(225); expect(result.items).toHaveLength(3);
   Bom:   Dois testes separados

3. Independente (não depende de ordem ou estado de outro teste)
   Ruim:  Teste B precisa que Teste A rode antes
   Bom:   Cada teste configura seu próprio estado

4. Determinístico (sempre mesmo resultado)
   Ruim:  Depende de Date.now(), Math.random(), rede
   Bom:   Mock de time/random, dados fixos

5. Rápido
   Ruim:  Teste unitário que leva 5 segundos
   Bom:   Teste unitário em < 50ms
```

### Nomenclatura de testes

```javascript
// Padrão: should [expected behavior] when [condition]
describe('UserService', () => {
  describe('register', () => {
    it('should create user when valid data is provided', () => { ... });
    it('should throw ValidationError when email is empty', () => { ... });
    it('should throw ConflictError when email already exists', () => { ... });
    it('should hash password before saving', () => { ... });
    it('should send welcome email after creation', () => { ... });
  });
});

// Padrão alternativo: given/when/then
describe('given a pending order', () => {
  describe('when user confirms payment', () => {
    it('then order status changes to paid', () => { ... });
    it('then inventory is decremented', () => { ... });
  });
  describe('when payment fails', () => {
    it('then order status remains pending', () => { ... });
    it('then user receives error notification', () => { ... });
  });
});
```

---

## 4. Testabilidade do Código

### Código difícil de testar (red flag no review)

```javascript
// MEDIUM — Dependência hardcoded (impossível mockar)
class OrderService {
  async create(data) {
    const user = await db.query('SELECT * FROM users WHERE id = $1', [data.userId]);
    const result = await stripe.charges.create({ amount: data.total });
    await sendgrid.send({ to: user.email, subject: 'Order confirmed' });
    return result;
  }
}
// Como testar sem bater no DB, Stripe e SendGrid reais?

// FIX — Injeção de dependência
class OrderService {
  constructor(userRepo, paymentGateway, mailer) {
    this.userRepo = userRepo;
    this.paymentGateway = paymentGateway;
    this.mailer = mailer;
  }
  async create(data) {
    const user = await this.userRepo.findById(data.userId);
    const result = await this.paymentGateway.charge(data.total);
    await this.mailer.send(user.email, 'Order confirmed');
    return result;
  }
}
// Teste: injetar mocks
const service = new OrderService(mockUserRepo, mockPayment, mockMailer);
```

### Checklist de testabilidade

```
Ao revisar código, verificar:
  - Funções puras (sem side effects) para lógica de negócio?
  - Dependências injetáveis (DB, APIs externas, email)?
  - Sem estado global/singleton escondido?
  - Funções pequenas e com responsabilidade única?
  - Sem Date.now() ou Math.random() diretamente (mockável)?
  - Sem leitura de env vars dentro da lógica (recebe por parâmetro)?
  - Erros tipados (não throw string)?
```

---

## 5. Mocking — Quando e Como

### Quando mockar

```
MOCKAR:
  - Banco de dados (em testes unitários)
  - APIs externas (Stripe, SendGrid, Google)
  - Sistema de arquivos
  - Clock (Date.now, setTimeout)
  - Randomness (Math.random, UUID)

NAO MOCKAR:
  - A própria lógica que está testando
  - Utilitários simples (formatDate, calculateTax)
  - Estruturas de dados (Arrays, Maps)
  - Banco de dados (em testes de integração — usar DB real)
```

### Padrões de mock

```javascript
// Jest — Mock de módulo
jest.mock('./database');
const db = require('./database');
db.query.mockResolvedValue([{ id: 1, name: 'Test' }]);

// Jest — Mock de função
const sendEmail = jest.fn().mockResolvedValue({ success: true });
const service = new NotificationService(sendEmail);
await service.notifyUser(user);
expect(sendEmail).toHaveBeenCalledWith(user.email, expect.any(String));

// Jest — Spy (observar chamada sem substituir)
const spy = jest.spyOn(console, 'error').mockImplementation();
await riskyOperation();
expect(spy).toHaveBeenCalled();
spy.mockRestore();
```

```python
# Pytest — Mock
from unittest.mock import MagicMock, patch

@patch('services.payment.stripe')
def test_process_payment(mock_stripe):
    mock_stripe.charges.create.return_value = {'id': 'ch_123', 'status': 'succeeded'}
    result = process_payment(amount=1000)
    assert result.status == 'succeeded'
    mock_stripe.charges.create.assert_called_once_with(amount=1000)
```

### Anti-patterns de mocking

```javascript
// MEDIUM — Mock que retorna mock que retorna mock
const mockDb = {
  query: jest.fn().mockReturnValue({
    then: jest.fn().mockReturnValue({
      catch: jest.fn()
    })
  })
};
// Se precisa de 3 niveis de mock, o código é difícil de testar

// MEDIUM — Mockar TUDO (teste não testa nada)
// Se mockamos userRepo, paymentGateway, mailer, logger, e config...
// O que sobra para testar? Apenas a cola entre os mocks.
// Regra: Se o teste tem mais mocks que asserts, algo está errado.

// MEDIUM — Mock de implementação interna
jest.spyOn(service, '_privateHelper'); // Testar internal = frágil
// Testes devem testar COMPORTAMENTO público, não implementação interna
```

---

## 6. Padrões de Teste por Camada

### Unitário — Lógica de negócio

```javascript
// Testar: calculateDiscount, validateOrder, formatCurrency
describe('calculateDiscount', () => {
  it('should return 0 for orders under minimum amount', () => {
    expect(calculateDiscount(49.99, 'SAVE10')).toBe(0);
  });
  it('should apply 10% for valid coupon', () => {
    expect(calculateDiscount(100, 'SAVE10')).toBe(10);
  });
  it('should cap discount at maxDiscount', () => {
    expect(calculateDiscount(10000, 'SAVE10')).toBe(50); // max 50
  });
  it('should throw for expired coupon', () => {
    expect(() => calculateDiscount(100, 'EXPIRED')).toThrow(CouponExpiredError);
  });
});
```

### Integração — API endpoints

```javascript
// Testar: POST /api/orders (com DB real em container)
describe('POST /api/orders', () => {
  beforeEach(async () => {
    await db.migrate.latest();
    await db.seed.run();
  });
  afterEach(async () => {
    await db.migrate.rollback();
  });

  it('should create order and return 201', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ items: [{ productId: 1, quantity: 2 }] });

    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data.status).toBe('pending');

    // Verificar que realmente salvou no DB
    const order = await db('orders').where({ id: res.body.data.id }).first();
    expect(order).toBeDefined();
  });

  it('should return 401 without auth token', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({ items: [{ productId: 1, quantity: 2 }] });
    expect(res.status).toBe(401);
  });

  it('should return 400 for empty items', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ items: [] });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
```

### Testes que o reviewer deve sugerir

Ao revisar código NOVO, identificar quais testes faltam:

```
Para uma nova rota de API:
  - Happy path (request válido retorna sucesso)
  - Sem autenticação (401)
  - Sem autorização / recurso de outro user (403)
  - Input inválido (400)
  - Recurso não encontrado (404)
  - Caso de conflito se aplicável (409)

Para nova lógica de negócio:
  - Caso normal
  - Limites (zero, máximo, primeiro, último)
  - Input inválido (null, vazio, tipo errado)
  - Edge cases do domínio (meia-noite, DST, fuso)

Para nova integração externa:
  - API retorna sucesso
  - API retorna erro
  - API timeout
  - API retorna dados inesperados
```

---

## 7. Anti-Patterns de Testes

| Anti-Pattern | Problema | Fix |
|-------------|---------|-----|
| **Test sem assert** | Teste passa mas não verifica nada | Sempre ter expect() |
| **Assert no console.log** | Olho humano no lugar de assert automático | Substituir por expect() |
| **Teste dependente de ordem** | Teste B falha se A não rodar antes | Cada teste é independente |
| **Teste que testa framework** | Verificar que express retorna JSON | Testar SUA lógica |
| **Snapshot overuse** | Snapshot de 500 linhas, ninguém revisa diff | Snapshot apenas para UI estável |
| **Sleeps no teste** | await sleep(2000) para esperar async | Usar waitFor, retry, ou mock timer |
| **Teste lento** | Unitário que leva 5s | Mock I/O, não bater em serviço real |
| **Teste frágil** | Quebra quando muda implementação mas não comportamento | Testar comportamento público |
| **God test** | Um teste com 50 asserts | 1 conceito por teste |
| **Dados aleatórios sem seed** | Testa com Math.random, falha intermitentemente | Dados fixos ou seed controlado |

---

## 8. Sugestão de Testes no Review

### Template de sugestão

Ao encontrar código sem testes, sugerir no formato:

```markdown
### MEDIUM: Falta cobertura de testes para OrderService.create

**Testes sugeridos:**

1. `should create order successfully with valid items`
2. `should throw ValidationError when items array is empty`
3. `should throw NotFoundError when product does not exist`
4. `should decrement inventory after order creation`
5. `should rollback if payment fails`
6. `should handle concurrent orders for same product (stock check)`

**Exemplo de teste para o caso 1:**
[incluir código do teste]

**Prioridade:** Casos 1, 2, 5 são obrigatórios antes do merge.
Casos 3, 4, 6 podem ser adicionados na mesma sprint.
```
