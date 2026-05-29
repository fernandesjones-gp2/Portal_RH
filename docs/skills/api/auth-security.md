# Auth & Security — JWT, API Keys, RBAC, Rate Limiting, CORS

## Índice
1. Estratégias de Autenticação
2. JWT — Implementação Segura
3. API Keys
4. RBAC — Role-Based Access Control
5. Ownership Check (ABAC simplificado)
6. Rate Limiting
7. CORS
8. Middleware Stack Completo

---

## 1. Estratégias de Autenticação

| Método | Quando usar | Segurança |
|--------|------------|-----------|
| **JWT Bearer** | Apps com login (SPA, mobile) | Alta — stateless, expiração curta |
| **API Key** | Server-to-server, integrações | Média — sem expiração automática |
| **OAuth2** | Login social, acesso delegado | Alta — padrão da indústria |
| **Session cookie** | Apps tradicionais (SSR) | Alta — httpOnly, sameSite |

---

## 2. JWT — Implementação Segura

### Geração de tokens

```javascript
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET; // 64+ chars, aleatório
const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL = '7d';

function generateTokens(user) {
  const payload = {
    sub: user.id,       // Subject — ID do usuário
    role: user.role,    // Para RBAC
    // NÃO incluir: email, nome, dados pessoais (token é decodável)
  };

  const accessToken = jwt.sign(payload, JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_TTL,
    algorithm: 'HS256',
  });

  const refreshToken = jwt.sign(
    { sub: user.id, type: 'refresh' },
    JWT_SECRET,
    { expiresIn: REFRESH_TOKEN_TTL, algorithm: 'HS256' }
  );

  return { accessToken, refreshToken, expiresIn: 900 }; // 15min em segundos
}
```

### Middleware de autenticação

```javascript
function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Token ausente' }
    });
  }

  try {
    const token = header.slice(7);
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    req.user = { id: decoded.sub, role: decoded.role };
    next();
  } catch (err) {
    const message = err.name === 'TokenExpiredError' ? 'Token expirado' : 'Token inválido';
    return res.status(401).json({
      error: { code: 'UNAUTHORIZED', message }
    });
  }
}
```

### Refresh token flow

```javascript
router.post('/auth/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'refreshToken obrigatório' } });

  try {
    const decoded = jwt.verify(refreshToken, JWT_SECRET, { algorithms: ['HS256'] });
    if (decoded.type !== 'refresh') throw new Error('Invalid token type');

    // Verificar se o user ainda existe e está ativo
    const user = await userService.findById(decoded.sub);
    if (!user || user.status !== 'active') {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Usuário inativo' } });
    }

    const tokens = generateTokens(user);
    res.json({ data: tokens });
  } catch {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Refresh token inválido' } });
  }
});
```

---

## 3. API Keys

```javascript
// Geração
import crypto from 'crypto';

function generateApiKey() {
  const prefix = 'sk_live_'; // sk_test_ para sandbox
  const key = crypto.randomBytes(32).toString('hex');
  return prefix + key;
  // Armazenar HASH no banco, retornar plain-text apenas uma vez
}

// Middleware
async function authenticateApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey) {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'API key ausente' } });
  }

  const hash = crypto.createHash('sha256').update(apiKey).digest('hex');
  const client = await apiKeyService.findByHash(hash);

  if (!client || client.revokedAt) {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'API key inválida' } });
  }

  req.client = { id: client.id, name: client.name, scopes: client.scopes };
  next();
}
```

---

## 4. RBAC — Role-Based Access Control

```javascript
// Middleware de autorização por role
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Não autenticado' } });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Sem permissão' } });
    }
    next();
  };
}

// Uso
router.get('/admin/users', authenticate, authorize('admin'), userController.list);
router.get('/orders', authenticate, authorize('admin', 'user'), orderController.list);
router.delete('/admin/users/:id', authenticate, authorize('admin'), userController.delete);
```

### Permissões granulares (scopes)

```javascript
const PERMISSIONS = {
  admin: ['users:read', 'users:write', 'orders:read', 'orders:write', 'reports:read'],
  manager: ['orders:read', 'orders:write', 'reports:read'],
  user: ['orders:read', 'orders:write:own'],
};

function requirePermission(permission) {
  return (req, res, next) => {
    const userPerms = PERMISSIONS[req.user.role] || [];
    if (!userPerms.includes(permission)) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: `Requer permissão: ${permission}` } });
    }
    next();
  };
}
```

---

## 5. Ownership Check

```javascript
// Garantir que o usuário só acessa seus próprios recursos
// É o fix para IDOR (Insecure Direct Object Reference)

async function requireOwnership(resourceName, getResourceUserId) {
  return async (req, res, next) => {
    if (req.user.role === 'admin') return next(); // Admin bypassa

    const resourceUserId = await getResourceUserId(req);
    if (resourceUserId !== req.user.id) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: `${resourceName} não encontrado` }
        // 404 em vez de 403 — não revelar que o recurso existe
      });
    }
    next();
  };
}

// Uso: buscar order e verificar que pertence ao user
router.get('/orders/:id',
  authenticate,
  requireOwnership('Pedido', async (req) => {
    const order = await orderService.findById(req.params.id);
    return order?.userId;
  }),
  orderController.show
);
```

---

## 6. Rate Limiting

```javascript
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { Redis } from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

// Rate limiter geral (60 req/min)
const generalLimiter = rateLimit({
  store: new RedisStore({ sendCommand: (...args) => redis.call(...args) }),
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,         // RateLimit-* headers
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip, // Por user se autenticado
  handler: (req, res) => {
    res.status(429).json({
      error: {
        code: 'RATE_LIMITED',
        message: 'Muitas requisições. Tente novamente em breve.',
        retryAfter: res.getHeader('Retry-After'),
      }
    });
  },
});

// Rate limiter para auth (5 req/min — protege contra brute force)
const authLimiter = rateLimit({
  store: new RedisStore({ sendCommand: (...args) => redis.call(...args) }),
  windowMs: 60 * 1000,
  max: 5,
  keyGenerator: (req) => req.ip,
  skipSuccessfulRequests: true,  // Só conta falhas
});

// Rate limiter por API key (tier-based)
function apiKeyLimiter(req, res, next) {
  const tier = req.client?.tier || 'free';
  const limits = { free: 100, pro: 1000, enterprise: 10000 };
  const limiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hora
    max: limits[tier],
  });
  return limiter(req, res, next);
}

// Aplicar
app.use('/api/', generalLimiter);
app.use('/api/auth/', authLimiter);
```

---

## 7. CORS

```javascript
import cors from 'cors';

// Produção — origins explícitas
const corsOptions = {
  origin: [
    'https://app.example.com',
    'https://admin.example.com',
    process.env.NODE_ENV === 'development' && 'http://localhost:3000',
  ].filter(Boolean),
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
  exposedHeaders: ['X-Total-Count', 'X-Request-Id', 'RateLimit-Remaining'],
  credentials: true,
  maxAge: 86400, // Cache preflight por 24h
};

app.use(cors(corsOptions));

// NUNCA em produção:
// app.use(cors({ origin: '*' })); // Permite QUALQUER origin
```

---

## 8. Middleware Stack Completo

```javascript
// Ordem importa! De fora para dentro:

// 1. Request ID (correlação de logs)
app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] || crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
});

// 2. CORS
app.use(cors(corsOptions));

// 3. Body parsing
app.use(express.json({ limit: '1mb' }));

// 4. Rate limiting (geral)
app.use('/api/', generalLimiter);

// 5. Rate limiting (auth — mais restritivo)
app.use('/api/auth/', authLimiter);

// 6. Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    logger.info('request', {
      method: req.method, path: req.path, status: res.statusCode,
      duration: Date.now() - start, requestId: req.id,
    });
  });
  next();
});

// 7. Rotas públicas (sem auth)
app.use('/api/auth', authRoutes);
app.use('/api/health', healthRoutes);

// 8. Autenticação (tudo abaixo requer token)
app.use('/api', authenticate);

// 9. Rotas protegidas
app.use('/api/orders', orderRoutes);
app.use('/api/users', userRoutes);

// 10. Error handler (sempre por último)
app.use(errorHandler);
```
