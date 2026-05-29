# Maintainability Guide — Legibilidade, Complexidade e Code Smells

## Índice
1. Naming (Nomenclatura)
2. Complexidade Ciclomática
3. DRY — Don't Repeat Yourself
4. KISS — Keep It Simple
5. Funções e Módulos
6. Comentários
7. Code Smells Quick Reference

---

## 1. Naming (Nomenclatura)

### Regras de naming

```javascript
// LOW — Nomes genéricos ou abreviados
const d = new Date();
const u = await getUser(id);
const arr = fetchItems();
const temp = calculate(x, y);
function proc(d) { ... }

// FIX — Nomes que revelam intenção
const createdAt = new Date();
const currentUser = await getUser(id);
const pendingOrders = fetchItems();
const totalWithTax = calculate(subtotal, taxRate);
function processPayment(paymentData) { ... }
```

### Convenções por tipo

```
Variáveis e funções:  camelCase     - userName, calculateTotal()
Classes:              PascalCase    - UserService, PaymentGateway
Constantes:           UPPER_SNAKE   - MAX_RETRIES, API_BASE_URL
Arquivos/módulos:     kebab-case    - user-service.ts, payment-gateway.ts
Tabelas/colunas DB:   snake_case    - user_profiles, created_at
Env vars:             UPPER_SNAKE   - DATABASE_URL, JWT_SECRET
```

### Naming de booleans

```javascript
// LOW — Boolean sem prefixo
const active = true;
const admin = user.role === 'admin';
const visible = checkVisibility();

// FIX — Prefixo is/has/should/can
const isActive = true;
const isAdmin = user.role === 'admin';
const isVisible = checkVisibility();
const hasPermission = user.canEdit(resource);
const shouldRetry = attempts < MAX_RETRIES;
```

### Naming de funções

```javascript
// LOW — Verbo vago ou ausente
function userData(id) { ... }    // Get? Set? Delete?
function order(items) { ... }    // O que faz com order?
function check(input) { ... }    // Check o que?

// FIX — Verbo especifico + substantivo
function getUserById(id) { ... }
function createOrder(items) { ... }
function validateEmailFormat(input) { ... }
```

---

## 2. Complexidade Ciclomática

Numero de caminhos independentes no código. Alto = difícil de entender e testar.

### Detecção

```javascript
// MEDIUM — Complexidade alta (muitos branches)
function processOrder(order, user, coupon) {
  if (!order) return null;
  if (!user) throw new Error('User required');
  if (order.status === 'cancelled') return { error: 'cancelled' };
  if (order.items.length === 0) return { error: 'empty' };

  let total = 0;
  for (const item of order.items) {
    if (item.type === 'physical') {
      if (item.weight > 30) {
        total += item.price + calculateHeavyShipping(item);
      } else {
        total += item.price + calculateShipping(item);
      }
    } else if (item.type === 'digital') {
      total += item.price;
    } else if (item.type === 'subscription') {
      if (user.hasActiveSubscription) {
        total += item.price * 0.8;
      } else {
        total += item.price;
      }
    }
  }

  if (coupon) {
    if (coupon.type === 'percentage') {
      total *= (1 - coupon.value / 100);
    } else if (coupon.type === 'fixed') {
      total -= coupon.value;
    }
    if (total < 0) total = 0;
  }

  return { total };
}
// Complexidade: ~15. Difícil testar todos os caminhos.
```

```javascript
// FIX — Extrair funções, early return, strategy
function processOrder(order, user, coupon) {
  validateOrder(order, user);
  const subtotal = calculateSubtotal(order.items, user);
  const total = applyCoupon(subtotal, coupon);
  return { total };
}

function validateOrder(order, user) {
  if (!order) throw new ValidationError('Order required');
  if (!user) throw new ValidationError('User required');
  if (order.status === 'cancelled') throw new BusinessError('Order cancelled');
  if (order.items.length === 0) throw new BusinessError('Order empty');
}

const itemCalculators = {
  physical: (item) => item.price + calculateShipping(item),
  digital: (item) => item.price,
  subscription: (item, user) =>
    user.hasActiveSubscription ? item.price * 0.8 : item.price,
};

function calculateSubtotal(items, user) {
  return items.reduce((sum, item) => {
    const calc = itemCalculators[item.type];
    return sum + (calc ? calc(item, user) : item.price);
  }, 0);
}

function applyCoupon(subtotal, coupon) {
  if (!coupon) return subtotal;
  const discounted = coupon.type === 'percentage'
    ? subtotal * (1 - coupon.value / 100)
    : subtotal - coupon.value;
  return Math.max(discounted, 0);
}
// Cada função: complexidade 1-3. Fácil de testar isoladamente.
```

### Thresholds

| Complexidade | Classificação | Ação |
|-------------|--------------|------|
| 1-5 | Simples | OK |
| 6-10 | Moderada | Considerar refatorar |
| 11-20 | Alta | Refatorar obrigatório |
| 20+ | Muito alta | Split urgente |

---

## 3. DRY — Don't Repeat Yourself

```javascript
// MEDIUM — Lógica duplicada
async function getActiveUsers() {
  const users = await db.query(
    'SELECT * FROM users WHERE status = $1 AND deleted_at IS NULL ORDER BY created_at DESC',
    ['active']
  );
  return users.map(u => ({ id: u.id, name: u.name, email: u.email }));
}
async function getActiveAdmins() {
  const users = await db.query(
    'SELECT * FROM users WHERE status = $1 AND deleted_at IS NULL AND role = $2 ORDER BY created_at DESC',
    ['active', 'admin']
  );
  return users.map(u => ({ id: u.id, name: u.name, email: u.email }));
}
// 80% do código é identico

// FIX — Extrair a parte comum
async function findUsers(filters = {}) {
  const where = { status: 'active', deletedAt: null, ...filters };
  const users = await User.findAll({ where, order: [['createdAt', 'DESC']] });
  return users.map(({ id, name, email }) => ({ id, name, email }));
}
const activeUsers = await findUsers();
const activeAdmins = await findUsers({ role: 'admin' });
```

### Quando NÃO aplicar DRY

```
DRY não é "nunca repetir nenhuma linha".
Repetição aceitável:
  - Código que PARECE igual mas muda por razões diferentes
  - Tests (repetição em testes é OK para clareza)
  - Config por ambiente (cada .env é "duplicado" de propósito)
  - Quando a abstração seria mais complexa que a duplicação

Regra: Se o código se repete 3+ vezes E muda pelas mesmas razões = DRY.
Se se repete 2x e pode divergir no futuro = talvez deixar duplicado.
```

---

## 4. KISS — Keep It Simple

```javascript
// LOW — Over-engineering para problema simples
class UserNameFormatter {
  constructor(strategy) { this.strategy = strategy; }
  format(user) { return this.strategy.execute(user); }
}
class FirstLastStrategy {
  execute(user) { return user.firstName + ' ' + user.lastName; }
}
// Para... formatar um nome.

// FIX — Função simples
function formatUserName(user) {
  return user.firstName + ' ' + user.lastName;
}

// LOW — Regex para validação simples
const isPositive = /^[1-9]\d*$/.test(String(value));
// FIX
const isPositive = Number.isInteger(value) && value > 0;
```

---

## 5. Funções e Módulos

### Tamanho de função

| Linhas | Classificação |
|--------|--------------|
| 1-20 | Ideal |
| 20-50 | Aceitável se coesa |
| 50-100 | Provavelmente faz demais |
| 100+ | Quebrar obrigatoriamente |

### Parâmetros de função

```javascript
// LOW — Muitos parâmetros (difícil lembrar a ordem)
function createUser(name, email, password, role, avatar, bio, birthDate) { ... }

// FIX — Options object
function createUser({ name, email, password, role = 'user', avatar, bio, birthDate }) { ... }
createUser({ name: 'Ana', email: 'ana@x.com', password: '...', role: 'admin' });
```

### Deep nesting

```javascript
// MEDIUM — 4+ niveis de indentação
function process(data) {
  if (data) {
    if (data.items) {
      for (const item of data.items) {
        if (item.active) {
          if (item.price > 0) {
            // Lógica real enterrada no 5 nivel
          }
        }
      }
    }
  }
}

// FIX — Early return + guard clauses
function process(data) {
  if (!data?.items) return;
  const activeItems = data.items.filter(item => item.active && item.price > 0);
  for (const item of activeItems) {
    // Lógica no 1 nivel
  }
}
```

---

## 6. Comentários

```javascript
// LOW — Comentário óbvio (ruído)
// Incrementa o contador
counter++;

// Get the user by ID
const user = getUserById(id);

// FIX — Comentário útil: explica o PORQUÊ, não o QUÊ
// Retry com backoff exponencial porque a API do parceiro tem rate limiting
// agressivo e rejeita bursts de requests
await retry(fetchPartnerData, { maxRetries: 3, backoff: 'exponential' });

// FIX — Comentário útil: avisa sobre armadilha
// ATENÇÃO: essa query usa hint porque o planner do PG escolhe
// nested loop em vez de hash join quando a tabela tem < 1000 rows
// após VACUUM. Bug reportado em PG#12345.
const result = await db.raw('SELECT /*+ HashJoin(a b) */ ...');

// TODO com contexto
// TODO(2025-Q2): Migrar para cursor-based pagination quando
// ultrapassarmos 100K products. Offset atual é aceitável até ~50K.
```

---

## 7. Code Smells Quick Reference

| Smell | Severidade | Detecção rápida |
|-------|-----------|----------------|
| Função 100+ linhas | MEDIUM | Scroll no arquivo |
| Classe 500+ linhas | MEDIUM | wc -l |
| 5+ parâmetros em função | LOW | Assinatura longa |
| 4+ niveis de nesting | MEDIUM | Indentação visual |
| Switch com 5+ cases | MEDIUM | Pattern matching strings |
| Arquivo "utils" | LOW | Nome genérico |
| Comentário explicando código óbvio | INFO | Redundância |
| Variável temp, data, result, info | LOW | Nome genérico |
| any em TypeScript | MEDIUM | Perde type safety |
| console.log em produção | LOW | Debug esquecido |
| ts-ignore ou eslint-disable | MEDIUM | Escondendo problema |
| Catch vazio | HIGH | try { } catch { } |
| Boolean parameter | LOW | process(true, false) |
| Magic number | LOW | if (status === 3) |
| String hardcoded repetida | LOW | 'pending' em 10 lugares |
