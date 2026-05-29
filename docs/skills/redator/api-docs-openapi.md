# API Documentation — OpenAPI 3.0, Swagger e Exemplos

## Índice
1. Princípios de API Docs
2. OpenAPI 3.0 — Spec Completa
3. Endpoint Documentation Pattern
4. Autenticação
5. Erros e Status Codes
6. Exemplos de Request/Response
7. Geração Automática

---

## 1. Princípios de API Docs

```
Boa API doc responde:
├── Como autenticar?
├── Quais endpoints existem?
├── Quais parâmetros cada um aceita?
├── Qual o formato do request body?
├── Qual o formato da response?
├── Quais erros podem acontecer?
├── Tem rate limiting?
└── Tem paginação? Como funciona?
```

### Regra de ouro

Todo endpoint documentado deve ter:
1. Descrição do que faz
2. Parâmetros com tipos e exemplos
3. Request body com exemplo completo
4. Response de sucesso com exemplo completo
5. Pelo menos 2 exemplos de erro

---

## 2. OpenAPI 3.0 — Spec Completa

```yaml
# openapi.yaml
openapi: 3.0.3
info:
  title: Meu Projeto API
  description: |
    API para gerenciamento de pedidos e usuários.

    ## Autenticação
    Todos os endpoints (exceto `/auth/login` e `/auth/register`)
    requerem Bearer token no header `Authorization`.

    ## Rate Limiting
    - Endpoints de auth: 5 requests/minuto
    - Endpoints gerais: 60 requests/minuto

    ## Paginação
    Listagens usam query params `page` e `limit`.
    Response inclui `meta` com informações de paginação.
  version: 1.0.0
  contact:
    name: Time de Desenvolvimento
    email: dev@example.com

servers:
  - url: https://api.example.com/v1
    description: Produção
  - url: https://staging-api.example.com/v1
    description: Staging
  - url: http://localhost:3000/api/v1
    description: Local

tags:
  - name: Auth
    description: Autenticação e autorização
  - name: Users
    description: Gerenciamento de usuários
  - name: Orders
    description: Gerenciamento de pedidos

paths:
  # ====== AUTH ======
  /auth/register:
    post:
      tags: [Auth]
      summary: Registrar novo usuário
      description: Cria uma nova conta e retorna tokens de acesso.
      operationId: registerUser
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/RegisterRequest'
            example:
              name: "Ana Silva"
              email: "ana@example.com"
              password: "MinhaSenh@123"
      responses:
        '201':
          description: Usuário criado com sucesso
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/AuthResponse'
              example:
                data:
                  user:
                    id: "550e8400-e29b-41d4-a716-446655440000"
                    name: "Ana Silva"
                    email: "ana@example.com"
                    role: "user"
                    createdAt: "2025-01-15T10:30:00Z"
                  accessToken: "eyJhbGciOiJIUzI1NiIs..."
                  refreshToken: "eyJhbGciOiJIUzI1NiIs..."
        '400':
          $ref: '#/components/responses/ValidationError'
        '409':
          description: Email já cadastrado
          content:
            application/json:
              example:
                error:
                  code: "CONFLICT"
                  message: "Email já está em uso"

  /auth/login:
    post:
      tags: [Auth]
      summary: Fazer login
      operationId: loginUser
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/LoginRequest'
            example:
              email: "ana@example.com"
              password: "MinhaSenh@123"
      responses:
        '200':
          description: Login bem-sucedido
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/AuthResponse'
        '401':
          $ref: '#/components/responses/Unauthorized'

  # ====== ORDERS ======
  /orders:
    get:
      tags: [Orders]
      summary: Listar pedidos do usuário
      operationId: listOrders
      security:
        - bearerAuth: []
      parameters:
        - name: page
          in: query
          schema:
            type: integer
            default: 1
            minimum: 1
        - name: limit
          in: query
          schema:
            type: integer
            default: 20
            minimum: 1
            maximum: 100
        - name: status
          in: query
          schema:
            type: string
            enum: [pending, paid, shipped, delivered, cancelled]
        - name: sort
          in: query
          schema:
            type: string
            enum: [created_at, total]
            default: created_at
        - name: order
          in: query
          schema:
            type: string
            enum: [asc, desc]
            default: desc
      responses:
        '200':
          description: Lista de pedidos
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/OrderListResponse'
              example:
                data:
                  - id: "order-001"
                    status: "pending"
                    total: 15990
                    itemCount: 3
                    createdAt: "2025-01-15T10:30:00Z"
                meta:
                  page: 1
                  limit: 20
                  total: 45
                  totalPages: 3
        '401':
          $ref: '#/components/responses/Unauthorized'

    post:
      tags: [Orders]
      summary: Criar novo pedido
      operationId: createOrder
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateOrderRequest'
            example:
              items:
                - productId: "prod-001"
                  quantity: 2
                - productId: "prod-002"
                  quantity: 1
              shippingAddressId: "addr-001"
              couponCode: "SAVE10"
      responses:
        '201':
          description: Pedido criado
          content:
            application/json:
              example:
                data:
                  id: "order-002"
                  status: "pending"
                  items:
                    - productId: "prod-001"
                      name: "Widget"
                      quantity: 2
                      unitPrice: 4990
                      total: 9980
                  subtotal: 14970
                  discount: 1497
                  shipping: 1500
                  total: 14973
                  createdAt: "2025-01-15T14:00:00Z"
        '400':
          $ref: '#/components/responses/ValidationError'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '422':
          description: Estoque insuficiente
          content:
            application/json:
              example:
                error:
                  code: "INSUFFICIENT_STOCK"
                  message: "Produto 'Widget' tem apenas 1 unidade em estoque"
                  details:
                    productId: "prod-001"
                    available: 1
                    requested: 2

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
      description: |
        Token JWT obtido via `/auth/login`.
        Incluir no header: `Authorization: Bearer <token>`

  schemas:
    RegisterRequest:
      type: object
      required: [name, email, password]
      properties:
        name:
          type: string
          minLength: 2
          maxLength: 100
          example: "Ana Silva"
        email:
          type: string
          format: email
          example: "ana@example.com"
        password:
          type: string
          minLength: 8
          description: "Mínimo 8 caracteres, 1 maiúscula, 1 número"
          example: "MinhaSenh@123"

    LoginRequest:
      type: object
      required: [email, password]
      properties:
        email:
          type: string
          format: email
        password:
          type: string

    Error:
      type: object
      properties:
        error:
          type: object
          properties:
            code:
              type: string
            message:
              type: string
            details:
              type: object

  responses:
    ValidationError:
      description: Dados inválidos
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'
          example:
            error:
              code: "VALIDATION_ERROR"
              message: "Dados inválidos"
              details:
                - field: "email"
                  message: "Email inválido"
    Unauthorized:
      description: Não autenticado
      content:
        application/json:
          example:
            error:
              code: "UNAUTHORIZED"
              message: "Token ausente ou inválido"
```

---

## 3. Endpoint Documentation Pattern

Para docs manuais (Markdown) em vez de OpenAPI:

```markdown
### POST /api/orders

Cria um novo pedido para o usuário autenticado.

**Autenticação:** Bearer Token (obrigatório)
**Rate limit:** 10 requests/minuto

#### Request

**Headers:**
| Header | Valor |
|--------|-------|
| `Authorization` | `Bearer <token>` |
| `Content-Type` | `application/json` |

**Body:**
| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `items` | `array` | Sim | Lista de itens |
| `items[].productId` | `string` | Sim | ID do produto |
| `items[].quantity` | `integer` | Sim | Quantidade (min: 1) |
| `shippingAddressId` | `string` | Sim | ID do endereço |
| `couponCode` | `string` | Não | Código de cupom |

**Exemplo:**
```json
{
  "items": [
    { "productId": "prod-001", "quantity": 2 }
  ],
  "shippingAddressId": "addr-001",
  "couponCode": "SAVE10"
}
```

#### Responses

**201 Created** — Pedido criado com sucesso
```json
{
  "data": {
    "id": "order-002",
    "status": "pending",
    "total": 14973,
    "createdAt": "2025-01-15T14:00:00Z"
  }
}
```

**400 Bad Request** — Dados inválidos
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "items não pode ser vazio"
  }
}
```

**422 Unprocessable Entity** — Estoque insuficiente
```json
{
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "message": "Produto 'Widget' tem apenas 1 unidade"
  }
}
```
```

---

## 4. Documentar Autenticação

```markdown
## Autenticação

A API usa JWT (JSON Web Token) para autenticação.

### Obter Token

```bash
curl -X POST https://api.example.com/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "senha"}'
```

Response:
```json
{
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ...",
    "expiresIn": 900
  }
}
```

### Usar Token

Incluir em todas as requests:
```
Authorization: Bearer eyJ...
```

### Renovar Token

Access token expira em 15 minutos. Use o refresh token:
```bash
curl -X POST https://api.example.com/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "eyJ..."}'
```
```

---

## 5. Documentar Erros

```markdown
## Erros

Todas as respostas de erro seguem o formato:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Descrição legível por humanos",
    "details": {}
  }
}
```

### Códigos de Erro

| Código | HTTP | Descrição |
|--------|------|-----------|
| `VALIDATION_ERROR` | 400 | Dados do request inválidos |
| `UNAUTHORIZED` | 401 | Token ausente ou inválido |
| `FORBIDDEN` | 403 | Sem permissão para este recurso |
| `NOT_FOUND` | 404 | Recurso não encontrado |
| `CONFLICT` | 409 | Conflito (ex: email duplicado) |
| `INSUFFICIENT_STOCK` | 422 | Estoque insuficiente |
| `RATE_LIMITED` | 429 | Muitas requisições |
| `INTERNAL_ERROR` | 500 | Erro interno do servidor |
```

---

## 6. Geração Automática

### Ferramentas por stack

| Stack | Ferramenta | Como |
|-------|-----------|------|
| Node.js + Express | swagger-jsdoc + swagger-ui-express | Anotações JSDoc no código |
| NestJS | @nestjs/swagger | Decorators automáticos |
| FastAPI | Built-in | Geração automática a partir dos types |
| Django REST | drf-spectacular | Gera OpenAPI 3.0 |
| Spring Boot | springdoc-openapi | Gera automaticamente |
| Go | swag | Anotações em comentários |

### Princípio

```
Automático > Manual

Se o framework gera docs do código: USAR.
Manter OpenAPI manual só quando:
- API-first design (spec antes do código)
- API pública com consumidores externos
- Contrato precisa de aprovação antes de implementar
```
