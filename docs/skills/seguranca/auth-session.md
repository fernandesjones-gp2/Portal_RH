# Auth & Sessions — Passwords, JWT, Sessions, MFA, Brute Force

## Índice
1. Password Security
2. JWT Security
3. Session Security
4. Brute Force & Credential Stuffing
5. MFA — Multi-Factor Authentication
6. Password Reset Seguro
7. OAuth2 Security Pitfalls

---

## 1. Password Security

### Hashing correto

```javascript
// ✅ bcrypt com cost 12 (recomendado)
import bcrypt from 'bcrypt';
const SALT_ROUNDS = 12; // 2^12 iterações ≈ 250ms por hash

async function hashPassword(plain) {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

// ✅ Argon2id (state-of-the-art, mais seguro)
import argon2 from 'argon2';

async function hashPassword(plain) {
  return argon2.hash(plain, {
    type: argon2.argon2id,
    memoryCost: 65536,     // 64MB
    timeCost: 3,           // 3 iterações
    parallelism: 4,
  });
}
```

```
NUNCA usar:
├── MD5         — Quebrado. Rainbow tables. Sem salt.
├── SHA-1       — Quebrado. Colisões encontradas.
├── SHA-256     — Rápido demais. Sem salt built-in. 10 bilhões/s em GPU.
├── Plain text  — Criminoso (literalmente, sob LGPD).
└── Criptografia reversível (AES) — Se a key vazar, todas as senhas vazam.

USAR:
├── bcrypt(12)  — Padrão da indústria. Lento por design. Salt automático.
├── Argon2id    — Vencedor do Password Hashing Competition. Memory-hard.
└── scrypt      — Alternativa memory-hard. Menos adotado.
```

### Política de senha

```javascript
// Validação mínima — NÃO ser o "teatro de segurança"
const passwordSchema = z.string()
  .min(8, 'Mínimo 8 caracteres')
  .max(128, 'Máximo 128 caracteres') // Prevenir DoS via bcrypt de string enorme
  .refine(
    (pw) => !COMMON_PASSWORDS.includes(pw.toLowerCase()),
    'Senha muito comum'
  );

// Checklist de haveibeenpwned (verificar se senha já vazou)
// API: https://api.pwnedpasswords.com/range/{first5hashchars}
// Enviar apenas os 5 primeiros chars do SHA-1 (k-anonymity)
```

```
Política MODERNA (NIST SP 800-63B):
├── Mínimo 8 caracteres (12+ recomendado)
├── Máximo 128 caracteres (prevenir DoS)
├── Verificar contra lista de senhas comuns (10K+)
├── Verificar contra haveibeenpwned
├── NÃO exigir: maiúscula + número + especial obrigatório
│   (cria senhas como "Password1!" — previsíveis)
├── NÃO exigir: troca periódica (gera "Senha01", "Senha02")
├── Permitir paste no campo de senha (para password managers)
└── Medir entropia, não complexidade arbitrária
```

---

## 2. JWT Security

### Vulnerabilidades comuns

```
1. Algorithm confusion (alg: "none")
   Atacante muda o header para { "alg": "none" } e remove a assinatura.
   Se o server aceita "none", qualquer payload é válido.
   FIX: Especificar algorithms: ['HS256'] no verify()

2. Secret fraco
   Secret "mysecret" → brute force em minutos.
   FIX: Mínimo 256 bits (64 chars) de random. Gerar com crypto.randomBytes(64).

3. Informação sensível no payload
   JWT é Base64, NÃO criptografado. Qualquer um pode ler o payload.
   FIX: Apenas sub (userId) e role. Nunca email, CPF, dados pessoais.

4. Token sem expiração
   Token válido para sempre = backdoor permanente se roubado.
   FIX: Access token: 15min. Refresh token: 7 dias.

5. Token no localStorage
   XSS pode roubar o token: document.cookie / localStorage.getItem('token')
   FIX: httpOnly cookie (se possível) ou aceitar o trade-off com XSS protection.

6. Sem revogação
   JWT é stateless — como invalidar um token antes de expirar?
   FIX: Blacklist em Redis para tokens revogados, ou token version no user.
```

```javascript
// ✅ Verificação segura de JWT
import jwt from 'jsonwebtoken';

function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET, {
    algorithms: ['HS256'],    // OBRIGATÓRIO — bloqueia "none" e RS256 confusion
    maxAge: '15m',            // Rejeitar tokens mais velhos que 15min
    issuer: 'myapp',          // Validar issuer
  });
}

// ✅ Geração segura
function signToken(payload) {
  return jwt.sign(
    { sub: payload.userId, role: payload.role }, // Mínimo no payload
    process.env.JWT_SECRET,
    {
      algorithm: 'HS256',
      expiresIn: '15m',
      issuer: 'myapp',
    }
  );
}
```

---

## 3. Session Security

```javascript
// Cookie-based sessions — configuração segura
app.use(session({
  secret: process.env.SESSION_SECRET, // 64+ chars random
  name: '__Host-sid',                  // Prefixo __Host- = seguro
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,         // JavaScript não acessa
    secure: true,           // Apenas HTTPS
    sameSite: 'lax',        // Proteção CSRF
    maxAge: 24 * 60 * 60 * 1000, // 24h
    path: '/',
    domain: undefined,      // Apenas o domínio atual
  },
  store: new RedisStore({ client: redis }), // Não armazenar em memória!
}));

// Regenerar session ID após login (previne session fixation)
app.post('/login', async (req, res) => {
  const user = await authenticate(req.body);
  req.session.regenerate((err) => {
    req.session.userId = user.id;
    req.session.save(() => res.json({ success: true }));
  });
});

// Destruir session no logout
app.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('__Host-sid');
    res.json({ success: true });
  });
});
```

---

## 4. Brute Force & Credential Stuffing

```javascript
// Rate limiting no login — OBRIGATÓRIO

// Layer 1: Por IP (catch bots)
const loginIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 10,                   // 10 tentativas por IP
  keyGenerator: (req) => req.ip,
});

// Layer 2: Por account (catch distributed attacks)
const loginAccountLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 5,                    // 5 tentativas por email
  keyGenerator: (req) => req.body.email?.toLowerCase(),
  skipSuccessfulRequests: true, // Não contar sucessos
});

app.post('/auth/login', loginIpLimiter, loginAccountLimiter, loginHandler);

// Layer 3: Progressive delay (exponential backoff)
async function loginHandler(req, res) {
  const { email, password } = req.body;
  const attempts = await redis.incr(`login:attempts:${email}`);
  await redis.expire(`login:attempts:${email}`, 3600);

  if (attempts > 5) {
    const delay = Math.min(Math.pow(2, attempts - 5) * 1000, 30000);
    await new Promise(r => setTimeout(r, delay));
  }

  const user = await userService.authenticate(email, password);
  if (!user) {
    // Resposta IDÊNTICA para "user não existe" e "senha errada"
    return res.status(401).json({
      error: { code: 'INVALID_CREDENTIALS', message: 'Email ou senha inválidos' }
    });
  }

  await redis.del(`login:attempts:${email}`);
  // ... gerar token
}
```

```
Anti-enumeration: NUNCA revelar se o email existe.

❌ "Email não encontrado" vs "Senha incorreta" → atacante sabe quais emails existem
✅ "Email ou senha inválidos" → sempre a mesma mensagem

❌ Register retorna "Email já cadastrado" → enumeration
✅ Register retorna "Se esse email não estiver em uso, enviamos um link de confirmação"
   (mesmo que já esteja cadastrado, enviar email diferente)
```

---

## 5. MFA — Multi-Factor Authentication

```javascript
// TOTP (Time-based One-Time Password) — Google Authenticator, Authy

import speakeasy from 'speakeasy';
import QRCode from 'qrcode';

// Setup: gerar secret e QR code
async function enableMFA(userId) {
  const secret = speakeasy.generateSecret({
    name: `MyApp (${user.email})`,
    issuer: 'MyApp',
  });

  // Salvar secret (criptografado!) no banco
  await userService.saveMFASecret(userId, encrypt(secret.base32));

  // Gerar QR code para o user scanear
  const qrDataUrl = await QRCode.toDataURL(secret.otpauth_url);
  return { qrCode: qrDataUrl, manualCode: secret.base32 };
}

// Verificação no login
function verifyMFA(secret, token) {
  return speakeasy.totp.verify({
    secret: decrypt(secret),
    encoding: 'base32',
    token,
    window: 1, // Aceitar 1 intervalo antes/depois (30s tolerância)
  });
}

// Fluxo de login com MFA
app.post('/auth/login', async (req, res) => {
  const user = await authenticate(req.body.email, req.body.password);
  if (!user) return res.status(401).json({ error: { code: 'INVALID_CREDENTIALS' } });

  if (user.mfaEnabled) {
    // Retornar token temporário (não é access token!)
    const mfaToken = signToken({ sub: user.id, type: 'mfa_pending' }, '5m');
    return res.json({ data: { requiresMFA: true, mfaToken } });
  }

  // Sem MFA — login direto
  const tokens = generateTokens(user);
  res.json({ data: tokens });
});

app.post('/auth/mfa/verify', async (req, res) => {
  const { mfaToken, code } = req.body;
  const decoded = verifyToken(mfaToken);
  if (decoded.type !== 'mfa_pending') return res.status(401).json({ error: 'Invalid token' });

  const user = await userService.findById(decoded.sub);
  if (!verifyMFA(user.mfaSecret, code)) {
    return res.status(401).json({ error: { code: 'INVALID_MFA', message: 'Código inválido' } });
  }

  const tokens = generateTokens(user);
  res.json({ data: tokens });
});
```

---

## 6. Password Reset Seguro

```
Fluxo seguro:
1. User submete email
2. Server SEMPRE retorna "Se o email existir, enviamos um link" (anti-enumeration)
3. Gerar token random (crypto.randomBytes(32)) com expiração (1 hora)
4. Salvar HASH do token no banco (não o token em si)
5. Enviar link com token por email
6. User clica no link → verificar hash do token + expiração
7. User define nova senha → invalidar o token
8. Invalidar TODAS as sessões/tokens do user (forçar re-login)

Erros comuns:
├── Token previsível (UUID v4 é OK, mas crypto.randomBytes é melhor)
├── Token sem expiração (backdoor permanente via email)
├── Token reutilizável (usar uma vez e invalidar)
├── Revelar se email existe ("Email não encontrado")
├── Não invalidar sessões após reset (atacante que roubou sessão mantém acesso)
└── Token no query param de URL (fica no log do server, browser history, referer)
```

---

## 7. OAuth2 Security Pitfalls

```
Erros comuns na implementação de OAuth:

1. Sem state parameter → CSRF
   Atacante pode injetar seu próprio authorization code.
   FIX: Gerar state random, salvar na session, validar no callback.

2. Redirect URI aberta → Token theft
   Se o redirect_uri aceita qualquer URL, atacante redireciona token para seu server.
   FIX: Whitelist exata de redirect URIs no provider.

3. Token no fragment da URL → Leak via Referer
   Tokens no hash (#access_token=...) podem vazar via Referer header.
   FIX: Usar Authorization Code flow (code no query, trocar no backend).

4. Sem PKCE → Code interception (mobile/SPA)
   Em apps nativos, outro app pode interceptar o callback URL.
   FIX: PKCE (Proof Key for Code Exchange) obrigatório para SPAs e mobile.

5. Scope excessivo
   Pedir mais permissões que necessário.
   FIX: Pedir MÍNIMO necessário. Não pedir "admin" se precisa de "read:email".
```
