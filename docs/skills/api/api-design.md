# API Design — REST, Naming, Paginação e Erros

## Índice
1. Naming de Recursos
2. Operações CRUD
3. Paginação
4. Filtros e Ordenação
5. Formato de Resposta
6. Formato de Erros
7. Batch e Bulk Operations
8. GraphQL — Quando e Como

---

## 1. Naming de Recursos

### Regras

```
✅ Substantivos no plural para coleções
   /users, /orders, /products

✅ Singular para sub-recurso específico
   /users/:id, /orders/:id/items/:itemId

✅ Kebab-case para nomes compostos
   /order-items, /shipping-addresses

❌ Verbos no path
   /getUsers, /createOrder, /deleteProduct

❌ CamelCase no path
   /orderItems, /shippingAddresses

❌ Ações no path (exceto operações não-CRUD)
   ❌ /orders/create
   ✅ POST /orders
   ✅ POST /orders/:id/cancel    ← Ação de domínio (exceção aceitável)
   ✅ POST /orders/:id/refund
```

### Hierarquia de recursos

```
/users                          → Coleção de usuários
/users/:id                      → Usuário específico
/users/:id/orders               → Pedidos do usuário
/users/:id/orders/:orderId      → Pedido específico do usuário
/users/:id/orders/:orderId/items → Itens do pedido

Regra: máximo 3 níveis de aninhamento. Acima disso, usar query params:
❌ /users/:id/orders/:orderId/items/:itemId/reviews
✅ /reviews?orderId=X&itemId=Y
```

---

## 2. Operações CRUD

```
GET    /orders              → Listar (com paginação)
GET    /orders/:id          → Detalhar
POST   /orders              → Criar
PUT    /orders/:id          → Substituir completo
PATCH  /orders/:id          → Atualizar parcial
DELETE /orders/:id          → Remover

PUT vs PATCH:
PUT:   Envia TODOS os campos (substitui o recurso inteiro)
PATCH: Envia APENAS os campos que mudam

Ações de domínio (não são CRUD):
POST /orders/:id/cancel     → Cancelar pedido
POST /orders/:id/ship       → Marcar como enviado
POST /payments/:id/refund   → Estornar pagamento
```

### Idempotência por método

| Método | Idempotente? | Safe? | Significado |
|--------|-------------|-------|-------------|
| GET | Sim | Sim | Não muda estado |
| HEAD | Sim | Sim | Igual GET sem body |
| PUT | Sim | Não | Mesmo PUT 2x = mesmo resultado |
| PATCH | Não* | Não | Depende da implementação |
| DELETE | Sim | Não | Deletar 2x = mesmo resultado |
| POST | **Não** | Não | POST 2x pode criar 2 recursos! |

*POST precisa de idempotency key para operações sensíveis.*

---

## 3. Paginação

### Cursor-based (recomendado)

```javascript
// Request
GET /api/orders?limit=20&cursor=eyJpZCI6MTAwfQ

// Response
{
  "data": [...],
  "pagination": {
    "limit": 20,
    "hasMore": true,
    "nextCursor": "eyJpZCI6MTIwfQ",    // Base64 do último ID
    "prevCursor": "eyJpZCI6MTAxfQ"
  }
}
```

Implementação:

```javascript
// Controller
async function listOrders(req, res) {
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const cursor = req.query.cursor
    ? JSON.parse(Buffer.from(req.query.cursor, 'base64').toString())
    : null;

  const orders = await orderService.list({ limit: limit + 1, cursor });
  const hasMore = orders.length > limit;
  const data = hasMore ? orders.slice(0, -1) : orders;

  res.json({
    data,
    pagination: {
      limit,
      hasMore,
      nextCursor: hasMore
        ? Buffer.from(JSON.stringify({ id: data[data.length - 1].id })).toString('base64')
        : null,
    }
  });
}
```

```sql
-- Query com cursor (rápido em qualquer página)
SELECT * FROM orders
WHERE (created_at, id) < ($1, $2)  -- cursor values
ORDER BY created_at DESC, id DESC
LIMIT $3;
```

### Offset-based (quando necessário)

```javascript
// Apenas quando o cliente PRECISA de page numbers (admin, backoffice)
GET /api/orders?page=3&limit=20

{
  "data": [...],
  "pagination": {
    "page": 3,
    "limit": 20,
    "total": 245,
    "totalPages": 13
  }
}
```

---

## 4. Filtros e Ordenação

### Padrão de filtros via query params

```
GET /api/orders?status=pending&minTotal=100&maxTotal=500&createdAfter=2025-01-01

Convenções:
├── Igualdade: ?status=pending
├── Range: ?minTotal=100&maxTotal=500
├── Data: ?createdAfter=2025-01-01&createdBefore=2025-02-01
├── Busca: ?search=widget
├── Inclusão: ?status=pending,shipped  (OR: pending ou shipped)
├── Relação: ?userId=123
└── Ordenação: ?sort=createdAt&order=desc
```

### Implementação segura (whitelist de campos)

```javascript
const ALLOWED_FILTERS = {
  status: (v) => ['pending', 'paid', 'shipped'].includes(v),
  userId: (v) => isUUID(v),
  minTotal: (v) => Number.isFinite(Number(v)),
  maxTotal: (v) => Number.isFinite(Number(v)),
};

const ALLOWED_SORT = ['createdAt', 'total', 'status'];

function parseFilters(query) {
  const filters = {};
  for (const [key, validate] of Object.entries(ALLOWED_FILTERS)) {
    if (query[key] && validate(query[key])) {
      filters[key] = query[key];
    }
  }
  const sort = ALLOWED_SORT.includes(query.sort) ? query.sort : 'createdAt';
  const order = query.order === 'asc' ? 'asc' : 'desc';
  return { filters, sort, order };
}
```

---

## 5. Formato de Resposta

### Envelope padrão

```javascript
// Sucesso — item único
{ "data": { "id": "...", "name": "..." } }

// Sucesso — lista
{ "data": [...], "pagination": { ... } }

// Sucesso — sem conteúdo
// HTTP 204 No Content (sem body)

// Erro
{ "error": { "code": "...", "message": "...", "details": {...} } }
```

### Serialization (DTO)

```javascript
// NUNCA retornar o model do banco direto
// 🔴 res.json(user)  ← expõe password_hash, internal fields

// ✅ DTO / Serializer
function serializeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
  };
}
res.json({ data: serializeUser(user) });
```

---

## 6. Formato de Erros

### Padrão único para todos os erros

```javascript
// Formato
{
  "error": {
    "code": "VALIDATION_ERROR",     // Código máquina-readable
    "message": "Dados inválidos",   // Mensagem humano-readable
    "details": [                    // Detalhes opcionais
      { "field": "email", "message": "Email inválido" },
      { "field": "password", "message": "Mínimo 8 caracteres" }
    ],
    "requestId": "req-abc-123"      // Para correlação em logs
  }
}
```

### Classe de erros no app

```javascript
class AppError extends Error {
  constructor(code, message, statusCode, details = null) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

class ValidationError extends AppError {
  constructor(details) {
    super('VALIDATION_ERROR', 'Dados inválidos', 400, details);
  }
}
class NotFoundError extends AppError {
  constructor(resource) {
    super('NOT_FOUND', `${resource} não encontrado`, 404);
  }
}
class ConflictError extends AppError {
  constructor(message) {
    super('CONFLICT', message, 409);
  }
}
class BusinessError extends AppError {
  constructor(code, message, details) {
    super(code, message, 422, details);
  }
}

// Error handler middleware
function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
        requestId: req.id,
      }
    });
  }
  // Erro inesperado — logar e retornar genérico
  logger.error('Unhandled error', { error: err, requestId: req.id });
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Erro interno', requestId: req.id }
  });
}
```

---

## 7. Batch e Bulk Operations

```javascript
// Batch GET (buscar múltiplos por ID)
GET /api/users?ids=1,2,3,4,5

// Bulk CREATE
POST /api/orders/bulk
{
  "items": [
    { "productId": "p1", "quantity": 2 },
    { "productId": "p2", "quantity": 1 }
  ]
}

// Bulk com resultado parcial
{
  "data": {
    "succeeded": [{ "id": "o1", "status": "created" }],
    "failed": [{ "index": 1, "error": { "code": "INSUFFICIENT_STOCK" } }]
  },
  "summary": { "total": 2, "succeeded": 1, "failed": 1 }
}
```

---

## 8. GraphQL — Quando e Como

### Quando usar GraphQL em vez de REST

| Cenário | REST | GraphQL |
|---------|------|---------|
| CRUD simples, poucos consumers | ✅ | Overkill |
| Mobile app (banda limitada) | Over/under fetching | ✅ Pega só o necessário |
| Múltiplos frontends diferentes | N endpoints customizados | ✅ 1 endpoint flexível |
| API pública para terceiros | ✅ Mais familiar | Curva de aprendizado |
| Real-time com subscriptions | WebSocket separado | ✅ Built-in |

### Schema-first design

```graphql
type Query {
  orders(status: OrderStatus, first: Int, after: String): OrderConnection!
  order(id: ID!): Order
}

type Mutation {
  createOrder(input: CreateOrderInput!): Order!
  cancelOrder(id: ID!): Order!
}

type Order {
  id: ID!
  status: OrderStatus!
  items: [OrderItem!]!
  total: Int!
  user: User!
  createdAt: DateTime!
}
```
