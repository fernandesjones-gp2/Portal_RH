# Race Conditions — Concorrência, Deadlocks e Async Pitfalls

## Índice
1. O Que É Race Condition
2. Sintomas e Como Identificar
3. Race Conditions em JavaScript/Node.js
4. Race Conditions no Banco de Dados
5. Deadlocks
6. Soluções e Patterns
7. Testes para Race Conditions

---

## 1. O Que É Race Condition

```
Race condition: o resultado do código DEPENDE da ORDEM em que
operações concorrentes executam. Se a ordem muda (por timing,
carga, latência), o resultado muda — e geralmente quebra.

Analogia simples:
  Dois caixas leem o saldo: R$100
  Caixa A debita R$80: saldo = 100 - 80 = 20 ✅
  Caixa B debita R$50: saldo = 100 - 50 = 50 ✅
  Mas os dois leram R$100! O saldo deveria ser -R$30.
  Resultado: débito duplo com saldo insuficiente.

Por que é difícil de debugar:
├── Intermitente — funciona 99% das vezes
├── Não reproduz em dev — precisa de concorrência real
├── Testes unitários não pegam — rodam sequencialmente
├── Logs podem mudar o timing (Heisenbug)
└── "Funciona no meu computador" — sim, com 1 user
```

---

## 2. Sintomas e Como Identificar

```
Red flags de race condition:

Dados:
├── "Saldo negativo impossível apareceu no banco"
├── "Estoque ficou -3 mas deveria ser 0 mínimo"
├── "Pedido duplicado — user clicou 2x e gerou 2 pedidos"
├── "Dados inconsistentes entre tabelas"
└── "Counter mostra valor errado sob carga"

Comportamento:
├── "Funciona sozinho, quebra sob carga"
├── "Intermitente — às vezes funciona, às vezes não"
├── "Acontece em produção mas não em dev"
├── "Adicionar um console.log faz funcionar" (timing muda!)
└── "Promise resolve com valor antigo/stale"

Padrão: READ → DECIDE → WRITE sem lock/transaction
  Se dois processos fazem isso ao mesmo tempo,
  ambos READ o mesmo estado e WRITE baseados nele.
```

---

## 3. Race Conditions em JavaScript/Node.js

### Race #1: Double Submit (o mais comum)

```javascript
// ❌ RACE — user clica "Comprar" 2x rapidamente
app.post('/api/orders', auth, async (req, res) => {
  const user = await getUser(req.userId);      // T1: saldo=100, T2: saldo=100
  if (user.balance < req.body.total) {          // T1: 100 >= 80 ✅, T2: 100 >= 80 ✅
    return res.status(422).json({ error: 'Saldo insuficiente' });
  }
  await debitBalance(req.userId, req.body.total); // T1: saldo=20, T2: saldo=20 (deveria ser -60!)
  await createOrder(req.body);                     // Dois pedidos criados!
  res.status(201).json({ success: true });
});

// ✅ FIX — Idempotency key
app.post('/api/orders', auth, async (req, res) => {
  const idempotencyKey = req.headers['x-idempotency-key'];
  if (!idempotencyKey) return res.status(400).json({ error: 'Idempotency key required' });

  // Verificar se já processou este request
  const existing = await redis.get(`idempotency:${idempotencyKey}`);
  if (existing) return res.status(200).json(JSON.parse(existing));

  // Lock para este user (evitar concorrência no saldo)
  const lock = await acquireLock(`order:${req.userId}`, 10000);
  try {
    const user = await getUser(req.userId);
    if (user.balance < req.body.total) {
      return res.status(422).json({ error: 'Saldo insuficiente' });
    }
    await debitBalance(req.userId, req.body.total);
    const order = await createOrder(req.body);

    // Salvar resultado para idempotência
    await redis.set(`idempotency:${idempotencyKey}`, JSON.stringify(order), 'EX', 86400);
    res.status(201).json(order);
  } finally {
    await lock.release();
  }
});
```

### Race #2: Stale Read em Async

```javascript
// ❌ RACE — estado muda entre verificar e usar
async function processPayment(orderId) {
  const order = await orderRepo.findById(orderId);
  if (order.status !== 'pending') return; // Verificou

  // ... 200ms de latência de rede com Stripe ...
  await stripeClient.charge(order.total);

  // Nesse meio tempo, outro request cancelou o pedido!
  // Mas já cobrou no Stripe!
  await orderRepo.updateStatus(orderId, 'paid');
}

// ✅ FIX — Atomic update com condition
async function processPayment(orderId) {
  // Atomic: UPDATE ... WHERE status = 'pending'
  // Se outro processo já mudou o status, affected rows = 0
  const updated = await orderRepo.updateStatus(orderId, 'processing', {
    where: { status: 'pending' }, // Condição atômica
  });

  if (updated.count === 0) {
    return; // Alguém já mudou o status — abort
  }

  try {
    await stripeClient.charge(updated.order.total);
    await orderRepo.updateStatus(orderId, 'paid');
  } catch (error) {
    await orderRepo.updateStatus(orderId, 'pending'); // Rollback
    throw error;
  }
}
```

### Race #3: Promise.all com shared state

```javascript
// ❌ RACE — múltiplas promises modificando mesmo objeto
let totalProcessed = 0;

await Promise.all(items.map(async (item) => {
  await processItem(item);
  totalProcessed++; // RACE! Múltiplos increments concorrentes
  // JS é single-thread, mas o await cede controle
}));

// ✅ FIX — contar após todas completarem
const results = await Promise.all(items.map(async (item) => {
  await processItem(item);
  return 1; // Cada promise retorna seu resultado
}));
const totalProcessed = results.reduce((sum, r) => sum + r, 0);
```

---

## 4. Race Conditions no Banco de Dados

### Read-Modify-Write (Check-then-Act)

```sql
-- ❌ RACE — duas transações simultâneas
-- T1: SELECT stock FROM products WHERE id = 1;  → stock = 5
-- T2: SELECT stock FROM products WHERE id = 1;  → stock = 5
-- T1: UPDATE products SET stock = 4 WHERE id = 1;  → 5-1 = 4
-- T2: UPDATE products SET stock = 4 WHERE id = 1;  → 5-1 = 4 (deveria ser 3!)

-- ✅ FIX 1: Atomic update (MELHOR — sem lock)
UPDATE products SET stock = stock - 1 WHERE id = 1 AND stock > 0;
-- Se stock = 0, affected rows = 0 → tratar como "estoque insuficiente"

-- ✅ FIX 2: SELECT FOR UPDATE (lock pessimista)
BEGIN;
SELECT stock FROM products WHERE id = 1 FOR UPDATE; -- Trava a row
-- Outra transação ESPERA até esta terminar
UPDATE products SET stock = stock - 1 WHERE id = 1;
COMMIT;

-- ✅ FIX 3: Optimistic locking (version field)
UPDATE products
SET stock = stock - 1, version = version + 1
WHERE id = 1 AND version = 5; -- Versão que eu li
-- Se affected rows = 0, alguém mudou antes → retry
```

```javascript
// Prisma — Atomic update
await prisma.product.update({
  where: { id: productId },
  data: { stock: { decrement: 1 } }, // Atômico!
});

// Prisma — Optimistic locking
const product = await prisma.product.findUnique({ where: { id } });

try {
  await prisma.product.update({
    where: { id, version: product.version }, // Match version
    data: { stock: product.stock - 1, version: { increment: 1 } },
  });
} catch (error) {
  if (error.code === 'P2025') { // Record not found (version mismatch)
    // Retry: re-read e tentar novamente
  }
}
```

---

## 5. Deadlocks

```
Deadlock: T1 espera T2 liberar lock A, T2 espera T1 liberar lock B.
Ninguém solta. Os dois travam para sempre.

Cenário:
  T1: BEGIN → UPDATE orders SET ... WHERE id=1 (lock order 1)
  T2: BEGIN → UPDATE orders SET ... WHERE id=2 (lock order 2)
  T1:         UPDATE orders SET ... WHERE id=2 → ESPERA T2 liberar order 2
  T2:         UPDATE orders SET ... WHERE id=1 → ESPERA T1 liberar order 1
  → DEADLOCK! PostgreSQL detecta e mata uma das transações.

Prevenção:
├── Ordenar locks sempre na MESMA ORDEM (ex: por ID crescente)
├── Manter transações CURTAS (menos tempo segurando locks)
├── Evitar lock escalation (muitos row locks → table lock)
├── Usar timeout em transações (não esperar infinitamente)
└── Retry automático quando detectar deadlock
```

```javascript
// ✅ FIX — Ordenar operações por ID para evitar deadlock
async function transferBetweenAccounts(fromId, toId, amount) {
  // SEMPRE lockar na mesma ordem (menor ID primeiro)
  const [firstId, secondId] = fromId < toId
    ? [fromId, toId]
    : [toId, fromId];

  await prisma.$transaction(async (tx) => {
    await tx.account.update({
      where: { id: firstId },
      data: { balance: firstId === fromId
        ? { decrement: amount }
        : { increment: amount } },
    });
    await tx.account.update({
      where: { id: secondId },
      data: { balance: secondId === toId
        ? { increment: amount }
        : { decrement: amount } },
    });
  });
}
```

---

## 6. Soluções e Patterns

| Pattern | Quando usar | Como |
|---------|------------|------|
| **Atomic update** | Incrementar/decrementar valor | `SET x = x - 1 WHERE x > 0` |
| **Optimistic lock** | Conflito raro, read-heavy | `WHERE version = N` + retry |
| **Pessimistic lock** | Conflito frequente, write-heavy | `SELECT ... FOR UPDATE` |
| **Idempotency key** | Double submit prevention | Cache resultado por key em Redis |
| **Distributed lock** | Multi-instance, shared resource | Redis SETNX com TTL (Redlock) |
| **Queue** | Serializar processamento | Processar um por vez via fila |
| **SERIALIZABLE** | Transação complexa, integridade total | Isolation level mais forte + retry |

### Distributed Lock com Redis

```javascript
import { Redlock } from 'redlock';

const redlock = new Redlock([redis], {
  retryCount: 3,
  retryDelay: 200,
});

async function processPayment(orderId) {
  const lock = await redlock.acquire([`lock:order:${orderId}`], 10000); // 10s TTL

  try {
    // Código protegido — apenas 1 instância executa
    const order = await getOrder(orderId);
    await chargePayment(order);
    await updateOrderStatus(orderId, 'paid');
  } finally {
    await lock.release(); // SEMPRE liberar!
  }
}
```

---

## 7. Testes para Race Conditions

```javascript
// Testar concorrência: disparar N requests simultâneos

describe('Order creation - concurrency', () => {
  it('should not allow double debit on concurrent orders', async () => {
    // Setup: user com saldo = 100, pedido de 80
    const user = await createUser({ balance: 10000 }); // R$100

    // Disparar 5 requests SIMULTÂNEOS
    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () =>
        request.post('/api/orders')
          .set('Authorization', `Bearer ${user.token}`)
          .set('X-Idempotency-Key', crypto.randomUUID()) // Keys diferentes
          .send({ items: [{ productId: 'p1', quantity: 1, price: 8000 }] })
      )
    );

    // Apenas 1 deveria ter sucesso (100 >= 80, mas 100 < 80*2)
    const successes = results.filter(r => r.value?.status === 201);
    const failures = results.filter(r => r.value?.status === 422);

    expect(successes.length).toBe(1);
    expect(failures.length).toBe(4);

    // Verificar saldo final
    const finalUser = await getUser(user.id);
    expect(finalUser.balance).toBe(2000); // 100 - 80 = 20, não negativo
  });
});
```
