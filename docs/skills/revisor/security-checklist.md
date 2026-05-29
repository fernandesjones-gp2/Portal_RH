# Security Checklist — OWASP Top 10 e Além

## Índice
1. OWASP Top 10 — Checklist Prático
2. Injection (A03)
3. Broken Authentication (A07)
4. Sensitive Data Exposure (A02)
5. XSS — Cross-Site Scripting (A03)
6. CSRF — Cross-Site Request Forgery
7. Insecure Dependencies
8. Secrets & Configuration
9. File Upload
10. Rate Limiting & DoS

---

## 1. OWASP Top 10 — Checklist Prático

Para cada PR, varrer estes itens:

```
□ Inputs do usuário sanitizados / validados?
□ Queries usam parameterized statements (não string concat)?
□ Autenticação verificada em TODOS os endpoints protegidos?
□ Autorização verificada (user só acessa o que é dele)?
□ Dados sensíveis criptografados (senhas com bcrypt, dados com AES)?
□ Secrets fora do código (env vars, vault)?
□ Headers de segurança presentes (CSRF token, Content-Security-Policy)?
□ Dependências sem vulnerabilidades conhecidas?
□ Logs não contêm PII, tokens ou senhas?
□ Error messages não expõem stack traces ou info interna?
□ File uploads validados (tipo, tamanho, extensão)?
□ Rate limiting em endpoints sensíveis (login, register, reset)?
```

---

## 2. Injection (A03)

### SQL Injection

```javascript
// 🔴 CRITICAL — String concatenation em query
const query = `SELECT * FROM users WHERE email = '${email}' AND password = '${password}'`;
// Input: email = "' OR 1=1 --"  →  Retorna TODOS os usuários

// ✅ FIX — Parameterized query
const query = 'SELECT * FROM users WHERE email = $1 AND password = $2';
const result = await db.query(query, [email, password]);

// ✅ FIX — ORM (Prisma, Sequelize, etc.)
const user = await prisma.user.findUnique({ where: { email } });
```

```python
# 🔴 CRITICAL — f-string em query
cursor.execute(f"SELECT * FROM users WHERE email = '{email}'")

# ✅ FIX — Parameterized
cursor.execute("SELECT * FROM users WHERE email = %s", (email,))

# ✅ FIX — ORM (SQLAlchemy)
user = session.query(User).filter(User.email == email).first()
```

### NoSQL Injection (MongoDB)

```javascript
// 🔴 CRITICAL — Input direto no filtro
const user = await User.findOne({ email: req.body.email, password: req.body.password });
// Input: { "email": {"$gt": ""}, "password": {"$gt": ""} } → Retorna primeiro user

// ✅ FIX — Validar tipo do input
if (typeof req.body.email !== 'string' || typeof req.body.password !== 'string') {
  return res.status(400).json({ error: 'Invalid input' });
}
```

### Command Injection

```javascript
// 🔴 CRITICAL — Input do usuário em shell command
const exec = require('child_process').exec;
exec(`convert ${userFilename} output.png`);
// Input: "image.png; rm -rf /"

// ✅ FIX — Usar execFile (não interpreta shell) + validar input
const { execFile } = require('child_process');
const sanitized = path.basename(userFilename); // Remove path traversal
execFile('convert', [sanitized, 'output.png']);
```

### Path Traversal

```javascript
// 🔴 HIGH — Input do usuário em path de arquivo
const filePath = `/uploads/${req.params.filename}`;
res.sendFile(filePath);
// Input: "../../etc/passwd"

// ✅ FIX — Resolver e validar path
const safePath = path.resolve('/uploads', req.params.filename);
if (!safePath.startsWith('/uploads/')) {
  return res.status(403).json({ error: 'Forbidden' });
}
res.sendFile(safePath);
```

---

## 3. Broken Authentication (A07)

### Senhas

```javascript
// 🔴 CRITICAL — Senha em texto plano
await db.query('INSERT INTO users (email, password) VALUES ($1, $2)', [email, password]);

// 🔴 HIGH — Hash fraco (MD5, SHA1)
const hash = crypto.createHash('md5').update(password).digest('hex');

// ✅ FIX — bcrypt com cost adequado
const bcrypt = require('bcrypt');
const hash = await bcrypt.hash(password, 12); // cost 12 = ~250ms
await db.query('INSERT INTO users (email, password_hash) VALUES ($1, $2)', [email, hash]);

// ✅ Login: comparar com timing-safe
const valid = await bcrypt.compare(inputPassword, user.password_hash);
```

### JWT

```javascript
// 🔴 HIGH — JWT sem expiração
const token = jwt.sign({ userId: user.id }, SECRET);

// 🔴 HIGH — Secret fraco
const token = jwt.sign(payload, 'secret123');

// 🔴 CRITICAL — Não verificar algoritmo (alg:none attack)
const decoded = jwt.decode(token); // decode ≠ verify!

// ✅ FIX — Expiração + secret forte + verify com algoritmo explícito
const token = jwt.sign(
  { userId: user.id, role: user.role },
  process.env.JWT_SECRET, // 64+ chars random
  { expiresIn: '15m', algorithm: 'HS256' }
);
const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
```

### Autorização (IDOR — Insecure Direct Object Reference)

```javascript
// 🔴 HIGH — Qualquer user pode acessar qualquer pedido
app.get('/api/orders/:id', async (req, res) => {
  const order = await Order.findById(req.params.id); // Sem verificar ownership
  res.json(order);
});

// ✅ FIX — Verificar que o recurso pertence ao user autenticado
app.get('/api/orders/:id', auth, async (req, res) => {
  const order = await Order.findOne({
    where: { id: req.params.id, userId: req.user.id } // Filtro por owner
  });
  if (!order) return res.status(404).json({ error: 'Not found' });
  res.json(order);
});
```

---

## 4. Sensitive Data Exposure (A02)

```javascript
// 🔴 HIGH — Retornar senha/hash na resposta da API
app.get('/api/users/:id', async (req, res) => {
  const user = await User.findById(req.params.id);
  res.json(user); // Inclui password_hash, tokens, etc.
});

// ✅ FIX — Selecionar apenas campos necessários
const user = await User.findById(req.params.id)
  .select('id name email avatar createdAt'); // Whitelist explícita

// 🔴 MEDIUM — Logar dados sensíveis
console.log('Login attempt:', { email, password }); // password no log!
logger.info('Payment processed:', { cardNumber, amount });

// ✅ FIX — Nunca logar PII/secrets
logger.info('Login attempt:', { email }); // Sem password
logger.info('Payment processed:', { amount, last4: card.last4 }); // Mascarar
```

---

## 5. XSS — Cross-Site Scripting (A03)

```javascript
// 🔴 HIGH — Renderizar HTML do usuário sem sanitizar
element.innerHTML = userInput;
// React: dangerouslySetInnerHTML={{ __html: userInput }}

// ✅ FIX — Usar textContent (não interpreta HTML)
element.textContent = userInput;

// ✅ FIX — Sanitizar se HTML é necessário
const DOMPurify = require('dompurify');
element.innerHTML = DOMPurify.sanitize(userInput);

// 🔴 MEDIUM — Reflected XSS em URL params
// URL: /search?q=<script>alert('xss')</script>
app.get('/search', (req, res) => {
  res.send(`Results for: ${req.query.q}`); // XSS!
});

// ✅ FIX — Escape HTML entities
const escapeHtml = (str) => str
  .replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
res.send(`Results for: ${escapeHtml(req.query.q)}`);
```

---

## 6. CSRF — Cross-Site Request Forgery

```javascript
// 🔴 MEDIUM — Endpoint que muda estado aceita qualquer request
app.post('/api/transfer', auth, async (req, res) => {
  // Site malicioso pode submeter form para cá com o cookie do user
  await transferMoney(req.user.id, req.body.to, req.body.amount);
});

// ✅ FIX — CSRF token
const csrf = require('csurf');
app.use(csrf({ cookie: true }));
// Token enviado no form e validado automaticamente

// ✅ FIX — SameSite cookie
res.cookie('session', token, {
  httpOnly: true,
  secure: true,
  sameSite: 'strict', // Previne CSRF
  maxAge: 3600000
});
```

---

## 7. Insecure Dependencies

```bash
# Verificar vulnerabilidades em deps
npm audit                    # Node.js
pip-audit                    # Python
cargo audit                  # Rust
bundle audit                 # Ruby

# No CI/CD:
# GitHub: Dependabot alerts (automático)
# Snyk: snyk test
# Trivy: para Docker images
```

Findings comuns:
- Dependência com CVE conhecida → atualizar
- Dependência sem manutenção há 2+ anos → avaliar alternativa
- Dependência com permissões excessivas → avaliar se realmente precisa

---

## 8. Secrets & Configuration

```javascript
// 🔴 CRITICAL — Secrets hardcoded
const API_KEY = 'sk-1234567890abcdef';
const DB_PASSWORD = 'super_secret';
const JWT_SECRET = 'my-jwt-secret';

// ✅ FIX — Environment variables
const API_KEY = process.env.API_KEY;
const DB_PASSWORD = process.env.DB_PASSWORD;

// 🔴 HIGH — .env commitado no git
// Verificar: git log --all --full-history -- .env

// ✅ FIX — .gitignore
// .env
// .env.*
// !.env.example
```

---

## 9. File Upload

```javascript
// 🔴 HIGH — Aceitar qualquer arquivo
app.post('/upload', upload.single('file'), (req, res) => {
  // Sem validação de tipo, tamanho, ou nome
});

// ✅ FIX — Validação completa
const upload = multer({
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error('Tipo de arquivo não permitido'));
    }
    cb(null, true);
  },
  storage: multer.diskStorage({
    filename: (req, file, cb) => {
      // Nome aleatório (não usar nome original — path traversal)
      const name = crypto.randomUUID() + path.extname(file.originalname);
      cb(null, name);
    }
  })
});
```

---

## 10. Rate Limiting & DoS

```javascript
// 🔴 MEDIUM — Endpoint de login sem rate limiting
app.post('/api/auth/login', async (req, res) => { ... });
// Atacante pode fazer 1M tentativas de senha por minuto

// ✅ FIX — Rate limiter
const rateLimit = require('express-rate-limit');
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // 5 tentativas por IP
  message: { error: 'Muitas tentativas. Tente novamente em 15 minutos.' }
});
app.post('/api/auth/login', loginLimiter, async (req, res) => { ... });
```
