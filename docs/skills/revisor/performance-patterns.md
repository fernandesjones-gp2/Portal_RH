# Performance Patterns — Anti-Patterns e Soluções

## Índice
1. N+1 Queries
2. Loops Ineficientes
3. Memory Leaks
4. Database Performance
5. Frontend Performance
6. Caching Mal Implementado
7. Serialization Overhead

---

## 1. N+1 Queries

O anti-pattern de performance mais comum em apps com ORM.

```javascript
// 🟠 HIGH — N+1: 1 query para orders + N queries para users
const orders = await Order.findAll({ where: { status: 'pending' } }); // 1 query
for (const order of orders) {
  order.user = await User.findById(order.userId); // N queries!
}
// Se N = 100 orders → 101 queries. Se N = 10000 → 10001 queries.

// ✅ FIX — Eager loading (1-2 queries)
const orders = await Order.findAll({
  where: { status: 'pending' },
  include: [{ model: User }], // JOIN ou IN (...) query
});

// ✅ FIX manual — Batch load
const orders = await Order.findAll({ where: { status: 'pending' } });
const userIds = [...new Set(orders.map(o => o.userId))];
const users = await User.findAll({ where: { id: userIds } });
const userMap = new Map(users.map(u => [u.id, u]));
orders.forEach(o => o.user = userMap.get(o.userId));
// Total: 2 queries, independente de N
```

### Como detectar

```
Sinais de N+1:
├── Muitas queries idênticas com parâmetro diferente nos logs
├── Tempo de response cresce linearmente com tamanho da lista
├── ORM sem include/select_related/eager loading
└── Loop que faz await de query dentro
```

---

## 2. Loops Ineficientes

```javascript
// 🟡 MEDIUM — Lookup O(n) repetido em loop = O(n²)
const results = orders.map(order => {
  const user = users.find(u => u.id === order.userId); // O(n) por iteração!
  return { ...order, userName: user?.name };
});
// 100 orders × 1000 users = 100.000 comparações

// ✅ FIX — Map para lookup O(1)
const userMap = new Map(users.map(u => [u.id, u]));
const results = orders.map(order => ({
  ...order,
  userName: userMap.get(order.userId)?.name,
}));
// 100 orders × O(1) = 100 lookups

// 🟡 MEDIUM — Includes em loop = O(n²)
const uniqueItems = [];
for (const item of items) {
  if (!uniqueItems.includes(item)) { // O(n) por iteração
    uniqueItems.push(item);
  }
}
// ✅ FIX — Set
const uniqueItems = [...new Set(items)];

// 🟡 MEDIUM — Concatenação de string em loop (GC pressure)
let html = '';
for (const item of items) {
  html += `<li>${item.name}</li>`; // Cria novo string a cada iteração
}
// ✅ FIX — Array.join
const html = items.map(item => `<li>${item.name}</li>`).join('');
```

---

## 3. Memory Leaks

```javascript
// 🟠 HIGH — Event listener nunca removido
class Component {
  constructor() {
    window.addEventListener('resize', this.handleResize); // Nunca removido
  }
  // ✅ FIX — Cleanup no destructor
  destroy() {
    window.removeEventListener('resize', this.handleResize);
  }
}

// 🟠 HIGH — Closure segurando referência grande
function processLargeFile(filePath) {
  const hugeBuffer = fs.readFileSync(filePath); // 500MB em memória
  return function getSize() {
    return hugeBuffer.length; // Closure mantém hugeBuffer vivo!
  };
}
// ✅ FIX — Extrair apenas o necessário
function processLargeFile(filePath) {
  const size = fs.statSync(filePath).size; // Só o tamanho
  return function getSize() { return size; };
}

// 🟠 HIGH — Acumulação em array/Map global sem limit
const cache = new Map();
function getData(key) {
  if (cache.has(key)) return cache.get(key);
  const data = fetchFromDb(key);
  cache.set(key, data); // Cresce infinitamente!
  return data;
}
// ✅ FIX — LRU cache com limite
const LRU = require('lru-cache');
const cache = new LRU({ max: 1000 }); // Máximo 1000 entries

// 🟡 MEDIUM — setInterval sem clearInterval
const interval = setInterval(checkHealth, 5000);
// Se o módulo for descarregado sem clear, continua rodando
// ✅ FIX
process.on('SIGTERM', () => clearInterval(interval));
```

---

## 4. Database Performance

```javascript
// 🟠 HIGH — SELECT * quando precisa de poucos campos
const users = await db.query('SELECT * FROM users'); // Traz 20 colunas
// ✅ FIX
const users = await db.query('SELECT id, name, email FROM users');

// 🟠 HIGH — Query dentro de transação longa
await db.transaction(async (trx) => {
  const orders = await trx('orders').where({ status: 'pending' });
  for (const order of orders) {
    await sendEmail(order.userId); // I/O externo dentro da transação!
    await trx('orders').where({ id: order.id }).update({ notified: true });
  }
}); // Transação aberta por minutos → locks → deadlocks
// ✅ FIX — Separar query de side-effects
const orders = await db('orders').where({ status: 'pending' });
const emailPromises = orders.map(o => sendEmail(o.userId)); // Fora da transação
await Promise.allSettled(emailPromises);
await db.transaction(async (trx) => {
  await trx('orders').whereIn('id', orders.map(o => o.id)).update({ notified: true });
});

// 🟡 MEDIUM — COUNT(*) em tabela grande para "total de resultados"
const [{ count }] = await db.raw('SELECT COUNT(*) FROM events WHERE type = ?', [type]);
// 5 segundos para 10M rows
// ✅ FIX — Estimativa ou cache o count
// Ou: trocar para cursor-based pagination (sem count)
```

---

## 5. Frontend Performance

```javascript
// 🟡 MEDIUM — Re-render desnecessário (React)
function ParentComponent({ data }) {
  const processed = expensiveCalc(data); // Recalcula em todo render
  return <ChildComponent data={processed} />;
}
// ✅ FIX — useMemo
function ParentComponent({ data }) {
  const processed = useMemo(() => expensiveCalc(data), [data]);
  return <ChildComponent data={processed} />;
}

// 🟡 MEDIUM — Callback recriado a cada render
function List({ items }) {
  return items.map(item => (
    <Item
      key={item.id}
      onClick={() => handleClick(item.id)} // Nova função a cada render
    />
  ));
}
// ✅ FIX — useCallback ou passar id como prop
function List({ items }) {
  const handleClick = useCallback((id) => { ... }, []);
  return items.map(item => (
    <Item key={item.id} id={item.id} onClick={handleClick} />
  ));
}

// 🟡 MEDIUM — Importar lib inteira quando precisa de 1 função
import _ from 'lodash'; // ~70KB gzipped
_.get(obj, 'path.to.value');
// ✅ FIX — Import granular
import get from 'lodash/get'; // ~2KB
// Ou: obj?.path?.to?.value (nativo)
```

---

## 6. Caching Mal Implementado

```javascript
// 🟡 MEDIUM — Cache sem expiração (stale forever)
const cache = {};
async function getUser(id) {
  if (cache[id]) return cache[id];
  cache[id] = await db.users.findById(id);
  return cache[id];
}
// Problema: se o user mudar, cache retorna dados antigos PARA SEMPRE

// ✅ FIX — TTL
async function getUser(id) {
  const cached = await redis.get(`user:${id}`);
  if (cached) return JSON.parse(cached);
  const user = await db.users.findById(id);
  await redis.set(`user:${id}`, JSON.stringify(user), 'EX', 300); // 5 min TTL
  return user;
}

// 🟡 MEDIUM — Cache stampede (thundering herd)
// 1000 requests simultâneos → cache miss → 1000 queries ao DB
// ✅ FIX — Lock durante refresh
async function getUser(id) {
  const cached = await redis.get(`user:${id}`);
  if (cached) return JSON.parse(cached);
  const lockKey = `lock:user:${id}`;
  const acquired = await redis.set(lockKey, '1', 'NX', 'EX', 5);
  if (!acquired) {
    await sleep(100); // Esperar quem pegou o lock
    return getUser(id); // Retry
  }
  const user = await db.users.findById(id);
  await redis.set(`user:${id}`, JSON.stringify(user), 'EX', 300);
  await redis.del(lockKey);
  return user;
}
```

---

## 7. Serialization Overhead

```javascript
// 🟡 MEDIUM — JSON.parse/stringify repetido desnecessariamente
app.get('/api/data', (req, res) => {
  const raw = cache.get('data'); // Já é string JSON
  const obj = JSON.parse(raw);   // Parse
  res.json(obj);                  // Stringify de novo!
});
// ✅ FIX — Enviar raw se já é JSON
res.setHeader('Content-Type', 'application/json');
res.end(raw);

// 🟡 MEDIUM — Serializar objetos gigantes
const response = {
  data: hugeArray, // 10.000 items com 50 campos cada
  meta: { total: 100000 }
};
res.json(response); // JSON.stringify de 10K items = 100ms+
// ✅ FIX — Paginar + selecionar campos
const data = items.map(({ id, name, status }) => ({ id, name, status }));
res.json({ data, meta: { page, limit, total } });
```
