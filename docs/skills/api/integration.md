# Integration — SDK Wrappers, HTTP Clients e Error Mapping

## Índice
1. Princípio do Wrapper
2. Anatomia de um API Client
3. HTTP Client Configurado
4. Error Mapping
5. Request/Response Logging
6. Exemplos: Stripe, SendGrid, S3

---

## 1. Princípio do Wrapper

```
NUNCA chamar API de terceiro diretamente no código de negócio.

❌ Acoplamento direto
async function createOrder(data) {
  const charge = await fetch('https://api.stripe.com/v1/charges', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer sk_...' },
    body: new URLSearchParams({ amount: data.total, currency: 'brl' }),
  });
  // URL, auth, formato do body, tratamento de erro — tudo no service
}

✅ Via wrapper
async function createOrder(data) {
  const charge = await paymentClient.charge({
    amount: data.total,
    currency: 'brl',
  });
  // Service só conhece a interface — não URL, auth, nem formato
}
```

### Benefícios do wrapper

```
├── Trocar provider (Stripe → Adyen) = mudar 1 arquivo
├── Testar = mockar o client, não HTTP
├── Retry, timeout, circuit breaker = 1 lugar
├── Logging = centralizado
├── Error mapping = erros do terceiro → erros do seu domínio
└── Type safety = interface tipada para toda chamada
```

---

## 2. Anatomia de um API Client

```typescript
// clients/payment-client.ts

interface PaymentClient {
  charge(input: ChargeInput): Promise<ChargeResult>;
  refund(chargeId: string, amount?: number): Promise<RefundResult>;
  getCharge(chargeId: string): Promise<ChargeResult>;
}

interface ChargeInput {
  amount: number;       // Centavos
  currency: string;     // 'brl', 'usd'
  customerId?: string;
  metadata?: Record<string, string>;
  idempotencyKey: string;
}

interface ChargeResult {
  id: string;
  status: 'succeeded' | 'pending' | 'failed';
  amount: number;
  currency: string;
  createdAt: Date;
}

// Implementação para Stripe
class StripePaymentClient implements PaymentClient {
  private http: HttpClient;

  constructor(apiKey: string, options?: ClientOptions) {
    this.http = new HttpClient({
      baseURL: 'https://api.stripe.com/v1',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      timeout: options?.timeout ?? 10000,
      retries: options?.retries ?? 3,
    });
  }

  async charge(input: ChargeInput): Promise<ChargeResult> {
    try {
      const response = await this.http.post('/charges', {
        amount: input.amount,
        currency: input.currency,
        customer: input.customerId,
        metadata: input.metadata,
      }, {
        headers: { 'Idempotency-Key': input.idempotencyKey },
      });

      return this.mapChargeResponse(response.data);
    } catch (error) {
      throw this.mapError(error);
    }
  }

  private mapChargeResponse(data: any): ChargeResult {
    return {
      id: data.id,
      status: data.status === 'succeeded' ? 'succeeded'
            : data.status === 'pending' ? 'pending' : 'failed',
      amount: data.amount,
      currency: data.currency,
      createdAt: new Date(data.created * 1000),
    };
  }

  private mapError(error: any): AppError {
    if (error.response?.status === 402) {
      return new PaymentDeclinedError(error.response.data.error.message);
    }
    if (error.response?.status === 429) {
      return new RateLimitedError('Payment provider', error.response.headers['retry-after']);
    }
    if (error.code === 'ECONNABORTED') {
      return new ExternalServiceTimeoutError('Stripe');
    }
    return new ExternalServiceError('Stripe', error.message);
  }
}
```

---

## 3. HTTP Client Configurado

```typescript
// lib/http-client.ts — Client base com retry, timeout, logging

import axios, { AxiosInstance, AxiosError } from 'axios';

interface HttpClientConfig {
  baseURL: string;
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

class HttpClient {
  private client: AxiosInstance;
  private retries: number;
  private retryDelay: number;

  constructor(config: HttpClientConfig) {
    this.retries = config.retries ?? 3;
    this.retryDelay = config.retryDelay ?? 1000;

    this.client = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout ?? 10000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'MyApp/1.0',
        ...config.headers,
      },
    });

    // Request interceptor — logging
    this.client.interceptors.request.use((req) => {
      req.metadata = { startTime: Date.now() };
      logger.debug('HTTP Request', {
        method: req.method?.toUpperCase(),
        url: req.baseURL + req.url,
      });
      return req;
    });

    // Response interceptor — logging + metrics
    this.client.interceptors.response.use(
      (res) => {
        const duration = Date.now() - res.config.metadata.startTime;
        logger.debug('HTTP Response', {
          method: res.config.method?.toUpperCase(),
          url: res.config.baseURL + res.config.url,
          status: res.status,
          duration,
        });
        metrics.httpExternalDuration.observe({ provider: config.baseURL }, duration);
        return res;
      },
      (err) => {
        const duration = Date.now() - (err.config?.metadata?.startTime || Date.now());
        logger.warn('HTTP Error', {
          method: err.config?.method?.toUpperCase(),
          url: err.config?.baseURL + err.config?.url,
          status: err.response?.status,
          duration,
          message: err.message,
        });
        throw err;
      }
    );
  }

  async get(url: string, config?: any) { return this.withRetry(() => this.client.get(url, config)); }
  async post(url: string, data?: any, config?: any) { return this.withRetry(() => this.client.post(url, data, config)); }
  async put(url: string, data?: any, config?: any) { return this.withRetry(() => this.client.put(url, data, config)); }
  async delete(url: string, config?: any) { return this.withRetry(() => this.client.delete(url, config)); }

  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error;
    for (let attempt = 0; attempt <= this.retries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        if (!this.isRetryable(error as AxiosError) || attempt === this.retries) throw error;
        const delay = this.retryDelay * Math.pow(2, attempt) * (0.5 + Math.random() * 0.5);
        await new Promise(r => setTimeout(r, delay));
      }
    }
    throw lastError!;
  }

  private isRetryable(error: AxiosError): boolean {
    if (!error.response) return true; // Network error, timeout
    return [408, 429, 500, 502, 503, 504].includes(error.response.status);
  }
}
```

---

## 4. Error Mapping

```typescript
// Mapear erros de terceiro para erros do SEU domínio

// Seus erros (do domínio)
class ExternalServiceError extends AppError {
  constructor(service: string, message: string) {
    super('EXTERNAL_SERVICE_ERROR', `${service}: ${message}`, 502);
  }
}
class ExternalServiceTimeoutError extends AppError {
  constructor(service: string) {
    super('EXTERNAL_SERVICE_TIMEOUT', `${service} não respondeu a tempo`, 504);
  }
}
class PaymentDeclinedError extends AppError {
  constructor(reason: string) {
    super('PAYMENT_DECLINED', reason, 422);
  }
}
class RateLimitedError extends AppError {
  constructor(service: string, retryAfter?: string) {
    super('RATE_LIMITED', `${service} limitou as requisições`, 429);
    this.retryAfter = retryAfter;
  }
}

// No service — tratar o erro mapeado, não o erro raw
async function processPayment(order) {
  try {
    const charge = await paymentClient.charge({
      amount: order.total,
      currency: 'brl',
      idempotencyKey: order.id,
    });
    return charge;
  } catch (error) {
    if (error instanceof PaymentDeclinedError) {
      // Lógica de negócio: notificar user, marcar order
      await orderService.markPaymentFailed(order.id, error.message);
      throw error; // Propagar para o controller
    }
    if (error instanceof ExternalServiceError) {
      // Lógica de resiliência: enfileirar para retry
      await retryQueue.add('process-payment', { orderId: order.id });
      throw error;
    }
    throw error; // Erro inesperado
  }
}
```

---

## 5. Request/Response Logging

```
O que logar:
├── Method, URL, status code, duration
├── Request ID (correlação)
├── Provider name (stripe, sendgrid)
└── Error message (quando falha)

O que NUNCA logar:
├── API keys, tokens, secrets
├── Body completo do request (pode ter PII)
├── Body completo do response (pode ter PII)
├── Dados de cartão de crédito
└── Senhas, CPF, dados pessoais
```

---

## 6. Exemplos Rápidos

### Stripe

```javascript
// Usando SDK oficial (recomendado quando existe)
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-12-18.acacia' });

// Wrapper mínimo
class StripeClient {
  async createPaymentIntent(amount, currency, metadata) {
    return stripe.paymentIntents.create({
      amount, currency, metadata,
      automatic_payment_methods: { enabled: true },
    });
  }
}
```

### SendGrid

```javascript
import sgMail from '@sendgrid/mail';
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

class EmailClient {
  async send({ to, subject, html }) {
    try {
      await sgMail.send({ to, from: process.env.FROM_EMAIL, subject, html });
    } catch (error) {
      throw new ExternalServiceError('SendGrid', error.message);
    }
  }
}
```

### S3

```javascript
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

class StorageClient {
  private s3 = new S3Client({ region: process.env.AWS_REGION });

  async upload(key, body, contentType) {
    await this.s3.send(new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    }));
    return `https://${process.env.S3_BUCKET}.s3.amazonaws.com/${key}`;
  }
}
```
