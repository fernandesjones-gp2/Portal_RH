# Stack Traces — Ler e Interpretar Erros

## Índice
1. Anatomia de um Stack Trace
2. JavaScript / TypeScript — Erros Comuns
3. Python — Erros Comuns
4. Erros HTTP — O Que Cada Status Code Realmente Significa
5. Erros de Frontend (Browser)
6. Erros de Banco de Dados
7. Pattern Matching — Erro → Causa Provável

---

## 1. Anatomia de um Stack Trace

```
Um stack trace é lido DE BAIXO PARA CIMA (cronológico)
e DE CIMA PARA BAIXO (para encontrar o culpado).

Regra prática:
  Ler a PRIMEIRA LINHA (o erro em si)
  Depois procurar a PRIMEIRA LINHA QUE É SEU CÓDIGO
  (ignorar linhas de node_modules, framework, stdlib)
```

### JavaScript / Node.js

```
TypeError: Cannot read properties of undefined (reading 'email')
    at UserService.create (/app/src/services/user-service.ts:42:28)    ← SEU CÓDIGO (aqui!)
    at OrderController.handle (/app/src/controllers/order.ts:18:35)    ← SEU CÓDIGO (quem chamou)
    at Layer.handle [as handle_request] (node_modules/express/lib/router/layer.js:95:5)
    at next (node_modules/express/lib/router/route.js:144:13)
    at Route.dispatch (node_modules/express/lib/router/route.js:114:3)

Leitura:
  ERRO: TypeError — tentou acessar .email de algo que é undefined
  ONDE: user-service.ts, linha 42, coluna 28
  CHAMADO POR: order.ts, linha 18
  O RESTO: framework Express — ignorar para o diagnóstico

Causa provável: Na linha 42 do user-service.ts, algo como
  const email = user.email;  // mas 'user' é undefined

Investigar: De onde vem 'user'? Quem chama UserService.create()?
  Provavelmente recebeu undefined como parâmetro.
```

### Python

```python
# Python stack trace é lido DE CIMA PARA BAIXO
# (inverso do JS — a causa está na ÚLTIMA linha)

Traceback (most recent call last):
  File "/app/main.py", line 15, in handle_request       ← chamador
  File "/app/services/order.py", line 42, in create      ← SEU CÓDIGO
  File "/app/services/user.py", line 28, in get_email    ← onde falha
AttributeError: 'NoneType' object has no attribute 'email'

Leitura:
  CAUSA: user.py linha 28 — tentou acessar .email de None
  CHAMADO POR: order.py linha 42
  TRIGGER: main.py linha 15
```

---

## 2. JavaScript / TypeScript — Erros Comuns

### TypeError: Cannot read properties of undefined/null

```javascript
// O erro MAIS COMUM de JavaScript. 99% das vezes:
// Algo que deveria ser um objeto é undefined ou null.

// Cenário 1: Acesso a propriedade aninhada
const city = user.address.city;
// Se user.address é undefined → BOOM

// Fix: Optional chaining
const city = user?.address?.city;
// Ou: Validar antes
if (!user?.address) throw new NotFoundError('Endereço não encontrado');

// Cenário 2: Retorno de função não tratado
const user = await userRepo.findById(id);
const email = user.email; // user é null se não encontrou!

// Fix: Checar null
const user = await userRepo.findById(id);
if (!user) throw new NotFoundError('Usuário não encontrado');

// Cenário 3: Array vazio
const first = items[0].name; // Se items é [] → items[0] é undefined

// Fix:
const first = items[0]?.name ?? 'default';
// Ou validar: if (!items.length) throw ...
```

### ReferenceError: X is not defined

```javascript
// Variável não existe no escopo.

// Causa comum 1: Typo
consol.log('hello'); // → ReferenceError: consol is not defined

// Causa comum 2: Import faltando
const result = parseJSON(data); // Esqueceu de importar parseJSON

// Causa comum 3: Escopo
function outer() {
  if (true) { const x = 1; }
  console.log(x); // ReferenceError — x só existe dentro do if (let/const)
}
```

### SyntaxError: Unexpected token

```javascript
// JSON malformado (causa #1 em APIs):
JSON.parse("{'name': 'test'}");  // SyntaxError — JSON usa "aspas duplas"
JSON.parse('undefined');          // SyntaxError — "undefined" não é JSON válido
JSON.parse('');                   // SyntaxError — string vazia não é JSON

// Fix: Validar antes de parsear
function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null; // Ou throw com mensagem clara
  }
}
```

### UnhandledPromiseRejection

```javascript
// Promise rejeitada sem .catch() ou try/catch

// ❌ Sem tratamento
app.get('/users', async (req, res) => {
  const users = await userService.getAll(); // Se lançar erro → UnhandledRejection
  res.json(users);
});

// ✅ Com tratamento
app.get('/users', async (req, res, next) => {
  try {
    const users = await userService.getAll();
    res.json(users);
  } catch (error) {
    next(error); // Passa para error handler do Express
  }
});

// ✅ Ou usar wrapper (express-async-errors ou similar)
import 'express-async-errors'; // Adiciona try/catch automaticamente
```

---

## 3. Python — Erros Comuns

### AttributeError: 'NoneType' object has no attribute X

```python
# Equivalente do TypeError do JS. Algo é None.
user = User.query.filter_by(email=email).first()  # Retorna None se não acha
name = user.name  # AttributeError!

# Fix:
user = User.query.filter_by(email=email).first()
if not user:
    raise NotFoundError("Usuário não encontrado")
```

### KeyError

```python
# Acessou chave que não existe no dicionário
data = {"name": "Test"}
email = data["email"]  # KeyError: 'email'

# Fix:
email = data.get("email")          # Retorna None
email = data.get("email", "")      # Retorna default
```

### ImportError / ModuleNotFoundError

```python
# Módulo não instalado ou caminho errado
# ModuleNotFoundError: No module named 'pandas'
# → pip install pandas

# ImportError: cannot import name 'X' from 'Y'
# → X não existe em Y. Verificar nome exato, versão do pacote.
# → Circular import: A importa B, B importa A.
```

---

## 4. Erros HTTP — O Que Cada Status Code Realmente Significa

```
400 Bad Request
  O que parece: "Requisição inválida"
  Causa real: Body mal formatado, campo faltando, tipo errado,
              JSON inválido, query param inválido
  Investigar: Body do request, validação de schema, content-type header

401 Unauthorized
  O que parece: "Não autorizado"
  Causa real: Token ausente, expirado, inválido, ou malformado
  Investigar: Header Authorization, expiração do JWT, secret do JWT

403 Forbidden
  O que parece: "Proibido"
  Causa real: Autenticado mas SEM PERMISSÃO para este recurso/ação
  Investigar: Role do user, permissions, RBAC middleware

404 Not Found
  O que parece: "Não encontrado"
  Causa real: URL errada, recurso deletado, ID inexistente,
              OR: ownership check bloqueou (retorna 404 para esconder que existe)
  Investigar: URL exata, rota registrada, dado no banco

409 Conflict
  O que parece: "Conflito"
  Causa real: Unique constraint violada, estado inconsistente, versão desatualizada
  Investigar: Constraints do banco, dado duplicado, concorrência

422 Unprocessable Entity
  O que parece: "Entidade não processável"
  Causa real: Dados válidos sintaticamente mas inválidos semanticamente
              (ex: estoque insuficiente, saldo negativo, regra de negócio)
  Investigar: Regras de negócio no service layer

429 Too Many Requests
  O que parece: "Muitas requisições"
  Causa real: Rate limiting ativado
  Investigar: Retry-After header, qual rate limit (IP, user, endpoint)

500 Internal Server Error
  O que parece: "Erro interno"
  Causa real: Exception não tratada no backend (o log TEM a resposta)
  Investigar: Logs do servidor no timestamp do erro, stack trace

502 Bad Gateway
  O que parece: "Gateway ruim"
  Causa real: Nginx/proxy não conseguiu conectar ao app (app caiu, não iniciou)
  Investigar: App está rodando? Porta correta? Health check? OOM killed?

503 Service Unavailable
  O que parece: "Serviço indisponível"
  Causa real: App overloaded ou em manutenção
  Investigar: CPU, memória, connection pool, deployment em andamento

504 Gateway Timeout
  O que parece: "Timeout do gateway"
  Causa real: App demorou mais que o timeout do proxy (Nginx: 60s default)
  Investigar: Query lenta, API externa lenta, deadlock, loop infinito
```

---

## 5. Erros de Frontend (Browser)

### CORS Error

```
Access to fetch at 'https://api.example.com' from origin 'http://localhost:3000'
has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header...

Causa: Backend não inclui headers CORS para a origin do frontend.

NÃO É bug do frontend. É configuração do BACKEND.

Checklist:
├── Backend tem middleware CORS? (helmet, cors package)
├── Origin correta? (http://localhost:3000, não http://localhost:3001)
├── Protocolo correto? (http vs https)
├── Credentials: true se envia cookies? (origin não pode ser *)
├── Preflight (OPTIONS) está respondendo corretamente?
└── Proxy reverso está passando os headers?
```

### Hydration Mismatch (React/Next.js)

```
Warning: Text content did not match. Server: "2025-03-02" Client: "02/03/2025"

Causa: Server renderizou algo diferente do client.

Causas comuns:
├── Date/time: server em UTC, client no timezone do user
├── window/document acessado no server (não existe em SSR)
├── Math.random() ou Date.now() gera valor diferente em cada render
├── Extensão do browser modificou o DOM
└── Conteúdo baseado em localStorage (não existe no server)

Fix: useEffect para lógica client-only, ou suprimir hydration warning
com suppressHydrationWarning para conteúdo dinâmico esperado.
```

### White Screen (Tela Branca)

```
Tela branca = JavaScript error ANTES do render.

Diagnóstico:
1. Abrir DevTools → Console (o erro está lá)
2. Erros comuns:
   ├── import de módulo que não existe
   ├── env var undefined (NEXT_PUBLIC_ prefix faltando)
   ├── JSON.parse de undefined
   ├── Chamada de hook fora de componente
   └── Render de undefined como componente
3. Se não tem erro no console: bundle não carregou (Network tab)
   ├── 404 no JS bundle (path errado, CDN)
   ├── CSP bloqueando script
   └── Build falhou silenciosamente
```

---

## 6. Erros de Banco de Dados

```
duplicate key value violates unique constraint "users_email_key"
  Causa: Tentou inserir email que já existe.
  Fix: Verificar antes ou usar ON CONFLICT / upsert.

relation "users" does not exist
  Causa: Tabela não existe. Migration não rodou.
  Fix: Rodar migrations. Verificar nome da tabela (case sensitive em PG).

column "created_at" of relation "orders" does not exist
  Causa: Migration adicionando coluna não rodou, ou nome diferente.
  Fix: Verificar migrations pendentes, comparar schema.

deadlock detected
  Causa: Duas transações esperando uma pela outra.
  Fix: Ver references/race-conditions.md

remaining connection slots are reserved for non-replication superuser connections
  Causa: Pool de conexões esgotado. App abrindo conexões sem fechar.
  Fix: Configurar connection pool (max 20-50), verificar leaks de conexão.

could not serialize access due to concurrent update
  Causa: Serialization conflict em transação SERIALIZABLE.
  Fix: Retry automático ou usar READ COMMITTED com lock explícito.
```

---

## 7. Pattern Matching — Erro → Causa Provável

```
ERRO                                    CAUSA PROVÁVEL
──────────────────────────────────────────────────────────────
Cannot read properties of undefined     Objeto null/undefined, chave ausente
Maximum call stack size exceeded        Recursão infinita, referência circular
ENOMEM / OOM Killed                     Memory leak, payload gigante, sem limit
ECONNREFUSED                            Serviço destino não está rodando
ECONNRESET                              Conexão fechada pelo servidor remoto (timeout)
ETIMEDOUT                               Timeout de rede (firewall, DNS, serviço lento)
EPERM / EACCES                          Permissão de arquivo/diretório
ENOSPC                                  Disco cheio (logs, temp files, uploads)
EMFILE / ENFILE                         Too many open files (file descriptors esgotados)
ERR_HTTP_HEADERS_SENT                   Response enviada 2x (next() chamado após res.json())
MODULE_NOT_FOUND                        Dependência não instalada, caminho errado
JSON parse error                        API retornou HTML (error page) ao invés de JSON
Segmentation fault                      Dependência nativa com bug, versão incompatível
Process exited with code 137            OOM Killed pelo OS/container (128+9=SIGKILL)
Process exited with code 143            SIGTERM (graceful shutdown solicitado)
```
