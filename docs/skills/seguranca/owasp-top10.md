# OWASP Top 10 (2021) — Detecção, Exemplos e Remediação

## Índice
1. A01 — Broken Access Control
2. A02 — Cryptographic Failures
3. A03 — Injection
4. A04 — Insecure Design
5. A05 — Security Misconfiguration
6. A06 — Vulnerable Components
7. A07 — Authentication Failures
8. A08 — Data Integrity Failures
9. A09 — Logging & Monitoring Failures
10. A10 — Server-Side Request Forgery (SSRF)
11. Quick Scan Checklist

---

## 1. A01 — Broken Access Control

A vulnerabilidade #1. Usuário acessa o que não deveria.

```
Manifestações:
├── IDOR — GET /api/orders/123 retorna order de outro user
├── Missing function-level access — user acessa /api/admin/users
├── Mass assignment — PATCH /users/me com { "role": "admin" }
├── CORS misconfigured — origin: * com credentials
├── Path traversal — /files/../../etc/passwd
└── JWT manipulation — trocar role no payload sem re-assinar

Detecção:
├── Testar cada endpoint com user de role diferente
├── Trocar IDs em requests (IDOR manual)
├── Tentar acessar endpoints de admin com token de user
├── Enviar campos extras em PATCH/PUT (mass assignment)
└── Verificar se CORS está restrito a origins conhecidas

Remediação:
├── Deny by default — negar tudo, liberar explicitamente
├── Ownership check em CADA recurso (não confiar só em auth)
├── Whitelist de campos em update (nunca aceitar body inteiro)
├── RBAC enforced no middleware, não na UI
└── Testes de authorization em cada endpoint
```

```javascript
// ❌ Vulnerável — IDOR
app.get('/api/orders/:id', auth, async (req, res) => {
  const order = await orderRepo.findById(req.params.id);
  res.json(order); // Retorna order de QUALQUER user!
});

// ✅ Corrigido — Ownership check
app.get('/api/orders/:id', auth, async (req, res) => {
  const order = await orderRepo.findById(req.params.id);
  if (!order) return res.status(404).json({ error: { code: 'NOT_FOUND' } });
  if (order.userId !== req.user.id && req.user.role !== 'admin') {
    return res.status(404).json({ error: { code: 'NOT_FOUND' } }); // 404, não 403
  }
  res.json(order);
});
```

---

## 2. A02 — Cryptographic Failures

Dados sensíveis sem proteção adequada.

```
Manifestações:
├── Password em MD5/SHA1/plain text
├── Dados sensíveis em HTTP (sem TLS)
├── PII em logs (email, CPF, cartão)
├── Secrets hardcoded no código
├── Backup de banco sem criptografia
├── Dados sensíveis em URL (query params)
└── JWT com algorithm "none" aceito

Detecção:
├── Grep por "md5", "sha1", "sha256" em password context
├── Verificar se .env está no .gitignore
├── Buscar strings que parecem secrets no código
├── Verificar se TLS é enforced (HSTS)
├── Checar se logs contêm PII
└── git log --all -p | grep -i "password\|secret\|api_key"

Remediação:
├── bcrypt(12) ou Argon2id para passwords
├── HTTPS + HSTS para tudo
├── Env vars ou Vault para secrets
├── Criptografia at rest no banco (RDS encryption)
├── Mascarar PII em logs
└── Rotate secrets periodicamente
```

---

## 3. A03 — Injection

Input do user executado como código.

```
Tipos:
├── SQL Injection — Manipular queries SQL
├── NoSQL Injection — Manipular queries MongoDB/etc.
├── Command Injection — Executar comandos no OS
├── XSS — Injetar JavaScript no browser de outros users
├── LDAP Injection — Manipular queries LDAP
└── Template Injection — Injetar em templates (SSTI)

Referência detalhada: references/injection-xss.md
```

---

## 4. A04 — Insecure Design

Falhas de design, não de implementação. Nenhum código corrige design ruim.

```
Manifestações:
├── Falta de rate limiting em reset password (enumeration)
├── Perguntas de segurança fracas ("nome da mãe")
├── Sem limite de tentativas de OTP (brute force 4 dígitos)
├── Trust no client para validação de negócio
├── Sem separação de ambientes (dev usando dados de prod)
└── Sem threat model antes de implementar

Remediação:
├── Threat modeling ANTES de codar (STRIDE)
├── Rate limiting em todo fluxo de auth
├── Validação no server (NUNCA confiar no client)
├── OTP de 6+ dígitos com lockout após 5 tentativas
├── Ambientes isolados (dev, staging, prod)
└── Abuse stories além de user stories
    "COMO atacante, QUERO brute force OTP, PARA acessar contas"
```

---

## 5. A05 — Security Misconfiguration

Default configs, features desnecessárias habilitadas, erros verbose.

```
Manifestações:
├── Stack trace nos erros de API (em produção!)
├── Directory listing habilitado
├── Credenciais default (admin/admin)
├── CORS: origin: '*' com credentials
├── Swagger/debug endpoints abertos em produção
├── Headers de segurança ausentes
├── Features desnecessárias (TRACE method, unused ports)
└── Permissões excessivas em cloud resources (S3 público)

Detecção:
├── Provocar erro 500 e verificar response body
├── Acessar /swagger, /docs, /graphql em produção
├── curl -I para verificar headers de segurança
├── Testar CORS com origin maliciosa
└── Verificar S3 buckets, cloud configs

Remediação:
├── Error handler genérico em produção
├── Desabilitar endpoints de debug em produção
├── Security headers (ver references/hardening.md)
├── CORS com whitelist de origins
├── Revisar cloud permissions (AWS IAM, S3 policies)
└── Automated scan de configuração (trivy, checkov)
```

---

## 6. A06 — Vulnerable and Outdated Components

Dependências com CVEs conhecidos.

```
Detecção:
├── npm audit / yarn audit
├── pip-audit / safety check
├── Snyk test
├── Dependabot alerts (GitHub)
├── trivy image scan (containers)
└── OWASP Dependency-Check

Remediação:
├── Automatizar scan no CI (fail build se CRITICAL/HIGH)
├── Dependabot ou Renovate para auto-update
├── Revisar licenses (supply chain risk)
├── Lock files (package-lock.json, poetry.lock)
├── Monitorar advisories dos frameworks usados
└── Plano de update: mensal para minor, imediato para security
```

---

## 7. A07 — Identification and Authentication Failures

```
Manifestações:
├── Sem rate limiting no login (brute force)
├── Passwords fracas permitidas ("123456")
├── Token sem expiração (backdoor permanente)
├── Session fixation (reusar session ID pré-login)
├── Sem MFA para operações sensíveis
├── Credential stuffing (sem detecção de login de IP diferente)
└── Reset password sem rate limit / sem expiração do token

Referência detalhada: references/auth-session.md
```

---

## 8. A08 — Software and Data Integrity Failures

```
Manifestações:
├── Pipeline de CI/CD sem verificação de integridade
├── Auto-update de dependências sem verificação de hash
├── Deserialization insegura (Java, Python pickle)
├── Webhook sem validação de assinatura
└── CDN serve script modificado (sem SRI)

Remediação:
├── Subresource Integrity (SRI) para scripts de CDN
├── Signed commits e tags
├── Webhook signature validation (HMAC)
├── Evitar deserialization de dados não confiáveis
├── CI/CD com permissões mínimas e audit trail
└── npm ci (não npm install) em CI
```

---

## 9. A09 — Security Logging and Monitoring Failures

```
Manifestações:
├── Login failures não logados
├── Permission denied não logados
├── Sem alertas para brute force
├── Logs sem contexto (sem requestId, userId)
├── Logs armazenados apenas localmente (perdem no crash)
├── PII nos logs (violação de privacidade)
└── Sem audit trail de ações de admin

Referência detalhada: references/incident-response.md
```

---

## 10. A10 — Server-Side Request Forgery (SSRF)

```
Manifestações:
├── API aceita URL do user e faz request (preview, fetch, webhook)
├── Pode acessar rede interna via URL (http://169.254.169.254 = AWS metadata)
├── Pode acessar serviços internos (http://localhost:6379 = Redis)
└── Pode scan de portas internas

Remediação:
├── Whitelist de domínios/IPs permitidos
├── Bloquear IPs privados (10.x, 172.16.x, 192.168.x, 169.254.x)
├── Bloquear schemes perigosos (file://, gopher://)
├── Resolver DNS e validar IP antes de fazer request
├── Usar rede isolada para serviços que fazem fetch
└── Desabilitar redirects automáticos (ou validar após redirect)
```

```javascript
// ❌ Vulnerável — SSRF via URL de callback
app.post('/api/webhooks/test', async (req, res) => {
  const { url } = req.body;
  const response = await fetch(url); // Atacante envia url=http://169.254.169.254/latest/meta-data/
  res.json(await response.text());
});

// ✅ Corrigido
import { URL } from 'url';
import dns from 'dns/promises';
import ipaddr from 'ipaddr.js';

const BLOCKED_RANGES = ['private', 'loopback', 'linkLocal', 'uniqueLocal'];

async function validateUrl(urlString) {
  const parsed = new URL(urlString);
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Protocol not allowed');

  const addresses = await dns.resolve4(parsed.hostname);
  for (const addr of addresses) {
    const range = ipaddr.process(addr).range();
    if (BLOCKED_RANGES.includes(range)) throw new Error('Internal IP not allowed');
  }
  return urlString;
}
```

---

## 11. Quick Scan Checklist

```
Varredura rápida em 15 minutos:

Auth:
☐ Login tem rate limiting?
☐ Passwords exigem 8+ chars com complexidade?
☐ JWT tem expiração curta (≤15min)?
☐ Refresh token implementado?
☐ Reset password token expira?

Access Control:
☐ Cada endpoint verifica auth?
☐ IDOR protegido (ownership check)?
☐ Admin endpoints bloqueados para users?
☐ CORS restrito a origins conhecidas?

Injection:
☐ Todas queries são parameterized?
☐ Input validado com schema (Zod/Joi)?
☐ Output escapado (XSS)?
☐ URLs do user validadas (SSRF)?

Data:
☐ Passwords com bcrypt/Argon2?
☐ HTTPS enforced (HSTS)?
☐ Secrets em env vars (não no código)?
☐ PII mascarada em logs?
☐ Erros não expõem stack trace?

Infra:
☐ Headers de segurança presentes?
☐ Dependencies sem CVEs critical?
☐ Docker não roda como root?
☐ Portas de debug fechadas em produção?
```
