# Validation — Input Validation, Schemas e DTOs

## Índice
1. Princípios de Validação
2. Zod (TypeScript)
3. Joi (JavaScript)
4. class-validator (NestJS)
5. Pydantic (Python)
6. Middleware de Validação
7. Sanitization
8. DTOs — Data Transfer Objects

---

## 1. Princípios de Validação

```
Regras invioláveis:
├── Validar NA BORDA (controller/middleware), não no service
├── Whitelist > blacklist (aceitar apenas o esperado)
├── Falhar cedo, falhar claro (mensagem específica por campo)
├── Validação de tipo E de negócio são coisas diferentes
│   ├── Tipo: "email é string válida" → Middleware/Schema
│   └── Negócio: "email não está em uso" → Service
├── NUNCA confiar no client (mesmo se tem validação no front)
└── Input do body, query, params e headers — validar TUDO
```

### Camadas de validação

```
Layer 1 — Schema (tipo, formato, range)
  "email é string, formato email, max 255 chars"
  → Zod, Joi, class-validator, Pydantic

Layer 2 — Negócio (regras do domínio)
  "email não está cadastrado", "estoque disponível"
  → Service layer

Layer 3 — Database (constraints)
  "UNIQUE(email)", "NOT NULL", "FK EXISTS"
  → Última barreira, não confiar apenas nela
```

---

## 2. Zod (TypeScript — Recomendado)

```typescript
import { z } from 'zod';

// Schema de criação de pedido
const createOrderSchema = z.object({
  body: z.object({
    items: z.array(z.object({
      productId: z.string().uuid('ID do produto inválido'),
      quantity: z.number().int().min(1).max(100),
    })).min(1, 'Pedido deve ter ao menos 1 item').max(50),

    shippingAddressId: z.string().uuid(),

    couponCode: z.string().max(20).optional(),

    notes: z.string().max(500).optional(),
  }),

  params: z.object({}),

  query: z.object({}),
});

// Schema de listagem com filtros
const listOrdersSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    status: z.enum(['pending', 'paid', 'shipped', 'delivered', 'cancelled']).optional(),
    sort: z.enum(['createdAt', 'total']).default('createdAt'),
    order: z.enum(['asc', 'desc']).default('desc'),
    search: z.string().max(100).optional(),
  }),
});

// Schema reutilizável — paginação
const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// Inferir tipos automaticamente
type CreateOrderInput = z.infer<typeof createOrderSchema>['body'];
type ListOrdersQuery = z.infer<typeof listOrdersSchema>['query'];
```

### Middleware de validação com Zod

```typescript
import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      req.body = parsed.body ?? req.body;
      req.query = parsed.query ?? req.query;
      req.params = parsed.params ?? req.params;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Dados inválidos',
            details: error.errors.map(e => ({
              field: e.path.join('.'),
              message: e.message,
            })),
          }
        });
      }
      next(error);
    }
  };
}

// Uso
router.post('/orders', validate(createOrderSchema), orderController.create);
router.get('/orders', validate(listOrdersSchema), orderController.list);
```

---

## 3. Joi (JavaScript)

```javascript
const Joi = require('joi');

const createOrderSchema = Joi.object({
  items: Joi.array().items(Joi.object({
    productId: Joi.string().uuid().required(),
    quantity: Joi.number().integer().min(1).max(100).required(),
  })).min(1).max(50).required(),
  shippingAddressId: Joi.string().uuid().required(),
  couponCode: Joi.string().max(20),
  notes: Joi.string().max(500),
});

// Middleware
function validate(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,    // Retornar TODOS os erros, não apenas o primeiro
      stripUnknown: true,   // Remover campos não definidos no schema
    });
    if (error) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos',
          details: error.details.map(d => ({
            field: d.path.join('.'),
            message: d.message,
          })),
        }
      });
    }
    req.body = value;
    next();
  };
}
```

---

## 4. class-validator (NestJS)

```typescript
import { IsUUID, IsInt, Min, Max, IsOptional, IsEnum,
         IsString, MaxLength, ValidateNested, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';

class OrderItemDto {
  @IsUUID()
  productId: string;

  @IsInt()
  @Min(1)
  @Max(100)
  quantity: number;
}

class CreateOrderDto {
  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @IsUUID()
  shippingAddressId: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  couponCode?: string;
}

// NestJS controller — validação automática via pipe
@Post()
async create(@Body() dto: CreateOrderDto) {
  return this.orderService.create(dto);
}
```

---

## 5. Pydantic (Python / FastAPI)

```python
from pydantic import BaseModel, Field, field_validator
from uuid import UUID
from typing import Optional

class OrderItemInput(BaseModel):
    product_id: UUID
    quantity: int = Field(ge=1, le=100)

class CreateOrderInput(BaseModel):
    items: list[OrderItemInput] = Field(min_length=1, max_length=50)
    shipping_address_id: UUID
    coupon_code: Optional[str] = Field(None, max_length=20)
    notes: Optional[str] = Field(None, max_length=500)

    @field_validator('coupon_code')
    @classmethod
    def coupon_uppercase(cls, v):
        return v.upper() if v else v

# FastAPI — validação automática
@app.post("/orders", status_code=201)
async def create_order(order: CreateOrderInput):
    return await order_service.create(order)
```

---

## 6. Validações Comuns

```javascript
// Patterns de validação reutilizáveis

// Email
z.string().email().max(255).toLowerCase()

// Senha forte
z.string()
  .min(8, 'Mínimo 8 caracteres')
  .regex(/[A-Z]/, 'Precisa de 1 maiúscula')
  .regex(/[0-9]/, 'Precisa de 1 número')

// UUID
z.string().uuid()

// CPF (Brasil)
z.string().regex(/^\d{11}$/, 'CPF inválido')

// Telefone
z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Telefone inválido')

// URL
z.string().url()

// Data ISO
z.string().datetime()

// Enum
z.enum(['pending', 'active', 'inactive'])

// Monetário (inteiro em centavos)
z.number().int().min(0).max(99999999)

// Slug
z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
```

---

## 7. Sanitization

```javascript
// Sanitizar ANTES de validar

// Strip HTML
import sanitizeHtml from 'sanitize-html';
const clean = sanitizeHtml(input, { allowedTags: [] });

// Trim whitespace
const trimmed = z.string().trim();

// Normalizar email
const email = z.string().email().toLowerCase().trim();

// Remover campos extras (stripUnknown)
// Zod: .strict() rejeita, ou .strip() remove
const schema = z.object({ name: z.string() }).strip();

// Escapar para SQL — NÃO NECESSÁRIO se usar parameterized queries
// MAS necessário se construir HTML:
import { encode } from 'html-entities';
const safe = encode(userInput);
```

---

## 8. DTOs — Data Transfer Objects

### Input DTO (request → app)

```typescript
// O que entra na API (validado pelo schema)
interface CreateOrderInput {
  items: { productId: string; quantity: number }[];
  shippingAddressId: string;
  couponCode?: string;
}
```

### Output DTO (app → response)

```typescript
// O que sai da API (serializado pelo serializer)
interface OrderResponse {
  id: string;
  status: string;
  items: OrderItemResponse[];
  subtotal: number;
  discount: number;
  total: number;
  createdAt: string;  // ISO 8601
}

// Serializer
function toOrderResponse(order: Order): OrderResponse {
  return {
    id: order.id,
    status: order.status,
    items: order.items.map(toOrderItemResponse),
    subtotal: order.subtotal,
    discount: order.discount,
    total: order.total,
    createdAt: order.createdAt.toISOString(),
    // NÃO incluir: internalNotes, userId, deletedAt, etc.
  };
}
```

### Regra

```
Input DTO:  o que o CLIENT pode enviar (whitelist)
Output DTO: o que o CLIENT pode ver (whitelist)
Model/Entity: o que EXISTE no banco (tudo)

Client → [Input DTO] → Service → [Model] → DB
DB → [Model] → Service → [Output DTO] → Client

NUNCA: DB → [Model] → Client (expõe dados internos)
```
