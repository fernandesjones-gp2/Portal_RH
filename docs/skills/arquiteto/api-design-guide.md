# API Design Guide — Convenções e Contratos

## Índice
1. Convenções REST
2. Estrutura de Endpoints
3. Contratos Request/Response
4. Autenticação e Autorização
5. Erros Padronizados
6. Paginação, Filtros e Ordenação
7. Versionamento
8. Template do Documento

---

## 1. Convenções REST

### Nomenclatura

| Regra | ✅ Correto | ❌ Errado |
|-------|-----------|----------|
| Plural para collections | `/users` | `/user` |
| Kebab-case | `/order-items` | `/orderItems`, `/order_items` |
| Substantivos, não verbos | `/orders` | `/getOrders`, `/createOrder` |
| Hierarquia para relações | `/users/:id/orders` | `/getUserOrders` |
| Query params para filtros | `/products?category=electronics` | `/products/electronics` |

### Métodos HTTP

| Método | Uso | Idempotente | Body |
|--------|-----|-------------|------|
| GET | Ler recurso(s) | Sim | Não |
| POST | Criar recurso | Não | Sim |
| PUT | Substituir recurso completo | Sim | Sim |
| PATCH | Atualizar parcialmente | Sim | Sim |
| DELETE | Remover recurso | Sim | Não |

### Status Codes

| Range | Significado | Mais usados |
|-------|-------------|------------|
| 2xx | Sucesso | 200 OK, 201 Created, 204 No Content |
| 3xx | Redirect | 301 Moved, 304 Not Modified |
| 4xx | Erro do cliente | 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 409 Conflict, 422 Unprocessable, 429 Too Many Requests |
| 5xx | Erro do servidor | 500 Internal, 502 Bad Gateway, 503 Unavailable |

---

## 2. Estrutura de Endpoints

### Formato de documentação por endpoint

```markdown
### [MÉTODO] /api/v1/[resource]

**Descrição:** [O que faz]
**Auth:** [Bearer token / API key / Público]
**Roles:** [admin, user, ...]
**Rate Limit:** [X req/min]

**Path Params:**
| Param | Tipo | Descrição |
|-------|------|-----------|
| id | UUID | ID do recurso |

**Query Params:**
| Param | Tipo | Default | Descrição |
|-------|------|---------|-----------|
| page | int | 1 | Página |
| limit | int | 20 | Itens por página (max: 100) |
| sort | string | created_at | Campo de ordenação |
| order | string | desc | asc ou desc |

**Request Body:**
```json
{
  "name": "string (required, 3-100 chars)",
  "email": "string (required, valid email)"
}
```

**Responses:**

`201 Created`
```json
{
  "data": {
    "id": "uuid",
    "name": "string",
    "email": "string",
    "created_at": "ISO 8601"
  }
}
```

`400 Bad Request`
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Dados inválidos",
    "details": [
      { "field": "email", "message": "Email inválido" }
    ]
  }
}
```
```

---

## 3. Contratos Request/Response

### Envelope padrão de resposta

```json
// Sucesso (item único)
{
  "data": { ... }
}

// Sucesso (lista paginada)
{
  "data": [ ... ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "total_pages": 8
  }
}

// Erro
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Mensagem legível para o dev",
    "details": [ ... ]
  }
}
```

### Convenções de campos

| Convenção | Padrão |
|-----------|--------|
| Nomes de campos | camelCase |
| Datas | ISO 8601 (`2025-01-15T10:30:00Z`) |
| IDs | UUID v4 (string) |
| Moeda | Integer em centavos (`1990` = R$ 19,90) |
| Booleanos | `true`/`false` (não 0/1) |
| Nulls | `null` explícito, nunca omitir o campo |
| Enums | snake_case strings (`"order_placed"`) |

---

## 4. Autenticação e Autorização

### JWT (JSON Web Token) — mais comum

```
Flow:
1. POST /auth/login { email, password }
2. → { access_token (15min), refresh_token (7d) }
3. Requests: Authorization: Bearer <access_token>
4. Token expirado → POST /auth/refresh { refresh_token }
```

### Estrutura de roles/permissions

```markdown
| Role | Pode fazer |
|------|-----------|
| admin | Tudo |
| manager | CRUD do próprio time + relatórios |
| user | CRUD dos próprios recursos |
| viewer | Apenas leitura |
```

### Proteção por endpoint

```markdown
| Endpoint | Público | User | Manager | Admin |
|----------|---------|------|---------|-------|
| GET /products | ✅ | ✅ | ✅ | ✅ |
| POST /products | ❌ | ❌ | ✅ | ✅ |
| DELETE /products/:id | ❌ | ❌ | ❌ | ✅ |
| GET /users/me | ❌ | ✅ | ✅ | ✅ |
| GET /users | ❌ | ❌ | ✅ | ✅ |
```

---

## 5. Erros Padronizados

### Catálogo de códigos de erro

```markdown
| Código | HTTP | Quando |
|--------|------|--------|
| VALIDATION_ERROR | 400 | Body/params inválidos |
| UNAUTHORIZED | 401 | Token ausente ou inválido |
| FORBIDDEN | 403 | Sem permissão para a ação |
| NOT_FOUND | 404 | Recurso não existe |
| CONFLICT | 409 | Recurso já existe (ex: email duplicado) |
| RATE_LIMITED | 429 | Muitas requisições |
| INTERNAL_ERROR | 500 | Erro inesperado (logar, alertar) |
| SERVICE_UNAVAILABLE | 503 | Dependência fora do ar |
```

---

## 6. Paginação, Filtros e Ordenação

### Paginação (offset-based)

```
GET /products?page=2&limit=20

Response meta:
{
  "page": 2,
  "limit": 20,
  "total": 150,
  "total_pages": 8,
  "has_next": true,
  "has_prev": true
}
```

### Paginação (cursor-based, para feeds/real-time)

```
GET /feed?cursor=eyJpZCI6MTIzfQ&limit=20

Response meta:
{
  "next_cursor": "eyJpZCI6MTAzfQ",
  "has_more": true
}
```

### Filtros

```
GET /products?category=electronics&price_min=100&price_max=500&in_stock=true
```

### Ordenação

```
GET /products?sort=price&order=asc
GET /products?sort=created_at&order=desc
```

---

## 7. Versionamento

### URL prefix (recomendado para simplicidade)

```
/api/v1/users
/api/v2/users
```

### Quando criar v2

- Mudança breaking (campo removido, tipo alterado, comportamento diferente)
- Manter v1 ativa por pelo menos 6 meses após lançar v2
- Deprecation header: `Sunset: Sat, 01 Jan 2026 00:00:00 GMT`

---

## 8. Template do Documento

```markdown
# 05 — API Design

## Visão Geral
- Base URL: `https://api.exemplo.com/v1`
- Autenticação: Bearer JWT
- Content-Type: application/json
- Rate Limit: [X] req/min

## Autenticação

### POST /auth/register
(... documentar ...)

### POST /auth/login
(... documentar ...)

---

## Recursos

### Products

#### GET /products
(... documentar com formato da seção 2 ...)

#### POST /products
(... documentar ...)

#### GET /products/:id
(... documentar ...)

#### PATCH /products/:id
(... documentar ...)

#### DELETE /products/:id
(... documentar ...)

---

## Webhooks (se aplicável)
| Evento | Payload | Quando dispara |
|--------|---------|---------------|
| order.created | { order } | Novo pedido |

## Códigos de Erro
(... tabela da seção 5 ...)

## Rate Limiting
(... detalhes ...)

## Matriz de Permissões
(... tabela da seção 4 ...)
```
