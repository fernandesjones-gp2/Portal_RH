# Unit Testing — Jest, Vitest, Pytest, Patterns e Edge Cases

## Índice
1. Anatomia de um Bom Teste
2. Naming — O Nome Conta a História
3. Jest / Vitest — Patterns
4. Pytest — Patterns
5. O Que Testar por Tipo de Código
6. Edge Cases Checklist
7. Anti-Patterns

---

## 1. Anatomia de um Bom Teste

### AAA — Arrange, Act, Assert

```typescript
describe('DiscountService.apply', () => {
  it('should apply percentage discount to order total', () => {
    // ARRANGE — Preparar dados e dependências
    const order = buildOrder({ subtotal: 10000 });
    const coupon = buildCoupon({ type: 'percentage', value: 10 });

    // ACT — Executar a ação sendo testada
    const result = discountService.apply(order, coupon);

    // ASSERT — Verificar o resultado
    expect(result.discount).toBe(1000); // 10% de 10000
    expect(result.total).toBe(9000);    // 10000 - 1000
  });
});
```

### Regras

```
1. UM conceito por teste (não testar 5 coisas num it())
2. Arrange CURTO — se precisa de 20 linhas, usar factory
3. Act ÚNICO — uma chamada, um resultado
4. Assert ESPECÍFICO — toBe() > toBeTruthy()
5. Independente — rodar em qualquer ordem, resultado igual
6. Determinístico — sem Math.random(), Date.now() direto
7. Rápido — < 50ms por teste unitário
```

---

## 2. Naming — O Nome Conta a História

### Padrão: should [expected] when [condition]

```typescript
// ✅ Bom — leio o nome e entendo o cenário
it('should return free shipping when order total exceeds R$200')
it('should throw ValidationError when email is empty')
it('should apply 10% discount when coupon is valid and not expired')
it('should return empty array when user has no orders')
it('should hash password with bcrypt cost 12')

// ❌ Ruim — não entendo o cenário sem ler o código
it('test order')
it('works correctly')
it('should work')
it('discount test')
it('handles edge case')
```

### Organização com describe

```typescript
describe('OrderService', () => {
  describe('create', () => {
    it('should create order with valid items', () => {});
    it('should throw when items array is empty', () => {});
    it('should throw when product has insufficient stock', () => {});
    it('should apply coupon discount if coupon code is valid', () => {});
  });

  describe('cancel', () => {
    it('should change status to cancelled', () => {});
    it('should restore product stock', () => {});
    it('should throw when order is already shipped', () => {});
  });

  describe('calculateTotal', () => {
    it('should sum items × quantity × price', () => {});
    it('should add shipping cost', () => {});
    it('should subtract discount', () => {});
    it('should return 0 when total would be negative', () => {});
  });
});
```

---

## 3. Jest / Vitest — Patterns

### Testar valores de retorno

```typescript
describe('formatCurrency', () => {
  it('should format centavos to BRL string', () => {
    expect(formatCurrency(1990)).toBe('R$ 19,90');
  });

  it('should handle zero', () => {
    expect(formatCurrency(0)).toBe('R$ 0,00');
  });

  it('should handle large values', () => {
    expect(formatCurrency(9999999)).toBe('R$ 99.999,99');
  });
});
```

### Testar exceções

```typescript
describe('UserService.create', () => {
  it('should throw ValidationError when email is invalid', () => {
    expect(() => userService.create({ email: 'not-an-email', name: 'Test' }))
      .toThrow(ValidationError);
  });

  // Async
  it('should throw ConflictError when email already exists', async () => {
    mockUserRepo.findByEmail.mockResolvedValue(buildUser());

    await expect(userService.create({ email: 'existing@test.com', name: 'Test' }))
      .rejects.toThrow(ConflictError);
  });
});
```

### Testar com mocks

```typescript
describe('OrderService.create', () => {
  let orderService: OrderService;
  let mockOrderRepo: jest.Mocked<OrderRepository>;
  let mockProductRepo: jest.Mocked<ProductRepository>;
  let mockPaymentClient: jest.Mocked<PaymentClient>;

  beforeEach(() => {
    mockOrderRepo = {
      create: jest.fn(),
      findById: jest.fn(),
    } as any;
    mockProductRepo = {
      findById: jest.fn(),
      updateStock: jest.fn(),
    } as any;
    mockPaymentClient = {
      charge: jest.fn(),
    } as any;

    orderService = new OrderService(mockOrderRepo, mockProductRepo, mockPaymentClient);
  });

  it('should create order and deduct stock', async () => {
    const product = buildProduct({ id: 'p1', stock: 10, price: 2000 });
    mockProductRepo.findById.mockResolvedValue(product);
    mockOrderRepo.create.mockResolvedValue(buildOrder({ id: 'o1' }));

    const result = await orderService.create({
      userId: 'u1',
      items: [{ productId: 'p1', quantity: 2 }],
    });

    expect(mockProductRepo.updateStock).toHaveBeenCalledWith('p1', 8);
    expect(mockOrderRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1', status: 'pending' })
    );
    expect(result.id).toBe('o1');
  });

  it('should throw when product stock is insufficient', async () => {
    const product = buildProduct({ stock: 1 });
    mockProductRepo.findById.mockResolvedValue(product);

    await expect(
      orderService.create({ userId: 'u1', items: [{ productId: 'p1', quantity: 5 }] })
    ).rejects.toThrow('Estoque insuficiente');

    expect(mockOrderRepo.create).not.toHaveBeenCalled();
  });
});
```

### Testar código com tempo (timers, Date)

```typescript
describe('TokenService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-01-15T10:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should generate token expiring in 15 minutes', () => {
    const token = tokenService.generateAccess({ userId: '123' });
    const decoded = jwt.decode(token);
    // 10:00 + 15min = 10:15 = timestamp 1736935500
    expect(decoded.exp).toBe(Math.floor(new Date('2025-01-15T10:15:00Z').getTime() / 1000));
  });

  it('should reject expired token', () => {
    const token = tokenService.generateAccess({ userId: '123' });
    // Avançar 16 minutos
    jest.advanceTimersByTime(16 * 60 * 1000);
    expect(() => tokenService.verify(token)).toThrow('Token expirado');
  });
});
```

---

## 4. Pytest — Patterns

### Testes parametrizados

```python
import pytest
from app.services.shipping import calculate_shipping

@pytest.mark.parametrize("total,state,expected", [
    (25000, 'SP', 1500),     # SP = R$15
    (25000, 'RJ', 2500),     # RJ = R$25
    (25000, 'AM', 4500),     # AM = R$45
    (20001, 'SP', 0),        # Frete grátis acima de R$200
    (20000, 'SP', 1500),     # Exatamente R$200 paga frete
    (0, 'SP', 1500),         # Zero paga frete normal
])
def test_calculate_shipping(total, state, expected):
    assert calculate_shipping(total, state) == expected

@pytest.mark.parametrize("email", [
    "",
    "not-an-email",
    "@missing-local.com",
    "missing-domain@",
    "spaces in@email.com",
])
def test_validate_email_rejects_invalid(email):
    with pytest.raises(ValidationError):
        validate_email(email)
```

### Fixtures com Pytest

```python
@pytest.fixture
def order_service(mock_order_repo, mock_product_repo):
    return OrderService(
        order_repo=mock_order_repo,
        product_repo=mock_product_repo,
    )

@pytest.fixture
def mock_order_repo(mocker):
    repo = mocker.MagicMock()
    repo.create.return_value = OrderFactory(status='pending')
    return repo

class TestOrderServiceCreate:
    def test_creates_order_with_valid_items(self, order_service, mock_order_repo):
        result = order_service.create(user_id='u1', items=[{'product_id': 'p1', 'quantity': 2}])
        mock_order_repo.create.assert_called_once()
        assert result.status == 'pending'

    def test_raises_when_stock_insufficient(self, order_service, mock_product_repo):
        mock_product_repo.find_by_id.return_value = ProductFactory(stock=0)
        with pytest.raises(InsufficientStockError):
            order_service.create(user_id='u1', items=[{'product_id': 'p1', 'quantity': 1}])
```

---

## 5. O Que Testar por Tipo de Código

### Services (lógica de negócio) — PRIORIDADE MÁXIMA

```
Testar:
├── Happy path (fluxo normal)
├── Cada regra de negócio
├── Validações de input
├── Edge cases do domínio (zero, limite, overflow)
├── Erros esperados (exceções de negócio)
└── Interação com dependências (mocks — chamou? com o quê?)

Não testar:
├── A query SQL em si (isso é integration test)
├── Que o mock funciona (você controla o mock)
└── Log output
```

### Validators / Schemas — Alta cobertura, fácil

```
Testar:
├── Input válido → passa
├── Cada campo obrigatório ausente → erro específico
├── Cada formato inválido → erro específico
├── Limites (min/max length, min/max value)
└── Tipos errados (string onde espera number)
```

### Utils / Pure Functions — Tabela de input/output

```
Testar com parametrize:
├── Valores normais
├── Valores de borda (0, -1, MAX, vazio, null)
├── Tipos especiais (NaN, Infinity, undefined)
└── Formatos diferentes (com/sem acento, maiúscula/minúscula)
```

---

## 6. Edge Cases Checklist

```
Para QUALQUER função, considerar:

Strings:
├── Vazia ("")
├── Com espaços (" ", "  hello  ")
├── Com caracteres especiais (!@#$%^&*)
├── Com acentos (ção, über)
├── Muito longa (1MB string)
├── Com HTML/script tags (XSS)
└── Unicode (emoji, RTL, zero-width chars)

Números:
├── Zero (0)
├── Negativo (-1)
├── Float vs Int (1.5 vs 2)
├── Muito grande (Number.MAX_SAFE_INTEGER)
├── NaN, Infinity, -Infinity
└── String que parece número ("42")

Arrays/Lists:
├── Vazia ([])
├── Um elemento ([x])
├── Duplicatas ([x, x, x])
├── Muito grande (10K+ elementos)
└── Tipos mistos ([1, "2", null])

Null/Undefined:
├── null
├── undefined
├── Campo ausente (chave não existe no objeto)
└── Nested null (user.address.street quando address é null)

Datas:
├── Timezone diferente
├── Horário de verão (DST transition)
├── Fim do mês (28, 29, 30, 31)
├── Ano bissexto (29 de fevereiro)
└── Formato ISO vs local

Concorrência:
├── Chamada duplicada (double submit)
├── Chamada simultânea (race condition)
└── Estado intermediário (leu antes de salvar)
```

---

## 7. Anti-Patterns

| Anti-Pattern | Problema | Fix |
|-------------|---------|-----|
| Teste sem assert | Não verifica nada, sempre passa | Pelo menos 1 expect por it() |
| Assert no console.log | `console.log(result)` e verificar "no olho" | expect() explícito |
| Teste que testa framework | `expect(express.Router).toBeDefined()` | Testar SEU código |
| Mock everything | Testa que mocks retornam o que pediu, não lógica real | Mockar apenas boundaries |
| Snapshot overuse | 1000 snapshots, ninguém review diffs | Snapshot só para output grande e estável |
| Sleep em teste | `await sleep(2000)` esperando callback | waitFor(), fake timers, ou reestruturar |
| Dados hardcoded gigantes | 50 linhas de JSON copiado no teste | Factories |
| Teste dependente de ordem | Test B falha se Test A não roda antes | Cada teste cria seu estado |
| God test | 1 it() com 30 asserts | Separar em testes focados |
| Teste de implementação | Verifica que chamou método X internamente | Testar RESULTADO, não caminho |
