# Bug Patterns — Erros Comuns por Categoria

## Índice
1. Null / Undefined Handling
2. Off-by-One e Boundary Errors
3. Race Conditions e Concorrência
4. Error Handling Quebrado
5. Type Coercion e Comparação
6. Async / Promises
7. State Management
8. Edge Cases Clássicos

---

## 1. Null / Undefined Handling

```javascript
// 🟠 HIGH — Acessar propriedade de possível null
const userName = user.profile.name; // Se user ou profile for null → crash
// ✅ FIX
const userName = user?.profile?.name ?? 'Anônimo';

// 🟠 HIGH — Array method em possível null
const names = users.map(u => u.name); // Se users for null → crash
// ✅ FIX
const names = (users ?? []).map(u => u.name);

// 🟡 MEDIUM — Não verificar retorno de busca
const user = await User.findById(id);
user.name = 'New Name'; // Se user não existir → crash
// ✅ FIX
const user = await User.findById(id);
if (!user) throw new NotFoundError('User not found');
user.name = 'New Name';
```

```python
# 🟠 HIGH — KeyError em dicionário
value = data['key']  # Se 'key' não existir → KeyError
# ✅ FIX
value = data.get('key', default_value)

# 🟠 HIGH — AttributeError em None
result = get_user(id)
print(result.name)  # Se None → AttributeError
# ✅ FIX
result = get_user(id)
if result is None:
    raise NotFoundError(f'User {id} not found')
```

---

## 2. Off-by-One e Boundary Errors

```javascript
// 🟠 HIGH — Loop errado (boundary)
for (let i = 0; i <= array.length; i++) { // <= em vez de <
  console.log(array[i]); // Último acesso é undefined
}
// ✅ FIX
for (let i = 0; i < array.length; i++) { ... }

// 🟡 MEDIUM — Slice/substring errado
const firstThree = items.slice(0, 2); // Retorna 2, não 3
// ✅ FIX
const firstThree = items.slice(0, 3);

// 🟡 MEDIUM — Pagination off-by-one
const offset = page * limit; // Página 1 começa no offset 'limit', não 0
// ✅ FIX
const offset = (page - 1) * limit;
```

---

## 3. Race Conditions e Concorrência

```javascript
// 🟠 HIGH — Check-then-act sem lock (TOCTOU)
const stock = await Product.findById(id);
if (stock.quantity >= requestedQty) {
  // Entre o check e o update, outro request pode ter esgotado o estoque
  stock.quantity -= requestedQty;
  await stock.save();
}
// ✅ FIX — Atomic update
const result = await Product.updateOne(
  { _id: id, quantity: { $gte: requestedQty } }, // Check + update atômico
  { $inc: { quantity: -requestedQty } }
);
if (result.modifiedCount === 0) throw new Error('Estoque insuficiente');

// ✅ FIX (SQL) — SELECT FOR UPDATE
BEGIN;
SELECT quantity FROM products WHERE id = $1 FOR UPDATE; -- Lock a row
UPDATE products SET quantity = quantity - $2 WHERE id = $1 AND quantity >= $2;
COMMIT;
```

```javascript
// 🟠 HIGH — Double submit (idempotência)
app.post('/api/payments', async (req, res) => {
  await processPayment(req.body); // Sem idempotency key → cobrado 2x
});
// ✅ FIX — Idempotency key
app.post('/api/payments', async (req, res) => {
  const idempotencyKey = req.headers['idempotency-key'];
  const existing = await Payment.findOne({ idempotencyKey });
  if (existing) return res.json(existing); // Retorna resultado anterior
  const result = await processPayment(req.body);
  await Payment.create({ ...result, idempotencyKey });
  res.json(result);
});
```

---

## 4. Error Handling Quebrado

```javascript
// 🟠 HIGH — Catch vazio (swallow error)
try {
  await riskyOperation();
} catch (e) {
  // Silêncio total — bug invisível
}
// ✅ FIX — Pelo menos logar
try {
  await riskyOperation();
} catch (error) {
  logger.error('riskyOperation failed', { error: error.message, stack: error.stack });
  throw error; // Re-throw se não souber tratar
}

// 🟡 MEDIUM — Catch genérico que esconde bugs
try {
  const data = JSON.parse(input);
  await processData(data);
  await saveToDb(data);
} catch (e) {
  res.status(400).json({ error: 'Invalid input' }); // E se o erro for no DB?
}
// ✅ FIX — Catch específico
try {
  const data = JSON.parse(input);
} catch (e) {
  return res.status(400).json({ error: 'Invalid JSON' });
}
try {
  await processData(data);
  await saveToDb(data);
} catch (e) {
  logger.error('Processing failed', { error: e.message });
  return res.status(500).json({ error: 'Internal error' });
}

// 🟡 MEDIUM — Promise sem catch
fetchData(); // Se rejeitar, UnhandledPromiseRejection → crash
// ✅ FIX
fetchData().catch(err => logger.error('Fetch failed', err));
// Ou: await com try/catch
```

```python
# 🟠 HIGH — except: sem tipo (pega TUDO, incluindo KeyboardInterrupt)
try:
    result = do_something()
except:
    pass
# ✅ FIX
try:
    result = do_something()
except ValueError as e:
    logger.error(f"Validation failed: {e}")
    raise
```

---

## 5. Type Coercion e Comparação

```javascript
// 🟡 MEDIUM — Comparação com == (coerção implícita)
if (userId == '0') { ... }    // true para 0, '', false, null em alguns casos
if (value == null) { ... }     // true para null E undefined
// ✅ FIX — Sempre usar ===
if (userId === '0') { ... }

// 🟡 MEDIUM — Truthy/falsy surprises
if (count) { ... }  // false para 0 (que é um count válido!)
// ✅ FIX
if (count !== undefined && count !== null) { ... }
// Ou: if (count != null) — único caso onde == é aceitável

// 🟡 MEDIUM — parseInt sem radix
parseInt('08');  // 8 em engines modernas, mas NaN em antigas
// ✅ FIX
parseInt('08', 10); // Sempre especificar base
// Ou: Number('08')
```

---

## 6. Async / Promises

```javascript
// 🟠 HIGH — forEach com async (não espera as promises)
items.forEach(async (item) => {
  await processItem(item); // forEach ignora o await!
});
console.log('Done'); // Executa ANTES dos items serem processados

// ✅ FIX — for...of (sequencial)
for (const item of items) {
  await processItem(item);
}

// ✅ FIX — Promise.all (paralelo)
await Promise.all(items.map(item => processItem(item)));

// 🟡 MEDIUM — await em loop (sequencial desnecessário)
for (const id of userIds) {
  const user = await fetchUser(id); // N requests sequenciais = N * latência
}
// ✅ FIX — Paralelizar quando independentes
const users = await Promise.all(userIds.map(id => fetchUser(id)));

// 🟡 MEDIUM — Promise.all sem error handling (1 falha = tudo falha)
const results = await Promise.all(promises); // 1 rejeição cancela tudo
// ✅ FIX — allSettled se pode falhar parcialmente
const results = await Promise.allSettled(promises);
const successful = results.filter(r => r.status === 'fulfilled').map(r => r.value);
const failed = results.filter(r => r.status === 'rejected').map(r => r.reason);
```

---

## 7. State Management

```javascript
// 🟠 HIGH — Mutação de objeto compartilhado
const defaultConfig = { retries: 3, timeout: 5000 };
function createClient(overrides) {
  const config = defaultConfig; // REFERÊNCIA, não cópia!
  config.timeout = overrides.timeout; // Muta o default para todos!
  return new Client(config);
}
// ✅ FIX — Cópia
const config = { ...defaultConfig, ...overrides };

// 🟡 MEDIUM — React state mutation
const [items, setItems] = useState([1, 2, 3]);
const addItem = (item) => {
  items.push(item); // Muta state diretamente!
  setItems(items);   // React não detecta mudança (mesma referência)
};
// ✅ FIX
const addItem = (item) => {
  setItems(prev => [...prev, item]); // Novo array
};
```

---

## 8. Edge Cases Clássicos

```
Checklist de edge cases para revisar:

Input:
├── String vazia ('')
├── null / undefined / NaN
├── Array vazio ([])
├── Objeto vazio ({})
├── Número zero (0) — especialmente em truthy/falsy checks
├── Número negativo
├── Número muito grande (overflow)
├── Caracteres especiais (unicode, emojis, aspas, < > &)
├── String muito longa (>64KB)
└── Input com espaços em branco (' ', '\t', '\n')

Data:
├── Timezone: UTC vs local? DST transitions?
├── Locale: vírgula vs ponto decimal? dd/mm vs mm/dd?
├── Moeda: float vs integer em centavos (0.1 + 0.2 !== 0.3)
├── Encoding: UTF-8 vs Latin1? BOM?
└── Concorrência: dois requests simultâneos para mesmo recurso?

Estado:
├── Primeiro acesso (banco vazio, sem dados)
├── Permissão negada (user sem role)
├── Recurso deletado (soft delete, referência pendente)
├── Sessão expirada no meio de operação
└── Conexão com DB/Redis perdida
```
