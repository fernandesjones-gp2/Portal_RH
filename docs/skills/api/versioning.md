# Versioning — Estratégias, Breaking Changes e Deprecation

## Índice
1. Estratégias de Versionamento
2. O Que É Breaking Change
3. Evolução Sem Quebra
4. Deprecation Lifecycle
5. Migration Guide para Consumidores

---

## 1. Estratégias de Versionamento

| Estratégia | Exemplo | Prós | Contras |
|-----------|---------|------|---------|
| **URL path** | `/api/v1/orders` | Claro, fácil de rotear, cacheable | URL muda entre versões |
| **Header** | `Accept: application/vnd.api.v2+json` | URL limpa | Difícil de testar no browser |
| **Query param** | `/api/orders?version=2` | Simples | Poluição de cache, feio |

### Recomendação: URL path

```
/api/v1/orders     ← Versão estável
/api/v2/orders     ← Nova versão (quando necessário)
```

Implementação no Express:

```javascript
const v1 = express.Router();
v1.use('/orders', ordersV1Routes);
v1.use('/users', usersV1Routes);

const v2 = express.Router();
v2.use('/orders', ordersV2Routes);  // Apenas rotas que mudaram
v2.use('/users', usersV1Routes);    // Reusar o que não mudou

app.use('/api/v1', v1);
app.use('/api/v2', v2);
```

### Quando criar nova versão

```
NOVA VERSÃO quando:
├── Remover campo obrigatório do response
├── Mudar tipo de campo (string → number)
├── Mudar estrutura do response
├── Remover endpoint
├── Mudar comportamento de endpoint existente
└── Mudar regras de autenticação

NÃO PRECISA de nova versão quando:
├── Adicionar campo OPCIONAL ao response
├── Adicionar novo endpoint
├── Adicionar parâmetro OPCIONAL ao request
├── Melhorar mensagens de erro
├── Fix de bug (comportamento anterior era errado)
└── Melhorias de performance
```

---

## 2. O Que É Breaking Change

### Definitivamente quebra (NUNCA sem nova versão)

```javascript
// Remover campo do response
// v1: { id, name, email, avatar_url }
// v2: { id, name, email }              ← avatar_url sumiu!

// Mudar tipo
// v1: { "total": 1990 }               ← número (centavos)
// v2: { "total": "19.90" }            ← string!

// Renomear campo
// v1: { "created_at": "..." }
// v2: { "createdAt": "..." }          ← camelCase vs snake_case

// Mudar status code
// v1: DELETE /orders/:id → 200
// v2: DELETE /orders/:id → 204       ← clients esperando body vão quebrar

// Mudar enum values
// v1: status IN ['pending', 'active', 'inactive']
// v2: status IN ['pending', 'active', 'disabled']  ← 'inactive' sumiu!
```

### Não quebra (safe to deploy)

```javascript
// Adicionar campo novo ao response — SAFE
// v1: { id, name }
// atualizado: { id, name, avatar_url }    ← Novo campo, clients ignoram

// Adicionar endpoint novo — SAFE
// POST /api/v1/orders/:id/duplicate     ← Endpoint novo

// Adicionar query param opcional — SAFE
// GET /orders?status=pending&priority=high  ← Novo filtro

// Adicionar header opcional — SAFE
// X-Idempotency-Key: ...                 ← Opcional
```

---

## 3. Evolução Sem Quebra

### Additive Changes (preferível)

```javascript
// Ao invés de mudar o campo "address" de string para object:

// ❌ Breaking: mudar tipo
{ "address": "Rua X, 123" }  →  { "address": { "street": "Rua X", "number": "123" } }

// ✅ Additive: manter o antigo + adicionar novo
{
  "address": "Rua X, 123",                    // Manter (deprecated)
  "structured_address": {                       // Novo
    "street": "Rua X",
    "number": "123",
    "city": "São Paulo"
  }
}
// Em v2 (futuro): remover "address", manter "structured_address"
```

### Expand/Contract para APIs

```
Fase 1 — EXPAND (deploy agora):
  Adicionar campo novo ao response
  Aceitar AMBOS formatos no request
  Documentar o novo campo

Fase 2 — DEPRECATE (avisar):
  Marcar campo antigo como deprecated
  Warning header: Deprecated: "Use structured_address instead"
  Comunicar consumidores (email, changelog, docs)

Fase 3 — CONTRACT (nova versão, quando necessário):
  Nova versão v2 sem o campo antigo
  v1 continua funcionando por X meses
  Depois de X meses: desligar v1
```

---

## 4. Deprecation Lifecycle

### Headers de deprecation

```javascript
// Middleware para endpoints deprecated
function deprecated(message, sunsetDate) {
  return (req, res, next) => {
    res.setHeader('Deprecation', 'true');
    res.setHeader('Sunset', sunsetDate); // RFC 8594
    res.setHeader('Link', '</api/v2/orders>; rel="successor-version"');
    logger.warn('Deprecated endpoint accessed', {
      path: req.path, client: req.client?.id, sunset: sunsetDate
    });
    next();
  };
}

// Uso
router.get('/api/v1/orders',
  deprecated('Use /api/v2/orders', 'Sat, 01 Jun 2025 00:00:00 GMT'),
  orderController.list
);
```

### Timeline de deprecation

```
Mês 0: Lançar v2. v1 continua funcionando.
        Docs de v1 marcados como deprecated.
        Warning header em responses de v1.

Mês 1: Email para consumidores: "v1 será descontinuado em 3 meses"
        Migration guide publicado.

Mês 3: Segundo aviso. Logs mostram quem ainda usa v1.
        Contatar grandes consumidores diretamente.

Mês 6: Desligar v1. Retornar 410 Gone com mensagem:
        { "error": { "code": "VERSION_GONE",
          "message": "v1 foi descontinuada. Use v2.",
          "docs": "https://docs.example.com/migration-v1-v2" } }
```

---

## 5. Migration Guide para Consumidores

### Template

```markdown
# Migration Guide: v1 → v2

## Timeline
- **Agora**: v2 disponível. v1 continua funcionando.
- **2025-06-01**: v1 será desligada.

## O Que Mudou

### Endpoints removidos
| v1 | v2 |
|----|----|
| `GET /users/:id/orders` | `GET /orders?userId=:id` |

### Campos renomeados
| v1 (response) | v2 (response) |
|---------------|---------------|
| `created_at` | `createdAt` |
| `user_name` | `userName` |

### Campos novos (obrigatórios no request)
| Endpoint | Campo | Tipo | Descrição |
|----------|-------|------|-----------|
| `POST /orders` | `idempotencyKey` | string | UUID único por request |

### Mudanças de comportamento
- Paginação agora é cursor-based (`cursor` param em vez de `page`)
- Rate limit reduzido de 100 para 60 req/min (tier free)

## Exemplos

### Antes (v1)
```bash
curl https://api.example.com/v1/users/123/orders?page=2
```

### Depois (v2)
```bash
curl https://api.example.com/v2/orders?userId=123&cursor=eyJpZCI6MTAwfQ
```
```
