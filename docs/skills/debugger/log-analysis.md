# Log Analysis — Ler, Filtrar, Correlacionar Logs

## Índice
1. Structured Logging
2. Request ID — Correlação
3. Grep Patterns para Debugging
4. O Que Logar em Cada Camada
5. Log Levels — Quando Usar Cada
6. Debugging com Logs Temporários
7. Ferramentas de Log

---

## 1. Structured Logging

```javascript
// ❌ Log não-estruturado (impossível de filtrar):
console.log('User 123 created order 456 with total 5990');

// ✅ Log estruturado (JSON — filtrável, pesquisável):
logger.info('Order created', {
  userId: '123',
  orderId: '456',
  total: 5990,
  itemCount: 3,
  requestId: 'req-abc-789',
  duration: 142,
});

// Output:
// {"level":"info","msg":"Order created","userId":"123","orderId":"456",
//  "total":5990,"itemCount":3,"requestId":"req-abc-789","duration":142,
//  "timestamp":"2025-03-02T14:30:00.000Z"}
```

### Setup com Pino (Node.js)

```javascript
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development'
    ? { target: 'pino-pretty' } // Bonito no terminal
    : undefined,                // JSON em produção
  redact: ['password', 'token', 'authorization', 'creditCard'], // PII
});

// Child logger com contexto
function createRequestLogger(req) {
  return logger.child({
    requestId: req.id,
    method: req.method,
    path: req.path,
    ip: req.ip,
  });
}

// Uso no middleware
app.use((req, res, next) => {
  req.log = createRequestLogger(req);
  req.log.info('Request received');

  const start = Date.now();
  res.on('finish', () => {
    req.log.info('Request completed', {
      statusCode: res.statusCode,
      duration: Date.now() - start,
    });
  });

  next();
});
```

---

## 2. Request ID — Correlação

```
O superpoder do debugging em produção: rastrear UMA request
através de todos os componentes do sistema.

Fluxo:
  Client → API Gateway (gera requestId) → Service A → Service B → DB
  Todos os logs incluem o MESMO requestId

Quando user reporta erro:
  "Qual o requestId?" → grep pelo requestId → TODOS os logs daquele request
```

```javascript
// Middleware de request ID
import crypto from 'crypto';

app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] || crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
});

// Propagar para serviços downstream
async function callPaymentService(data, requestId) {
  return fetch('https://payment-api/charge', {
    headers: {
      'Content-Type': 'application/json',
      'X-Request-Id': requestId, // Propagar!
    },
    body: JSON.stringify(data),
  });
}
```

---

## 3. Grep Patterns para Debugging

```bash
# Buscar por request ID
grep "req-abc-789" /var/log/app/*.log

# Buscar erros nos últimos 30 minutos
grep -E "error|ERROR|Error" /var/log/app/app.log | \
  awk -F'"timestamp":"' '{print $2}' | \
  awk -F'"' '{if ($1 > "2025-03-02T14:00") print}'

# Buscar 500s
grep '"statusCode":500' /var/log/app/app.log

# Contar erros por endpoint
grep '"statusCode":500' app.log | \
  jq -r '.path' | sort | uniq -c | sort -rn

# Top 10 requests mais lentos
grep '"duration"' app.log | \
  jq '{path: .path, duration: .duration}' | \
  jq -s 'sort_by(.duration) | reverse | .[0:10]'

# Buscar por user específico
grep '"userId":"user-123"' app.log | tail -50

# Logs entre timestamps
awk '/2025-03-02T14:00/,/2025-03-02T14:30/' app.log

# Erros agrupados por tipo
grep '"level":"error"' app.log | \
  jq -r '.msg' | sort | uniq -c | sort -rn | head -20

# Com Docker
docker logs myapp --since "2025-03-02T14:00:00" --until "2025-03-02T15:00:00" 2>&1 | \
  grep -i error

# Com kubectl (Kubernetes)
kubectl logs deployment/myapp --since=1h | grep -i error
kubectl logs deployment/myapp --previous  # Logs do container anterior (se crashou)
```

---

## 4. O Que Logar em Cada Camada

```
MIDDLEWARE (request/response):
├── Request: method, path, requestId, IP, user-agent
├── Response: statusCode, duration
├── NÃO logar: body completo (PII), auth token, cookies
└── NÍVEL: info

CONTROLLER:
├── Ação iniciada, parâmetros validados (sanitizados)
├── Erros de validação (campo + motivo)
├── NÍVEL: info para ações, warn para validação

SERVICE (lógica de negócio):
├── Decisões de negócio ("Aplicando desconto de 10%")
├── Chamadas a dependências externas (início + fim + duração)
├── Erros de negócio (estoque insuficiente, saldo negativo)
├── NÍVEL: info para decisões, warn para regras violadas

REPOSITORY (banco):
├── Queries lentas (> threshold, ex: 1s)
├── Erros de constraint
├── NÍVEL: warn para slow queries, error para falhas

INTEGRAÇÃO EXTERNA:
├── Request: method, URL, duration (sem body completo)
├── Response: status, duration
├── Erros: status, mensagem de erro, retry count
├── NÃO logar: API keys, tokens, dados sensíveis
└── NÍVEL: info para sucesso, warn para retry, error para falha final
```

---

## 5. Log Levels — Quando Usar Cada

```
TRACE (mais verboso — geralmente desligado):
  Debug detalhado, valores de variáveis, fluxo passo a passo.
  "Entrando na função X com parâmetros Y"
  Ligar temporariamente para investigar bug específico.

DEBUG:
  Informação útil para desenvolvimento e debugging.
  "Query executada: SELECT ... (23ms)"
  "Cache hit/miss para chave X"
  Ligado em dev/staging, desligado em produção.

INFO:
  Eventos normais do sistema que confirmam que está funcionando.
  "Request completed: POST /orders 201 (142ms)"
  "User created: user-123"
  "Job processed: send-email (3 of 50)"
  SEMPRE ligado.

WARN:
  Algo inesperado que não é erro, mas merece atenção.
  "Retry 2/3 para Stripe API (timeout)"
  "Rate limit quase atingido (58/60)"
  "Deprecated API chamada por client X"
  SEMPRE ligado. Monitorar.

ERROR:
  Erro que afeta funcionalidade mas não derruba o sistema.
  "Failed to create order: insufficient stock"
  "Stripe charge failed: card_declined"
  "Unhandled error in request req-abc (stack trace)"
  SEMPRE ligado. ALERTAR.

FATAL:
  Sistema vai cair ou já caiu. Irrecuperável.
  "Database connection lost. Shutting down."
  "Out of memory. Process will be killed."
  SEMPRE ligado. ALERTAR IMEDIATAMENTE.
```

---

## 6. Debugging com Logs Temporários

```javascript
// Padrão: prefixo distinguível para fácil remoção

// 🐛 Debug temporário — REMOVER ANTES DE MERGE
logger.debug('🐛 Order data before save', { order, userId });
logger.debug('🐛 User address', { address: user.address });
logger.debug('🐛 Shipping calculation input', { zip, weight });

// Vantagens do prefixo:
// 1. grep '🐛' src/ → encontra todos os logs temporários
// 2. git diff mostra claramente o que é temporário
// 3. CI lint rule pode rejeitar PR com '🐛' no código

// Alternativa: usar DEBUG env var
if (process.env.DEBUG_SHIPPING) {
  logger.debug('Shipping debug', { zip, weight, result });
}
// Ligar em produção temporariamente sem deploy:
// DEBUG_SHIPPING=true → reiniciar container
```

---

## 7. Ferramentas de Log

| Ferramenta | Tipo | Quando usar |
|-----------|------|-------------|
| **Pino** (Node.js) | Logger | Default para apps Node. JSON, rápido. |
| **Winston** (Node.js) | Logger | Mais configurável, transports múltiplos. |
| **structlog** (Python) | Logger | Structured logging para Python. |
| **jq** | CLI | Filtrar/transformar JSON logs no terminal. |
| **Loki + Grafana** | Stack | Agregação de logs + visualização. Open source. |
| **Datadog Logs** | SaaS | Logs + APM + métricas integrado. |
| **CloudWatch** | AWS | Logs de Lambda, ECS, etc. |
| **Sentry** | SaaS | Error tracking com stack traces e context. |
| **OpenTelemetry** | Standard | Traces distribuídos (microserviços). |

### Sentry — Captura de Erros

```javascript
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1, // 10% das requests com tracing
});

// Capturar erro com contexto
app.use((err, req, res, next) => {
  Sentry.withScope((scope) => {
    scope.setUser({ id: req.user?.id });
    scope.setTag('requestId', req.id);
    scope.setExtra('body', sanitize(req.body));
    Sentry.captureException(err);
  });
  next(err);
});
```
