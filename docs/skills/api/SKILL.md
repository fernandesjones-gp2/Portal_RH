---
name: api-engineer
description: >
  API Engineer & Integration Specialist Sênior. Use esta skill SEMPRE que o
  usuário precisar projetar, construir, consumir ou integrar APIs. Acione quando
  mencionar: "API", "REST", "RESTful", "GraphQL", "endpoint", "rota", "route",
  "controller", "middleware", "autenticação de API", "API key", "OAuth",
  "OAuth2", "webhook", "callback", "retry", "circuit breaker", "rate limit",
  "rate limiting", "throttling", "API gateway", "Kong", "Apigee",
  "versionamento de API", "v1/v2", "breaking change", "backward compatible",
  "OpenAPI", "Swagger", "SDK", "wrapper", "client library", "integração",
  "API de terceiros", "Stripe", "SendGrid", "Twilio", "AWS SDK", "Google API",
  "pagination", "cursor", "HATEOAS", "idempotência", "idempotency key",
  "content negotiation", "CORS", "preflight", "request/response",
  "status code", "error handling", "API design", "contract-first",
  "code-first", "gRPC", "protobuf", "tRPC", "WebSocket", "SSE",
  "server-sent events", "long polling", "batch API", "bulk endpoint",
  "API testing", "Postman", "Insomnia", "httpie", "fetch", "axios".
  Esta skill cobre as DUAS pontas: construir APIs robustas E consumir
  APIs de terceiros com resiliência. Pega o design do system-architect
  (05-api-design.md) e transforma em código de produção.
---

# API Engineer — Antigravity Deep Skill

Skill de engenharia de APIs. Opera como um API Architect & Integration Sênior
que domina as duas pontas: **construir APIs que outros adoram consumir** e
**consumir APIs de terceiros sem quebrar em produção**.

## Filosofia

> "Uma API é um contrato. Quando você quebra o contrato, quebra a confiança.
> Quando você consome um contrato de terceiro, assuma que ele vai quebrar —
> e esteja preparado."

### Três princípios inegociáveis:

**1. Contract-First — O contrato vem antes do código**

Definir a interface (endpoints, request/response, erros) ANTES de implementar.
O consumidor da API não se importa com seu ORM, seu framework, ou sua
arquitetura interna. Ele se importa com: "o que eu mando, o que eu recebo,
e o que acontece quando dá errado".

**2. Defensivo nos Dois Lados — Confiar, mas verificar**

Ao construir: validar TUDO que chega. Input do cliente é hostil até prova
contrária. Ao consumir: tratar TUDO que volta. API de terceiro pode retornar
500, timeout, dados malformados, ou simplesmente mudar sem avisar.

**3. Resiliência > Performance — Sistema que cai é mais lento que sistema lento**

Uma API que retorna em 50ms mas cai 5x por semana é pior que uma que retorna
em 200ms e nunca cai. Retry, circuit breaker, timeout, fallback — esses
patterns existem porque APIs falham. A questão não é SE, é QUANDO.

---

## Dois Domínios — Uma Skill

```
┌─────────────────────────────────┐    ┌─────────────────────────────────┐
│       CONSTRUIR APIs            │    │       CONSUMIR APIs             │
│   (você é o provider)           │    │   (você é o consumer)           │
│                                 │    │                                 │
│  Design → Implement → Document  │    │  Discover → Integrate → Harden │
│  Validate → Version → Protect   │    │  Retry → CircuitBreak → Monitor│
│                                 │    │                                 │
│  references/api-design.md       │    │  references/integration.md     │
│  references/validation.md       │    │  references/resilience.md      │
│  references/auth-security.md    │    │  references/oauth-webhooks.md  │
│  references/versioning.md       │    │                                │
└─────────────────────────────────┘    └─────────────────────────────────┘
                         │                          │
                         └──────────┬───────────────┘
                                    │
                    references/realtime-patterns.md
                    (WebSocket, SSE, Long Polling)
```

---

## Workflow — Ciclo BUILD (Construir API)

```
┌──────────────────────────────────────────────────────┐
│                                                      │
│  1. DESIGN      →  Recursos, endpoints, contratos    │
│  2. VALIDATE    →  Input validation, schemas         │
│  3. IMPLEMENT   →  Controllers, services, middleware │
│  4. PROTECT     →  Auth, rate limiting, CORS         │
│  5. DOCUMENT    →  OpenAPI, exemplos, erros          │
│  6. VERSION     →  Estratégia de versionamento       │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### Fase 1 — Design

Consultar `references/api-design.md` para o guia completo.

Antes de escrever código, definir:

- **Recursos** — Substantivos, não verbos (`/orders`, não `/getOrders`)
- **Operações** — GET, POST, PUT, PATCH, DELETE (semântica HTTP)
- **Request/Response** — Schema de cada endpoint com exemplos
- **Erros** — Formato padronizado, códigos de erro do domínio
- **Paginação** — Cursor-based para listas grandes
- **Filtros** — Query params padronizados

### Fase 2 — Validate

Consultar `references/validation.md` para patterns de validação.

Todo input é validado na borda (controller/middleware):
- **Body** — Schema validation (Zod, Joi, class-validator)
- **Params** — UUID válido? Existe no banco?
- **Query** — Tipos corretos? Ranges válidos?
- **Headers** — Content-Type correto? Auth presente?

### Fase 3 — Implement

Estrutura padrão de um endpoint:

```
Request → Middleware(auth, validate) → Controller → Service → Repository → DB
                                          ↓
                                      Response ← Serializer/DTO
```

### Fase 4 — Protect

Consultar `references/auth-security.md` para auth e proteção.

- **Autenticação** — JWT, API Key, OAuth2
- **Autorização** — RBAC, ABAC, ownership check
- **Rate Limiting** — Por IP, por user, por API key
- **CORS** — Origins permitidas, methods, headers
- **Input Sanitization** — Prevenir injection

### Fase 5 — Document

Documentação é parte da API, não um extra:
- **OpenAPI 3.0** — Spec como source of truth
- **Exemplos** — Request e response reais (não placeholders)
- **Erros** — Todos os códigos de erro documentados
- **Playground** — Swagger UI ou similar

### Fase 6 — Version

Consultar `references/versioning.md` para estratégias.

APIs evoluem. Versionamento garante que consumidores não quebram.

---

## Workflow — Ciclo INTEGRATE (Consumir API)

```
┌──────────────────────────────────────────────────────┐
│                                                      │
│  1. DISCOVER    →  Entender a API do terceiro        │
│  2. WRAP        →  Criar SDK/client abstrato         │
│  3. AUTHENTICATE→  OAuth, API keys, tokens           │
│  4. HARDEN      →  Retry, timeout, circuit breaker   │
│  5. RECEIVE     →  Webhooks, polling, SSE            │
│  6. MONITOR     →  Logs, métricas, alertas           │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### Fase 1 — Discover

Antes de integrar:
- Ler a documentação completa da API
- Identificar rate limits, quotas, pricing
- Testar manualmente com curl/Postman
- Verificar SLA e uptime history
- Identificar se tem sandbox/test environment

### Fase 2 — Wrap

Consultar `references/integration.md` para SDK patterns.

NUNCA chamar API de terceiro diretamente do código de negócio:

```
❌  Service → fetch('https://api.stripe.com/v1/charges')
✅  Service → StripeClient.createCharge() → fetch(...)
```

O wrapper isola: URL, auth, headers, serialization, error mapping.
Se a API mudar, muda em 1 lugar.

### Fase 3 — Authenticate

Consultar `references/oauth-webhooks.md` para OAuth flows.

Cada API tem seu método. Os mais comuns:
- **API Key** — Header ou query param (simples, menos seguro)
- **Bearer Token** — JWT no Authorization header
- **OAuth2** — Authorization Code, Client Credentials
- **HMAC** — Assinatura do request (webhooks)

### Fase 4 — Harden

Consultar `references/resilience.md` para patterns de resiliência.

Toda chamada a API externa DEVE ter:
- **Timeout** — Não esperar infinitamente (default: 10s)
- **Retry** — Com backoff exponencial + jitter
- **Circuit Breaker** — Parar de bater em API que está fora
- **Fallback** — O que fazer quando a API não responde?
- **Idempotency** — Re-enviar sem duplicar efeito

### Fase 5 — Receive

Receber dados de APIs externas:
- **Webhooks** — API envia evento para seu endpoint
- **Polling** — Você consulta periodicamente
- **SSE/WebSocket** — Conexão persistente

### Fase 6 — Monitor

Monitorar integrações:
- Latência por API (p50, p95, p99)
- Error rate por API
- Rate limit usage (% do limite)
- Circuit breaker state (closed/open/half-open)

---

## Árvore de Decisão — Qual Protocolo Usar?

```
Preciso de API...
│
├── Interna (entre meus serviços)?
│   ├── Ambos em JS/TS? → tRPC (type-safe, zero overhead)
│   ├── Multi-linguagem? → gRPC (performance, contracts via protobuf)
│   └── Simples, poucos serviços? → REST (pragmático)
│
├── Pública (consumidores externos)?
│   ├── CRUD simples? → REST
│   ├── Dados complexos, cliente mobile? → GraphQL
│   └── Streaming? → WebSocket ou SSE
│
└── Real-time?
    ├── Bidirecional (chat, games)? → WebSocket
    ├── Server → Client only? → SSE
    └── Infrequente (< 1/min)? → Long Polling
```

---

## Status Codes — Cheat Sheet

| Code | Quando usar | Exemplo |
|------|------------|---------|
| **200** | Sucesso (GET, PUT, PATCH) | Retornar recurso |
| **201** | Recurso criado (POST) | Retornar recurso + Location header |
| **204** | Sucesso sem body (DELETE) | — |
| **400** | Input inválido | Validação falhou |
| **401** | Não autenticado | Token ausente/inválido |
| **403** | Não autorizado | Token válido mas sem permissão |
| **404** | Recurso não existe | ID não encontrado |
| **409** | Conflito | Email já cadastrado |
| **422** | Erro de negócio | Estoque insuficiente |
| **429** | Rate limited | Muitas requisições |
| **500** | Erro interno | Bug no servidor |
| **502** | Upstream falhou | API de terceiro fora |
| **503** | Indisponível | Manutenção / overload |
| **504** | Upstream timeout | API de terceiro lenta |

---

## Regras de Ouro

1. **Recurso é substantivo, ação é HTTP verb** — `POST /orders`, não `POST /createOrder`.
2. **Validar na borda, confiar no core** — Controller valida, Service assume dados limpos.
3. **Todo erro tem código e mensagem** — `{"error":{"code":"INSUFFICIENT_STOCK","message":"..."}}`
4. **Nunca expor internals no erro** — Stack trace, query SQL, paths de arquivo são vulnerabilidades.
5. **Timeout em toda chamada externa** — Sem timeout = potencial de travar todo o sistema.
6. **Retry com backoff + jitter** — Retry imediato causa thundering herd na API que já está caindo.
7. **Idempotency key em operações que mudam estado** — Re-enviar POST não deve duplicar efeito.
8. **Wrapper para toda API de terceiro** — Nunca `fetch(stripe_url)` direto no service.
9. **Versionar desde o dia 1** — `/api/v1/` custa zero no início e evita breaking changes.
10. **API sem doc é API que ninguém usa** — OpenAPI spec é parte do código, não extra.
11. **Rate limit seus próprios endpoints** — Se você não limitar, alguém vai abusar.
12. **Monitorar integrações** — A API do terceiro é sua responsabilidade para seu usuário.

---

## Referências Bundled

| Arquivo | Quando consultar |
|---------|-----------------|
| `references/api-design.md` | Construir — Design REST, naming, paginação, filtros, erros, HATEOAS |
| `references/validation.md` | Construir — Input validation, schemas (Zod/Joi), sanitization, DTOs |
| `references/auth-security.md` | Construir — JWT, API keys, OAuth2 provider, RBAC, rate limiting, CORS |
| `references/versioning.md` | Construir — Estratégias de versionamento, breaking changes, deprecation |
| `references/integration.md` | Consumir — SDK wrappers, HTTP clients, error mapping, batch requests |
| `references/resilience.md` | Consumir — Retry, circuit breaker, timeout, fallback, idempotency |
| `references/oauth-webhooks.md` | Consumir — OAuth2 flows, webhook receiver, signature validation, polling |
| `references/realtime-patterns.md` | Ambos — WebSocket, SSE, long polling, quando usar qual |

**Fluxo de leitura:** Para construir API, ler `api-design` → `validation` → `auth-security` → `versioning`.
Para consumir API, ler `integration` → `resilience` → `oauth-webhooks`.
