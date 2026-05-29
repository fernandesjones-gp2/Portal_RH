# Hardening — Headers, TLS, Dependencies, Docker, Cloud

## Índice
1. Security Headers
2. TLS / HTTPS
3. Dependency Security
4. Docker Hardening
5. Cloud Security Basics
6. API Hardening
7. Hardening Express (Exemplo Completo)

---

## 1. Security Headers

```javascript
// Com Helmet.js (Express)
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],                      // Sem inline scripts
      styleSrc: ["'self'", "'unsafe-inline'"],     // Inline styles (necessário para muitos frameworks)
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.stripe.com"], // APIs permitidas
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      frameSrc: ["'none'"],                        // Sem iframes
      objectSrc: ["'none'"],                       // Sem plugins
      upgradeInsecureRequests: [],                 // Força HTTPS
    },
  },
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: true,
  crossOriginResourcePolicy: { policy: 'same-origin' },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  noSniff: true,                    // X-Content-Type-Options: nosniff
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xssFilter: true,                  // X-XSS-Protection
}));

// Headers adicionais
app.use((req, res, next) => {
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.removeHeader('X-Powered-By'); // Não revelar framework
  next();
});
```

### Tabela de headers

| Header | Valor | O que previne |
|--------|-------|-------------|
| `Content-Security-Policy` | Ver acima | XSS, injection de scripts |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | Downgrade para HTTP |
| `X-Content-Type-Options` | `nosniff` | MIME type sniffing |
| `X-Frame-Options` | `DENY` | Clickjacking |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Leak de URL para terceiros |
| `Permissions-Policy` | `camera=(), microphone=()` | Acesso a features do browser |
| `X-XSS-Protection` | `1; mode=block` | XSS (legacy browsers) |
| `Cross-Origin-Opener-Policy` | `same-origin` | Side-channel attacks (Spectre) |

### Verificar headers

```bash
# Testar headers de segurança
curl -I https://yoursite.com

# Ferramentas online:
# https://securityheaders.com
# https://observatory.mozilla.org
```

---

## 2. TLS / HTTPS

```
Configuração mínima:
├── TLS 1.2+ (desabilitar TLS 1.0 e 1.1)
├── Cipher suites fortes (ECDHE, AES-GCM)
├── Certificate válido (Let's Encrypt = grátis)
├── HSTS com preload (forçar HTTPS sempre)
├── Redirect HTTP → HTTPS (301 permanente)
└── Certificate renewal automatizado

Nginx — configuração TLS:
```

```nginx
server {
    listen 443 ssl http2;
    server_name example.com;

    ssl_certificate /etc/ssl/certs/example.com.pem;
    ssl_certificate_key /etc/ssl/private/example.com.key;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers on;

    # HSTS
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;

    # OCSP stapling
    ssl_stapling on;
    ssl_stapling_verify on;
}

# Redirect HTTP → HTTPS
server {
    listen 80;
    server_name example.com;
    return 301 https://$server_name$request_uri;
}
```

---

## 3. Dependency Security

```bash
# JavaScript
npm audit                    # Listar vulnerabilidades
npm audit fix                # Corrigir automaticamente
npx npm-check-updates -u     # Atualizar para latest

# Python
pip-audit                    # Scan de vulnerabilidades
safety check                 # Alternativa

# Containers
trivy image myapp:latest     # Scan de imagem Docker
```

### CI/CD Pipeline

```yaml
# .github/workflows/security.yml
name: Security Scan
on: [push, pull_request]

jobs:
  dependency-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm audit --audit-level=high  # Fail se HIGH ou CRITICAL

  container-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: docker build -t myapp:scan .
      - uses: aquasecurity/trivy-action@master
        with:
          image-ref: 'myapp:scan'
          severity: 'CRITICAL,HIGH'
          exit-code: '1'           # Fail build se encontrar

  sast-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run Semgrep (SAST)
        uses: semgrep/semgrep-action@v1
        with:
          config: auto             # Rules automáticas
```

### Dependabot config

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10
    labels: ["dependencies"]
    # Auto-merge patches
    reviewers: ["security-team"]

  - package-ecosystem: "docker"
    directory: "/"
    schedule:
      interval: "weekly"
```

---

## 4. Docker Hardening

```dockerfile
# ✅ Dockerfile seguro

# 1. Imagem mínima (não usar :latest)
FROM node:22-alpine AS builder

# 2. User não-root
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

WORKDIR /app

# 3. Copiar apenas o necessário (respeitar .dockerignore)
COPY package*.json ./
RUN npm ci --omit=dev    # Sem devDependencies

COPY . .
RUN npm run build

# 4. Multi-stage (imagem final sem build tools)
FROM node:22-alpine

RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

WORKDIR /app

COPY --from=builder --chown=appuser:appgroup /app/dist ./dist
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /app/package.json ./

# 5. Rodar como user não-root
USER appuser

# 6. Não expor mais portas que necessário
EXPOSE 3000

# 7. Health check
HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "dist/server.js"]
```

```
.dockerignore (obrigatório):
  .git
  .env
  node_modules
  tests
  .github
  *.md
  docker-compose*.yml
```

```
Checklist Docker:
☐ Imagem base com tag fixa (não :latest)
☐ User não-root (USER appuser)
☐ Multi-stage build (sem build tools na imagem final)
☐ .dockerignore (sem .env, .git, node_modules)
☐ npm ci --omit=dev (sem devDependencies)
☐ Read-only filesystem quando possível
☐ Sem secrets no Dockerfile ou layers
☐ Scan com trivy antes de deploy
☐ Limitar memória e CPU no runtime
```

---

## 5. Cloud Security Basics

```
AWS — Erros mais comuns:

S3:
├── Bucket público (S3 Block Public Access = ON)
├── Sem criptografia (SSE-S3 ou SSE-KMS)
├── IAM policy excessiva (s3:* em vez de s3:GetObject)
└── Sem logging de acesso

IAM:
├── Root account em uso (criar IAM users)
├── Access keys sem rotação (90 dias máx)
├── Policies com * em resource
├── Sem MFA no root e admins
└── Service roles com permissões excessivas

RDS:
├── Públicamente acessível (publicly_accessible = false)
├── Sem criptografia at rest
├── Credenciais hardcoded (usar Secrets Manager)
├── Sem backup automatizado
└── Security group aberto (0.0.0.0/0)

Network:
├── Security groups muito permissivos
├── SSH aberto para 0.0.0.0/0 (restringir por IP)
├── Sem VPC para recursos internos
└── Sem WAF em endpoints públicos
```

---

## 6. API Hardening

```javascript
// Rate limiting escalonado
app.use('/api/auth', rateLimit({ windowMs: 15*60*1000, max: 10 }));   // 10/15min
app.use('/api', rateLimit({ windowMs: 60*1000, max: 60 }));           // 60/min

// Body size limit
app.use(express.json({ limit: '1mb' }));   // Não aceitar body > 1MB
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

// Timeout de request
import timeout from 'connect-timeout';
app.use(timeout('30s'));

// Desabilitar features desnecessárias
app.disable('x-powered-by');
app.disable('etag');  // Se não usa cache

// Input validation em TODA rota (Zod middleware)
// Ver: api-engineer/references/validation.md

// Error handler que não vaza internals
app.use((err, req, res, next) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
  }
  // Em produção: NUNCA retornar stack trace
  logger.error('Unhandled error', { error: err.message, stack: err.stack, requestId: req.id });
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' } });
});
```

---

## 7. Hardening Express — Exemplo Completo

```javascript
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';

const app = express();

// 1. Security headers
app.use(helmet());

// 2. CORS restrito
app.use(cors({
  origin: ['https://app.example.com'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  credentials: true,
  maxAge: 86400,
}));

// 3. Body limits
app.use(express.json({ limit: '1mb' }));

// 4. Request ID
app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] || crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
});

// 5. Rate limiting
app.use('/api/', rateLimit({ windowMs: 60000, max: 60 }));
app.use('/api/auth/', rateLimit({ windowMs: 900000, max: 10 }));

// 6. Remove fingerprinting
app.disable('x-powered-by');

// 7. Rotas
app.use('/api/v1', routes);

// 8. 404 handler (não revelar rotas internas)
app.use((req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Rota não encontrada' } });
});

// 9. Error handler seguro
app.use((err, req, res, next) => {
  logger.error('Error', { error: err.message, requestId: req.id });
  const status = err.statusCode || 500;
  const message = status === 500 ? 'Erro interno do servidor' : err.message;
  res.status(status).json({ error: { code: err.code || 'INTERNAL_ERROR', message } });
});
```
