# OAuth & Webhooks — Autenticação Delegada e Eventos

## Índice
1. OAuth2 — Flows e Quando Usar
2. Authorization Code Flow (Login Social)
3. Client Credentials Flow (Server-to-Server)
4. Token Refresh
5. Webhook Receiver
6. Webhook Signature Validation
7. Polling como Alternativa

---

## 1. OAuth2 — Flows e Quando Usar

| Flow | Quando | Exemplo |
|------|--------|---------|
| **Authorization Code** | User faz login via terceiro | "Login com Google/GitHub" |
| **Authorization Code + PKCE** | SPA ou mobile (sem backend secret) | App React + Google |
| **Client Credentials** | Server-to-server, sem user | Seu backend → API do parceiro |
| **Device Code** | Dispositivos sem browser (TV, CLI) | CLI do GitHub |

---

## 2. Authorization Code Flow (Login Social)

```
1. User clica "Login com Google"
2. Redirect para Google com client_id + redirect_uri + scope
3. User autoriza no Google
4. Google redireciona de volta com ?code=XXXXX
5. Seu backend troca o code por access_token (server-side)
6. Usa access_token para buscar dados do user
```

### Implementação

```javascript
import axios from 'axios';

// 1. Gerar URL de autorização
router.get('/auth/google', (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  req.session.oauthState = state; // Proteção CSRF

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: `${process.env.APP_URL}/auth/google/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'offline', // Para refresh token
  });

  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

// 2. Callback — trocar code por tokens
router.get('/auth/google/callback', async (req, res) => {
  const { code, state } = req.query;

  // Validar state (CSRF)
  if (state !== req.session.oauthState) {
    return res.status(403).json({ error: { code: 'CSRF_MISMATCH', message: 'State inválido' } });
  }

  // Trocar code por token (server-to-server, seguro)
  const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
    code,
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    redirect_uri: `${process.env.APP_URL}/auth/google/callback`,
    grant_type: 'authorization_code',
  });

  const { access_token, refresh_token, id_token } = tokenResponse.data;

  // Buscar dados do user
  const userInfo = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${access_token}` },
  });

  // Criar ou atualizar user no seu banco
  const user = await userService.findOrCreateByOAuth({
    provider: 'google',
    providerId: userInfo.data.id,
    email: userInfo.data.email,
    name: userInfo.data.name,
    avatarUrl: userInfo.data.picture,
  });

  // Gerar SEU token JWT
  const tokens = generateTokens(user);
  res.redirect(`${process.env.FRONTEND_URL}/auth/success?token=${tokens.accessToken}`);
});
```

---

## 3. Client Credentials Flow (Server-to-Server)

```javascript
// Quando SEU servidor precisa autenticar com API de terceiro

class OAuthClient {
  private accessToken: string | null = null;
  private expiresAt = 0;

  constructor(
    private tokenUrl: string,
    private clientId: string,
    private clientSecret: string,
    private scope?: string,
  ) {}

  async getToken(): Promise<string> {
    // Reusar token se ainda válido
    if (this.accessToken && Date.now() < this.expiresAt - 60000) {
      return this.accessToken;
    }

    const response = await axios.post(this.tokenUrl, new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.clientId,
      client_secret: this.clientSecret,
      ...(this.scope && { scope: this.scope }),
    }), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    this.accessToken = response.data.access_token;
    this.expiresAt = Date.now() + (response.data.expires_in * 1000);

    return this.accessToken;
  }

  // HTTP client que auto-refresha o token
  async request(method: string, url: string, data?: any) {
    const token = await this.getToken();
    return axios({ method, url, data, headers: { Authorization: `Bearer ${token}` } });
  }
}

// Uso
const partnerApi = new OAuthClient(
  'https://partner.com/oauth/token',
  process.env.PARTNER_CLIENT_ID,
  process.env.PARTNER_CLIENT_SECRET,
  'read write',
);

const response = await partnerApi.request('GET', 'https://partner.com/api/data');
```

---

## 4. Token Refresh

```javascript
// Interceptor que auto-refresha quando recebe 401
function createAuthenticatedClient(baseURL, getAccessToken, refreshAccessToken) {
  const client = axios.create({ baseURL });
  let isRefreshing = false;
  let refreshPromise = null;

  client.interceptors.request.use(async (config) => {
    const token = await getAccessToken();
    config.headers.Authorization = `Bearer ${token}`;
    return config;
  });

  client.interceptors.response.use(
    (response) => response,
    async (error) => {
      if (error.response?.status !== 401) throw error;

      // Evitar múltiplos refreshes simultâneos
      if (!isRefreshing) {
        isRefreshing = true;
        refreshPromise = refreshAccessToken()
          .finally(() => { isRefreshing = false; });
      }

      await refreshPromise;

      // Retry o request original com novo token
      const token = await getAccessToken();
      error.config.headers.Authorization = `Bearer ${token}`;
      return client(error.config);
    }
  );

  return client;
}
```

---

## 5. Webhook Receiver

### Endpoint seguro

```javascript
// POST /api/webhooks/stripe — recebe eventos da Stripe

router.post('/webhooks/stripe',
  express.raw({ type: 'application/json' }), // Body RAW para validar signature
  async (req, res) => {
    // 1. Validar assinatura (ver seção 6)
    const event = validateStripeSignature(req);
    if (!event) {
      return res.status(400).json({ error: 'Invalid signature' });
    }

    // 2. Responder 200 IMEDIATAMENTE (antes de processar)
    res.status(200).json({ received: true });

    // 3. Processar ASSINCRONAMENTE (queue)
    try {
      await webhookQueue.add('stripe', {
        eventId: event.id,
        type: event.type,
        data: event.data,
      });
    } catch (error) {
      logger.error('Failed to queue webhook', { eventId: event.id, error });
    }
  }
);

// Worker que processa os eventos
webhookQueue.process('stripe', async (job) => {
  const { eventId, type, data } = job.data;

  // Idempotência: verificar se já processou este evento
  const processed = await redis.get(`webhook:${eventId}`);
  if (processed) {
    logger.info('Webhook already processed', { eventId });
    return;
  }

  // Processar por tipo de evento
  switch (type) {
    case 'payment_intent.succeeded':
      await orderService.confirmPayment(data.object.metadata.orderId);
      break;
    case 'payment_intent.payment_failed':
      await orderService.failPayment(data.object.metadata.orderId);
      break;
    case 'customer.subscription.deleted':
      await subscriptionService.cancel(data.object.id);
      break;
    default:
      logger.info('Unhandled webhook type', { type });
  }

  // Marcar como processado
  await redis.set(`webhook:${eventId}`, '1', 'EX', 86400 * 7); // 7 dias
});
```

### Boas práticas de webhook

```
1. Responder 200 RÁPIDO (< 5s), processar depois via queue
2. Validar assinatura SEMPRE (nunca confiar no body sem validar)
3. Implementar idempotência (mesmo evento pode ser enviado 2x)
4. Logar todo evento recebido (debug + audit trail)
5. Ter endpoint de re-processamento (admin) para eventos falhados
6. Monitorar falhas e taxa de eventos processados
```

---

## 6. Webhook Signature Validation

```javascript
// Stripe
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

function validateStripeSignature(req) {
  const signature = req.headers['stripe-signature'];
  try {
    return stripe.webhooks.constructEvent(req.body, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    logger.warn('Invalid Stripe webhook signature', { error: err.message });
    return null;
  }
}

// Genérico (HMAC SHA-256) — usado por GitHub, Slack, etc.
function validateHmacSignature(body, signature, secret) {
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
  const provided = signature.replace('sha256=', '');
  // Timing-safe comparison (previne timing attack)
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
}
```

---

## 7. Polling como Alternativa

```javascript
// Quando o terceiro NÃO tem webhooks, polling é necessário

class Poller {
  constructor(
    private name: string,
    private fn: () => Promise<void>,
    private intervalMs: number,
  ) {}

  private running = false;
  private timer: NodeJS.Timeout | null = null;

  start() {
    if (this.running) return;
    this.running = true;
    this.tick();
    logger.info(`Poller ${this.name} started (every ${this.intervalMs}ms)`);
  }

  stop() {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
    logger.info(`Poller ${this.name} stopped`);
  }

  private async tick() {
    if (!this.running) return;
    try {
      await this.fn();
    } catch (error) {
      logger.error(`Poller ${this.name} error`, { error: error.message });
    }
    this.timer = setTimeout(() => this.tick(), this.intervalMs);
  }
}

// Uso: checar status de pagamentos pendentes a cada 30s
const paymentPoller = new Poller('payment-status', async () => {
  const pending = await orderService.findPendingPayments();
  for (const order of pending) {
    const status = await paymentClient.getStatus(order.paymentId);
    if (status !== 'pending') {
      await orderService.updatePaymentStatus(order.id, status);
    }
  }
}, 30000);

paymentPoller.start();
process.on('SIGTERM', () => paymentPoller.stop());
```
