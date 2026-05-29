# Resilience Patterns — Retry, Circuit Breaker, Timeout, Fallback

## Índice
1. Timeout (Sempre Primeiro)
2. Retry com Backoff Exponencial
3. Circuit Breaker
4. Fallback
5. Idempotency Key
6. Bulkhead (Isolamento)
7. Stack Completo de Resiliência

---

## 1. Timeout (Sempre Primeiro)

```
TODA chamada externa DEVE ter timeout. Sem exceção.

Sem timeout = uma API lenta trava TODO o seu sistema.
100 requests esperando resposta = 100 threads/connections bloqueadas
= connection pool esgotado = seu sistema inteiro cai.
```

```javascript
// Axios
const response = await axios.get(url, { timeout: 10000 }); // 10s

// Fetch (nativo)
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 10000);
try {
  const response = await fetch(url, { signal: controller.signal });
} finally {
  clearTimeout(timeoutId);
}

// Node.js fetch com timeout nativo (Node 18+)
const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
```

### Timeouts recomendados

| Tipo de chamada | Timeout |
|----------------|---------|
| API de pagamento | 30s (operações lentas) |
| API de email | 10s |
| API de busca/dados | 5s |
| API interna (mesmo datacenter) | 3s |
| Health check | 2s |
| DNS / Redis | 1s |

---

## 2. Retry com Backoff Exponencial

### Por que backoff exponencial?

```
Retry imediato:
  Request 1 falha  → Retry imediato
  Request 2 falha  → Retry imediato
  Todos os 1000 clients fazem isso ao mesmo tempo
  = THUNDERING HERD = API de terceiro cai de vez

Backoff exponencial + jitter:
  Request 1 falha  → Espera 1s + random(0-500ms)
  Request 2 falha  → Espera 2s + random(0-1000ms)
  Request 3 falha  → Espera 4s + random(0-2000ms)
  Requests se espalham no tempo = API se recupera
```

### Implementação

```typescript
interface RetryConfig {
  maxRetries: number;
  baseDelay: number;     // ms
  maxDelay: number;      // ms
  retryableStatuses: number[];
}

const DEFAULT_RETRY: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  retryableStatuses: [408, 429, 500, 502, 503, 504],
};

async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Não retry se não é retryable
      if (error.response && !config.retryableStatuses.includes(error.response.status)) {
        throw error; // 400, 401, 403, 404 — não adianta retry
      }

      if (attempt === config.maxRetries) break;

      // Backoff exponencial + jitter
      const delay = Math.min(
        config.baseDelay * Math.pow(2, attempt),
        config.maxDelay
      );
      const jitter = delay * (0.5 + Math.random() * 0.5);

      // Respeitar Retry-After header se presente
      const retryAfter = error.response?.headers?.['retry-after'];
      const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : jitter;

      logger.warn('Retrying request', { attempt: attempt + 1, waitTime, error: error.message });
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  throw lastError!;
}

// Uso
const data = await withRetry(() => paymentClient.charge(input));
```

### O que é retryable

```
RETRY (transiente — pode funcionar na próxima):
├── 408 Request Timeout
├── 429 Too Many Requests (respeitar Retry-After!)
├── 500 Internal Server Error
├── 502 Bad Gateway
├── 503 Service Unavailable
├── 504 Gateway Timeout
├── Network error (ECONNRESET, ENOTFOUND)
└── Timeout (ECONNABORTED)

NÃO RETRY (permanente — retry não vai resolver):
├── 400 Bad Request (seu input está errado)
├── 401 Unauthorized (credencial inválida)
├── 403 Forbidden (sem permissão)
├── 404 Not Found (recurso não existe)
└── 422 Unprocessable (regra de negócio)
```

---

## 3. Circuit Breaker

### Conceito

```
Estado CLOSED (normal):
  Requests passam normalmente.
  Se X falhas consecutivas → abre o circuito.

Estado OPEN (bloqueado):
  Requests falham IMEDIATAMENTE (sem chamar a API).
  Economiza recursos, evita sobrecarregar API doente.
  Após Y segundos → vai para half-open.

Estado HALF-OPEN (teste):
  Permite 1 request para testar.
  Se sucesso → fecha o circuito (normal).
  Se falha → abre novamente.

Closed → [X falhas] → Open → [Y segundos] → Half-Open → [sucesso] → Closed
                                                        → [falha]  → Open
```

### Implementação

```typescript
enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

class CircuitBreaker {
  private state = CircuitState.CLOSED;
  private failureCount = 0;
  private lastFailureTime = 0;
  private readonly failureThreshold: number;
  private readonly resetTimeout: number; // ms

  constructor(
    private name: string,
    options: { failureThreshold?: number; resetTimeout?: number } = {}
  ) {
    this.failureThreshold = options.failureThreshold ?? 5;
    this.resetTimeout = options.resetTimeout ?? 30000; // 30s
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = CircuitState.HALF_OPEN;
        logger.info(`Circuit ${this.name}: OPEN → HALF_OPEN`);
      } else {
        throw new CircuitOpenError(this.name);
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    if (this.state === CircuitState.HALF_OPEN) {
      logger.info(`Circuit ${this.name}: HALF_OPEN → CLOSED`);
    }
    this.failureCount = 0;
    this.state = CircuitState.CLOSED;
  }

  private onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.failureCount >= this.failureThreshold) {
      this.state = CircuitState.OPEN;
      logger.error(`Circuit ${this.name}: → OPEN (${this.failureCount} failures)`);
    }
  }

  getState() { return this.state; }
}

// Uso
const stripeCircuit = new CircuitBreaker('stripe', { failureThreshold: 5, resetTimeout: 30000 });

async function processPayment(input) {
  try {
    return await stripeCircuit.execute(() => paymentClient.charge(input));
  } catch (error) {
    if (error instanceof CircuitOpenError) {
      // Fallback: enfileirar para processar depois
      await retryQueue.add('payment', input);
      return { status: 'queued', message: 'Pagamento será processado em breve' };
    }
    throw error;
  }
}
```

---

## 4. Fallback

```typescript
// Fallback = o que fazer quando a API externa falha

// Estratégia 1: Cache stale (retornar dado antigo)
async function getExchangeRate(currency) {
  try {
    const rate = await exchangeClient.getRate(currency);
    await redis.set(`rate:${currency}`, rate, 'EX', 3600); // Cache 1h
    return rate;
  } catch {
    const cached = await redis.get(`rate:${currency}`);
    if (cached) {
      logger.warn('Using cached exchange rate', { currency });
      return Number(cached);
    }
    throw new ExternalServiceError('Exchange API', 'Indisponível');
  }
}

// Estratégia 2: Degradação graceful
async function getProductRecommendations(userId) {
  try {
    return await recommendationClient.getForUser(userId);
  } catch {
    // Fallback: retornar produtos populares (estáticos)
    return await productService.getPopular(10);
  }
}

// Estratégia 3: Queue para processamento posterior
async function sendOrderConfirmation(order) {
  try {
    await emailClient.send({ to: order.userEmail, template: 'order-confirmation', data: order });
  } catch {
    // Não falhar o pedido por causa de email
    await retryQueue.add('send-email', { orderId: order.id, type: 'confirmation' });
    logger.warn('Email queued for retry', { orderId: order.id });
  }
}
```

---

## 5. Idempotency Key

```
POST /api/orders (sem idempotency) → enviado 2x = 2 pedidos criados!
POST /api/orders (com idempotency) → enviado 2x = 1 pedido criado, 2o retorna o mesmo

Essencial para: pagamentos, criação de recursos, qualquer operação com efeito colateral.
```

### Como provider (sua API)

```javascript
// Middleware de idempotency
async function idempotency(req, res, next) {
  const key = req.headers['idempotency-key'];
  if (!key) return next(); // Sem key = não idempotente

  const cached = await redis.get(`idempotency:${key}`);
  if (cached) {
    const { status, body } = JSON.parse(cached);
    return res.status(status).json(body);
  }

  // Interceptar o response para cachear
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    redis.set(`idempotency:${key}`, JSON.stringify({ status: res.statusCode, body }), 'EX', 86400);
    return originalJson(body);
  };
  next();
}

app.post('/api/orders', authenticate, idempotency, orderController.create);
```

### Como consumer (chamando API de terceiro)

```javascript
// Gerar idempotency key determinística baseada na operação
import crypto from 'crypto';

function generateIdempotencyKey(operation, ...params) {
  const input = [operation, ...params].join(':');
  return crypto.createHash('sha256').update(input).digest('hex');
}

// Uso: mesma order + mesmo amount = mesma key
const key = generateIdempotencyKey('charge', orderId, amount);
await paymentClient.charge({ amount, idempotencyKey: key });
```

---

## 6. Bulkhead (Isolamento)

```
Bulkhead = isolar pools de conexão por integração.

Sem bulkhead:
  App tem 1 pool de 10 conexões HTTP
  Stripe fica lento → 10 conexões presas no Stripe
  SendGrid, S3, Google → todas sem conexão = tudo para

Com bulkhead:
  Stripe pool: 4 conexões
  SendGrid pool: 3 conexões
  S3 pool: 3 conexões
  Stripe fica lento → apenas 4 conexões presas
  SendGrid e S3 continuam funcionando normalmente
```

```javascript
// Implementar com agent por provider
import { Agent } from 'http';

const stripeAgent = new Agent({ maxSockets: 10, maxFreeSockets: 5 });
const sendgridAgent = new Agent({ maxSockets: 5, maxFreeSockets: 2 });

// Ou com p-limit (limitar concorrência)
import pLimit from 'p-limit';
const stripeLimit = pLimit(10);  // Max 10 chamadas simultâneas
const result = await stripeLimit(() => stripeClient.charge(input));
```

---

## 7. Stack Completo de Resiliência

```
Request
  ↓
[Timeout: 10s]
  ↓
[Circuit Breaker: 5 falhas → open 30s]
  ↓
[Retry: 3 tentativas, backoff exponencial]
  ↓
[Idempotency Key: evitar duplicação]
  ↓
[Bulkhead: pool isolado por provider]
  ↓
API Externa
  ↓
[Error Mapping: erro do terceiro → erro do domínio]
  ↓
[Fallback: cache stale / queue / degradação]
  ↓
Response
```

```typescript
// Composição prática
async function callExternalApi(fn, options) {
  return circuitBreaker.execute(() =>
    withRetry(() =>
      withTimeout(fn, options.timeout),
      { maxRetries: options.retries }
    )
  );
}
```
