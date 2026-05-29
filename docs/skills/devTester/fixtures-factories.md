# Fixtures & Factories — Infraestrutura de Dados de Teste

## Índice
1. Factories — Gerar Dados Realistas
2. Fixtures — Estado Reutilizável
3. Mocks, Stubs e Spies
4. Test Database
5. Helpers e Utils de Teste
6. Seed Data vs Factory Data

---

## 1. Factories — Gerar Dados Realistas

### Princípio

```
Cada teste cria seus PRÓPRIOS dados. Nunca depender de estado
deixado por outro teste. Factory é a ferramenta para isso.

Factory = função que gera um objeto completo e válido com
valores default sensatos, permitindo override do que importa
para AQUELE teste específico.
```

### JavaScript/TypeScript (com Faker)

```typescript
// tests/factories/user-factory.ts
import { faker } from '@faker-js/faker';

interface UserFactoryOverrides {
  name?: string;
  email?: string;
  role?: 'admin' | 'user';
  status?: 'active' | 'inactive';
}

export function buildUser(overrides: UserFactoryOverrides = {}) {
  return {
    id: faker.string.uuid(),
    name: overrides.name ?? faker.person.fullName(),
    email: overrides.email ?? faker.internet.email().toLowerCase(),
    passwordHash: '$2b$12$fakehashfortesting',
    role: overrides.role ?? 'user',
    status: overrides.status ?? 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// Factory que persiste no banco (integration tests)
export async function createUser(
  db: Database,
  overrides: UserFactoryOverrides = {}
) {
  const data = buildUser(overrides);
  const user = await db.user.create({ data });
  return user;
}
```

```typescript
// tests/factories/order-factory.ts
import { faker } from '@faker-js/faker';

export function buildOrder(overrides = {}) {
  return {
    id: faker.string.uuid(),
    userId: faker.string.uuid(),
    status: 'pending',
    items: [
      {
        productId: faker.string.uuid(),
        name: faker.commerce.productName(),
        quantity: faker.number.int({ min: 1, max: 5 }),
        unitPrice: faker.number.int({ min: 500, max: 50000 }),
      },
    ],
    subtotal: 0, // calculado
    discount: 0,
    shipping: 1500,
    total: 0, // calculado
    createdAt: new Date(),
    ...overrides,
  };
}

export function buildOrderItem(overrides = {}) {
  return {
    productId: faker.string.uuid(),
    name: faker.commerce.productName(),
    quantity: 1,
    unitPrice: faker.number.int({ min: 500, max: 50000 }),
    ...overrides,
  };
}
```

### Uso nos testes

```typescript
// Cada teste declara APENAS o que é relevante
describe('OrderService.calculateTotal', () => {
  it('should sum item totals plus shipping', () => {
    const order = buildOrder({
      items: [
        buildOrderItem({ quantity: 2, unitPrice: 1000 }),
        buildOrderItem({ quantity: 1, unitPrice: 500 }),
      ],
      shipping: 1500,
      discount: 0,
    });
    // Leitor entende: 2×1000 + 1×500 + 1500 = 4000
    expect(calculateTotal(order)).toBe(4000);
  });

  it('should apply discount before adding shipping', () => {
    const order = buildOrder({
      items: [buildOrderItem({ quantity: 1, unitPrice: 10000 })],
      shipping: 1500,
      discount: 1000,
    });
    // 10000 - 1000 + 1500 = 10500
    expect(calculateTotal(order)).toBe(10500);
  });
});
```

### Python (com Faker + factory_boy)

```python
# tests/factories.py
import factory
from faker import Faker
from app.models import User, Order

fake = Faker('pt_BR')

class UserFactory(factory.Factory):
    class Meta:
        model = User

    id = factory.LazyFunction(lambda: str(fake.uuid4()))
    name = factory.LazyFunction(fake.name)
    email = factory.LazyFunction(fake.email)
    role = 'user'
    status = 'active'

class OrderFactory(factory.Factory):
    class Meta:
        model = Order

    id = factory.LazyFunction(lambda: str(fake.uuid4()))
    user_id = factory.LazyFunction(lambda: str(fake.uuid4()))
    status = 'pending'
    total = factory.LazyFunction(lambda: fake.random_int(min=1000, max=100000))

# Uso
user = UserFactory(role='admin')
order = OrderFactory(user_id=user.id, status='paid')
```

---

## 2. Fixtures — Estado Reutilizável

### Jest / Vitest

```typescript
// tests/fixtures/auth-fixtures.ts
export const validToken = 'eyJhbGciOiJIUzI1NiIs...'; // Token de teste fixo
export const expiredToken = 'eyJhbGciOiJIUzI1NiIs...';
export const adminToken = 'eyJhbGciOiJIUzI1NiIs...';

// Fixtures de response
export const stripeChargeSuccess = {
  id: 'ch_test_123',
  status: 'succeeded',
  amount: 5000,
  currency: 'brl',
};

export const stripeChargeDeclined = {
  error: {
    type: 'card_error',
    code: 'card_declined',
    message: 'Your card was declined.',
  },
};
```

### Pytest

```python
# tests/conftest.py
import pytest
from app import create_app
from app.database import db as _db

@pytest.fixture(scope='session')
def app():
    """Cria app de teste uma vez por sessão."""
    app = create_app('testing')
    yield app

@pytest.fixture(scope='function')
def db(app):
    """DB limpo para cada teste."""
    with app.app_context():
        _db.create_all()
        yield _db
        _db.session.rollback()
        _db.drop_all()

@pytest.fixture
def client(app):
    """Test client HTTP."""
    return app.test_client()

@pytest.fixture
def auth_headers(client):
    """Headers com token válido."""
    response = client.post('/auth/login', json={
        'email': 'test@example.com',
        'password': 'password123',
    })
    token = response.json['data']['accessToken']
    return {'Authorization': f'Bearer {token}'}
```

---

## 3. Mocks, Stubs e Spies

### Diferenças

```
STUB  — Retorna valor fixo. Não verifica chamada.
         "Quando chamar getUser(), retorne este objeto."

MOCK  — Retorna valor fixo + verifica que foi chamado corretamente.
         "Deve chamar getUser(id) exatamente 1 vez com id='123'."

SPY   — Chama a implementação REAL + registra a chamada.
         "Chamou sendEmail() com esses args? Ok, mas executou de verdade."
```

### Jest — Mocking

```typescript
// Mock de módulo inteiro
jest.mock('../services/email-service');
import { EmailService } from '../services/email-service';
const mockEmailService = jest.mocked(EmailService);

// Mock de função específica
const sendEmail = jest.fn().mockResolvedValue({ sent: true });

// Mock com implementação
jest.fn().mockImplementation((userId) => {
  if (userId === 'not-found') return null;
  return buildUser({ id: userId });
});

// Spy (observar sem substituir)
const spy = jest.spyOn(orderService, 'calculateTotal');
// ... executar código ...
expect(spy).toHaveBeenCalledWith(expect.objectContaining({ id: orderId }));
spy.mockRestore();
```

### Quando mockar

```
MOCKAR:
├── APIs externas (Stripe, SendGrid, AWS)
├── Database (em unit tests — NÃO em integration)
├── Clock (Date.now, timers)
├── Randomness (Math.random, crypto.randomUUID)
├── File system (em unit tests)
├── Serviços caros/lentos (IA, OCR, PDF generation)
└── Event emitters (para verificar que eventos foram emitidos)

NÃO MOCKAR:
├── A lógica que está sendo testada (mock derrota o propósito)
├── Funções puras simples (utils, helpers)
├── Database em integration tests (usar DB real/container)
├── Estruturas de dados (arrays, maps, sets)
└── Código interno do mesmo módulo (testar via interface pública)

RED FLAG — mock de mock de mock:
  Se precisa mockar 3+ camadas, o código está acoplado demais.
  Refatorar para dependency injection antes de testar.
```

### MSW — Mock Service Worker (APIs externas em integration)

```typescript
// tests/mocks/handlers.ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.post('https://api.stripe.com/v1/charges', () => {
    return HttpResponse.json({
      id: 'ch_test_123',
      status: 'succeeded',
      amount: 5000,
    });
  }),

  http.post('https://api.sendgrid.com/v3/mail/send', () => {
    return new HttpResponse(null, { status: 202 });
  }),
];

// tests/setup.ts
import { setupServer } from 'msw/node';
import { handlers } from './mocks/handlers';
export const server = setupServer(...handlers);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

---

## 4. Test Database

### Estratégias

| Estratégia | Prós | Contras | Quando usar |
|-----------|------|---------|-------------|
| **SQLite in-memory** | Ultra rápido, sem setup | Diferenças de SQL vs Postgres | Projetos simples |
| **Testcontainers** | DB real (Postgres), isolado | Mais lento para iniciar | Recomendado |
| **DB compartilhado** | Zero setup | Conflitos entre testes | Evitar |
| **Transaction rollback** | Rápido, isolado | Não testa commits reais | Unit-ish |

### Testcontainers (recomendado)

```typescript
// tests/setup/test-db.ts
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { PrismaClient } from '@prisma/client';

let container;
let prisma;

export async function setupTestDB() {
  container = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('test')
    .start();

  process.env.DATABASE_URL = container.getConnectionUri();
  prisma = new PrismaClient();

  // Rodar migrations
  await execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: container.getConnectionUri() },
  });

  return prisma;
}

export async function teardownTestDB() {
  await prisma?.$disconnect();
  await container?.stop();
}

export async function cleanDB(prisma) {
  // Limpar tabelas na ordem correta (FK constraints)
  await prisma.$transaction([
    prisma.orderItem.deleteMany(),
    prisma.order.deleteMany(),
    prisma.user.deleteMany(),
  ]);
}
```

---

## 5. Helpers e Utils de Teste

```typescript
// tests/helpers/api-helper.ts
import supertest from 'supertest';
import { app } from '../../src/app';

const request = supertest(app);

export async function loginAs(role: 'admin' | 'user' = 'user') {
  const user = await createUser(db, { role });
  const response = await request.post('/api/auth/login').send({
    email: user.email,
    password: 'Test@123',
  });
  return {
    user,
    token: response.body.data.accessToken,
    auth: { Authorization: `Bearer ${response.body.data.accessToken}` },
  };
}

export function expectError(response, statusCode, errorCode) {
  expect(response.status).toBe(statusCode);
  expect(response.body.error).toBeDefined();
  expect(response.body.error.code).toBe(errorCode);
}

export function expectPagination(response) {
  expect(response.body.pagination).toBeDefined();
  expect(response.body.pagination).toHaveProperty('limit');
  expect(response.body.pagination).toHaveProperty('hasMore');
}
```

---

## 6. Seed Data vs Factory Data

```
SEED DATA — Dados fixos pré-carregados:
  Uso: E2E tests, demos, staging
  Exemplo: 5 users fixos, 10 products com IDs conhecidos
  Vantagem: Previsível, screenshots consistentes
  Desvantagem: Frágil se o schema muda

FACTORY DATA — Dados gerados por teste:
  Uso: Unit e integration tests
  Exemplo: buildUser(), createOrder()
  Vantagem: Independente, auto-documentado, isolado
  Desvantagem: Precisa manter as factories

Regra: Factories para unit/integration, seeds para E2E/staging.
```

```typescript
// seeds/test-seed.ts (para E2E)
export async function seedTestData(db) {
  const admin = await db.user.create({
    data: {
      id: 'user-admin-001',
      name: 'Admin Test',
      email: 'admin@test.com',
      passwordHash: await hash('Admin@123'),
      role: 'admin',
    },
  });

  const user = await db.user.create({
    data: {
      id: 'user-test-001',
      name: 'User Test',
      email: 'user@test.com',
      passwordHash: await hash('User@123'),
      role: 'user',
    },
  });

  // Produtos com IDs fixos (E2E referencia por ID)
  await db.product.createMany({
    data: [
      { id: 'prod-001', name: 'Widget A', price: 2990, stock: 100 },
      { id: 'prod-002', name: 'Widget B', price: 4990, stock: 50 },
      { id: 'prod-003', name: 'Widget C', price: 9990, stock: 0 }, // sem estoque
    ],
  });

  return { admin, user };
}
```
