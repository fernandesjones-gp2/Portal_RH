# Integration Testing — API, Database e Serviços

## Índice
1. O Que é Integration Test
2. API Tests com Supertest
3. Database Tests
4. Testcontainers
5. Testes por Endpoint (Receita)
6. Pytest + FastAPI / Flask
7. Ambiente de Test Isolado

---

## 1. O Que é Integration Test

```
Unit test: testa UMA unidade com tudo mockado ao redor.
Integration test: testa MÚLTIPLAS unidades trabalhando juntas.

O que é "integração":
├── Controller + Middleware + Service + DB (API test)
├── Service + Repository + DB real (data layer test)
├── Service + HTTP client + API externa mockada (MSW)
└── Worker + Queue + Service (job processing)

Regra: integration test usa dependências REAIS quando possível
(DB real, HTTP real), e mocka apenas o que é externo/caro
(Stripe, SendGrid, AWS).
```

---

## 2. API Tests com Supertest (Node.js)

### Setup

```typescript
// tests/integration/setup.ts
import supertest from 'supertest';
import { app } from '../../src/app';
import { prisma } from '../../src/database';

export const request = supertest(app);

beforeEach(async () => {
  // Limpar banco antes de cada teste
  await prisma.$transaction([
    prisma.orderItem.deleteMany(),
    prisma.order.deleteMany(),
    prisma.product.deleteMany(),
    prisma.user.deleteMany(),
  ]);
});

afterAll(async () => {
  await prisma.$disconnect();
});
```

### Teste completo de endpoint

```typescript
// tests/integration/orders.test.ts
import { request } from './setup';
import { createUser, createProduct } from '../factories';
import { prisma } from '../../src/database';

describe('POST /api/v1/orders', () => {
  let user;
  let token;
  let product;

  beforeEach(async () => {
    // Criar dados necessários
    user = await createUser(prisma, { role: 'user' });
    product = await createProduct(prisma, { price: 2990, stock: 10 });

    // Fazer login para obter token
    const loginRes = await request.post('/api/v1/auth/login').send({
      email: user.email,
      password: 'Test@123',
    });
    token = loginRes.body.data.accessToken;
  });

  it('should create order and return 201', async () => {
    const response = await request
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [{ productId: product.id, quantity: 2 }],
        shippingAddressId: user.addressId,
      });

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      status: 'pending',
      items: expect.arrayContaining([
        expect.objectContaining({
          productId: product.id,
          quantity: 2,
        }),
      ]),
    });
    expect(response.body.data.id).toBeDefined();

    // Verificar que o banco foi atualizado
    const dbOrder = await prisma.order.findUnique({
      where: { id: response.body.data.id },
      include: { items: true },
    });
    expect(dbOrder).not.toBeNull();
    expect(dbOrder.items).toHaveLength(1);

    // Verificar que o estoque diminuiu
    const dbProduct = await prisma.product.findUnique({ where: { id: product.id } });
    expect(dbProduct.stock).toBe(8); // 10 - 2
  });

  it('should return 400 when items is empty', async () => {
    const response = await request
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [] });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should return 401 when no token', async () => {
    const response = await request
      .post('/api/v1/orders')
      .send({ items: [{ productId: product.id, quantity: 1 }] });

    expect(response.status).toBe(401);
  });

  it('should return 422 when stock is insufficient', async () => {
    const response = await request
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [{ productId: product.id, quantity: 999 }], // mais que estoque
      });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('INSUFFICIENT_STOCK');
  });

  it('should return 404 when product does not exist', async () => {
    const response = await request
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [{ productId: '00000000-0000-0000-0000-000000000000', quantity: 1 }],
      });

    expect(response.status).toBe(404);
  });
});
```

---

## 3. Database Tests

### Testar queries/repositories

```typescript
// tests/integration/repositories/order-repository.test.ts
describe('OrderRepository', () => {
  let orderRepo: OrderRepository;

  beforeEach(async () => {
    orderRepo = new OrderRepository(prisma);
    // Criar dados base
    await createUser(prisma, { id: 'user-1' });
  });

  describe('findByUserId', () => {
    it('should return only orders from the specified user', async () => {
      await createUser(prisma, { id: 'user-2' });
      await createOrder(prisma, { userId: 'user-1', status: 'pending' });
      await createOrder(prisma, { userId: 'user-1', status: 'paid' });
      await createOrder(prisma, { userId: 'user-2', status: 'pending' });

      const orders = await orderRepo.findByUserId('user-1');

      expect(orders).toHaveLength(2);
      orders.forEach(o => expect(o.userId).toBe('user-1'));
    });

    it('should return empty array when user has no orders', async () => {
      const orders = await orderRepo.findByUserId('user-1');
      expect(orders).toEqual([]);
    });

    it('should support cursor-based pagination', async () => {
      // Criar 5 orders
      for (let i = 0; i < 5; i++) {
        await createOrder(prisma, { userId: 'user-1' });
      }

      const page1 = await orderRepo.findByUserId('user-1', { limit: 2 });
      expect(page1).toHaveLength(2);

      const page2 = await orderRepo.findByUserId('user-1', {
        limit: 2,
        cursor: page1[page1.length - 1].id,
      });
      expect(page2).toHaveLength(2);
      expect(page2[0].id).not.toBe(page1[0].id); // Páginas diferentes
    });
  });

  describe('updateStatus', () => {
    it('should update status and return updated order', async () => {
      const order = await createOrder(prisma, { userId: 'user-1', status: 'pending' });

      const updated = await orderRepo.updateStatus(order.id, 'paid');

      expect(updated.status).toBe('paid');
      // Verificar no banco
      const fromDb = await prisma.order.findUnique({ where: { id: order.id } });
      expect(fromDb.status).toBe('paid');
    });
  });
});
```

---

## 4. Testcontainers

```typescript
// tests/integration/setup-containers.ts
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer, StartedRedisContainer } from '@testcontainers/redis';
import { execSync } from 'child_process';

let pgContainer: StartedPostgreSqlContainer;
let redisContainer: StartedRedisContainer;

beforeAll(async () => {
  // Subir containers (uma vez por suite)
  pgContainer = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('test_db')
    .start();

  redisContainer = await new RedisContainer('redis:7-alpine').start();

  // Configurar env
  process.env.DATABASE_URL = pgContainer.getConnectionUri();
  process.env.REDIS_URL = redisContainer.getConnectionUri();

  // Rodar migrations
  execSync('npx prisma migrate deploy', { env: process.env });
}, 60_000); // Timeout de 60s para subir containers

afterAll(async () => {
  await pgContainer?.stop();
  await redisContainer?.stop();
});
```

---

## 5. Receita: Testes por Endpoint

Para CADA novo endpoint, escrever estes testes:

```
POST /api/resource (criar):
├── 201 — Criação com sucesso (happy path)
├── 400 — Cada campo obrigatório ausente
├── 400 — Cada campo com formato inválido
├── 401 — Sem autenticação
├── 403 — Sem autorização (role errado)
├── 409 — Conflito (recurso duplicado, se aplicável)
├── 422 — Regra de negócio violada

GET /api/resource (listar):
├── 200 — Lista com dados
├── 200 — Lista vazia
├── 200 — Paginação funciona
├── 200 — Filtros funcionam
├── 401 — Sem autenticação

GET /api/resource/:id (detalhar):
├── 200 — Recurso encontrado
├── 401 — Sem autenticação
├── 404 — ID não existe
├── 404 — ID existe mas pertence a outro user (IDOR)

PUT/PATCH /api/resource/:id (atualizar):
├── 200 — Atualização com sucesso
├── 400 — Dados inválidos
├── 401 — Sem autenticação
├── 404 — Não encontrado
├── 409 — Conflito (se aplicável)

DELETE /api/resource/:id (remover):
├── 204 — Removido com sucesso
├── 401 — Sem autenticação
├── 404 — Não encontrado
├── 409 — Não pode remover (dependências)
```

---

## 6. Pytest + FastAPI

```python
# tests/integration/test_orders.py
import pytest
from httpx import AsyncClient
from app.main import app

@pytest.fixture
async def client():
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac

@pytest.fixture
async def auth_headers(client, db_session):
    user = UserFactory(role='user')
    db_session.add(user)
    await db_session.commit()
    response = await client.post('/api/v1/auth/login', json={
        'email': user.email,
        'password': 'Test@123',
    })
    token = response.json()['data']['accessToken']
    return {'Authorization': f'Bearer {token}'}, user

class TestCreateOrder:
    async def test_creates_order_successfully(self, client, auth_headers, db_session):
        headers, user = auth_headers
        product = ProductFactory(stock=10, price=2990)
        db_session.add(product)
        await db_session.commit()

        response = await client.post('/api/v1/orders', headers=headers, json={
            'items': [{'product_id': str(product.id), 'quantity': 2}],
        })

        assert response.status_code == 201
        data = response.json()['data']
        assert data['status'] == 'pending'
        assert len(data['items']) == 1

    async def test_returns_401_without_token(self, client):
        response = await client.post('/api/v1/orders', json={'items': []})
        assert response.status_code == 401

    async def test_returns_422_insufficient_stock(self, client, auth_headers, db_session):
        headers, _ = auth_headers
        product = ProductFactory(stock=1)
        db_session.add(product)
        await db_session.commit()

        response = await client.post('/api/v1/orders', headers=headers, json={
            'items': [{'product_id': str(product.id), 'quantity': 99}],
        })

        assert response.status_code == 422
        assert response.json()['error']['code'] == 'INSUFFICIENT_STOCK'
```

---

## 7. Ambiente de Test Isolado

```
Checklist de isolamento:
├── DB separado (test_ prefix ou container efêmero)
├── Redis separado (DB index diferente ou container)
├── Variáveis de ambiente de teste (.env.test)
├── Mock de APIs externas (MSW, VCR, WireMock)
├── Seeds/fixtures rodados antes de cada teste ou suite
├── Limpeza após cada teste (truncate ou rollback)
├── CI roda em ambiente limpo (docker compose)
└── Nenhum teste depende de dados de outro teste
```

```yaml
# docker-compose.test.yml
services:
  test-db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: test_db
      POSTGRES_USER: test
      POSTGRES_PASSWORD: test
    ports:
      - "5433:5432"
    tmpfs:
      - /var/lib/postgresql/data  # RAM = rápido

  test-redis:
    image: redis:7-alpine
    ports:
      - "6380:6379"
```
