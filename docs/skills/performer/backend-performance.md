# Backend Performance — Node.js, Async, Serialization, Workers

## Índice
1. Response Time Anatomy
2. Async Patterns que Impactam Performance
3. Serialization / Deserialization
4. Batch Processing
5. Worker Threads e Child Processes
6. Connection Management
7. Checklist de Otimização Backend

---

## 1. Response Time Anatomy

```
Onde o tempo é gasto num request típico?

Total: 350ms
├── Middleware (auth, validation, parsing): 15ms
├── Service logic: 5ms
├── Database queries: 250ms       ← #1 gargalo mais comum
├── External API call: 60ms       ← #2 gargalo mais comum
├── Serialization: 10ms
└── Network (server → client): 10ms

80% do tempo está em I/O (DB + external API).
Otimizar I/O primeiro, depois CPU.
```

```javascript
// Middleware de timing para identificar gargalo
app.use((req, res, next) => {
  const start = process.hrtime.bigint();
  const timings = {};

  // Hook no response
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    timings.serialize = Number(process.hrtime.bigint() - start) / 1e6;
    res.setHeader('Server-Timing',
      Object.entries(timings)
        .map(([k, v]) => `${k};dur=${v.toFixed(1)}`)
        .join(', ')
    );
    return originalJson(body);
  };

  req.timing = (label) => {
    timings[label] = Number(process.hrtime.bigint() - start) / 1e6;
  };

  next();
});

// Uso no controller
async function listOrders(req, res) {
  req.timing('start');
  const orders = await orderRepo.findByUser(req.userId);
  req.timing('db');
  const enriched = await enrichWithProducts(orders);
  req.timing('enrich');
  res.json({ data: enriched });
}

// Response header: Server-Timing: start;dur=0.1, db;dur=145.3, enrich;dur=220.1, serialize;dur=350.5
// Diagnóstico: enrich demora 75ms → N+1 ou API externa lenta
```

---

## 2. Async Patterns que Impactam Performance

### Paralelizar I/O independente

```javascript
// ❌ Sequencial (1 + 1 + 1 = 3 roundtrips)
const user = await getUser(userId);          // 50ms
const orders = await getOrders(userId);       // 100ms
const recommendations = await getRecs(userId); // 80ms
// Total: 230ms

// ✅ Paralelo (max de 1 roundtrip)
const [user, orders, recommendations] = await Promise.all([
  getUser(userId),          // 50ms ─┐
  getOrders(userId),        // 100ms ─┤ Total: 100ms (o mais lento)
  getRecs(userId),          // 80ms  ─┘
]);
// Total: 100ms — 2.3x mais rápido
```

### Limitar concorrência

```javascript
// ❌ Promise.all com 10.000 items → 10.000 requests simultâneos → crash
await Promise.all(items.map(item => processItem(item)));

// ✅ Limitar concorrência com p-limit
import pLimit from 'p-limit';
const limit = pLimit(10); // Máximo 10 simultâneos

await Promise.all(items.map(item =>
  limit(() => processItem(item))
));

// ✅ Ou processar em batches
async function processBatches(items, batchSize = 50) {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    await Promise.all(batch.map(processItem));
    // Opcional: delay entre batches para não sobrecarregar
  }
}
```

### Não bloquear desnecessariamente

```javascript
// ❌ Esperar email antes de responder (user espera por nada)
app.post('/api/orders', async (req, res) => {
  const order = await createOrder(req.body);
  await sendConfirmationEmail(order); // 800ms! User esperando...
  res.json(order);
});

// ✅ Fire-and-forget para tarefas não-críticas
app.post('/api/orders', async (req, res) => {
  const order = await createOrder(req.body);
  res.json(order); // Responde IMEDIATAMENTE

  // Email em background (ou melhor: enviar para queue)
  sendConfirmationEmail(order).catch(err =>
    logger.error('Email failed', { orderId: order.id, error: err.message })
  );
});

// ✅✅ Melhor ainda: queue
app.post('/api/orders', async (req, res) => {
  const order = await createOrder(req.body);
  await queue.add('send-email', { orderId: order.id }); // ~5ms
  res.json(order);
});
```

---

## 3. Serialization / Deserialization

```javascript
// JSON.stringify é surpreendentemente caro para payloads grandes.
// Para um array de 10.000 objetos: ~50-200ms no main thread.

// Diagnóstico: Se flame graph mostra JSON.stringify como hot path:

// Fix 1: Retornar MENOS dados (projeção)
// ❌ Retorna 50 campos por order
const orders = await prisma.order.findMany({ include: { items: true, user: true } });

// ✅ Retorna apenas o necessário
const orders = await prisma.order.findMany({
  select: { id: true, status: true, total: true, createdAt: true,
            user: { select: { id: true, name: true } } },
});

// Fix 2: Paginação (menos itens)
// ❌ Retorna TODOS os 10.000 orders
const orders = await prisma.order.findMany();

// ✅ Paginar
const orders = await prisma.order.findMany({ take: 20, cursor: ... });

// Fix 3: Fast JSON serializer
import fastJson from 'fast-json-stringify';

const stringify = fastJson({
  type: 'object',
  properties: {
    id: { type: 'string' },
    status: { type: 'string' },
    total: { type: 'integer' },
    createdAt: { type: 'string' },
  },
});
// 2-5x mais rápido que JSON.stringify para schemas conhecidos

// Fix 4: Streaming para respostas grandes
app.get('/api/export', async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.write('[');
  let first = true;

  const cursor = prisma.order.findManyCursor(/* ... */);
  for await (const batch of cursor) {
    for (const order of batch) {
      if (!first) res.write(',');
      res.write(JSON.stringify(order));
      first = false;
    }
  }
  res.write(']');
  res.end();
});
```

---

## 4. Batch Processing

```javascript
// Pattern: DataLoader (resolver N+1 em GraphQL e REST)
// Agrupa múltiplas chamadas individuais em UMA query batch.

import DataLoader from 'dataloader';

// Ao invés de: SELECT * FROM users WHERE id = '1'
//              SELECT * FROM users WHERE id = '2'
//              SELECT * FROM users WHERE id = '3'
// Faz:          SELECT * FROM users WHERE id IN ('1', '2', '3')

const userLoader = new DataLoader(async (userIds) => {
  const users = await prisma.user.findMany({
    where: { id: { in: [...userIds] } },
  });
  // DataLoader exige que retorne na MESMA ORDEM dos IDs
  const userMap = new Map(users.map(u => [u.id, u]));
  return userIds.map(id => userMap.get(id) || null);
});

// Uso: resolve N chamadas individuais em 1 query batch
const user1 = await userLoader.load('user-1'); // Acumula
const user2 = await userLoader.load('user-2'); // Acumula
const user3 = await userLoader.load('user-3'); // Acumula
// No próximo tick do event loop: executa 1 query com IN ('1', '2', '3')

// Batch DB writes
// ❌ N inserts individuais
for (const item of items) {
  await prisma.orderItem.create({ data: item }); // 1 INSERT × N
}

// ✅ 1 batch insert
await prisma.orderItem.createMany({ data: items }); // 1 INSERT
```

---

## 5. Worker Threads e Child Processes

```javascript
// Quando usar workers:
// CPU-bound > 50ms que bloqueia event loop.
// Exemplos: compressão, image processing, cálculos pesados, PDF generation.

// worker-pool.js — Pool reutilizável
import { Worker } from 'worker_threads';
import os from 'os';

class WorkerPool {
  #workers = [];
  #queue = [];
  #maxWorkers;

  constructor(workerScript, maxWorkers = os.cpus().length - 1) {
    this.#maxWorkers = maxWorkers;
    this.workerScript = workerScript;
  }

  async execute(data) {
    return new Promise((resolve, reject) => {
      const task = { data, resolve, reject };

      if (this.#workers.length < this.#maxWorkers) {
        this.#runWorker(task);
      } else {
        this.#queue.push(task); // Esperar worker disponível
      }
    });
  }

  #runWorker(task) {
    const worker = new Worker(this.workerScript, { workerData: task.data });
    this.#workers.push(worker);

    worker.on('message', (result) => {
      task.resolve(result);
      this.#workers = this.#workers.filter(w => w !== worker);
      if (this.#queue.length > 0) {
        this.#runWorker(this.#queue.shift());
      }
    });

    worker.on('error', (err) => {
      task.reject(err);
      this.#workers = this.#workers.filter(w => w !== worker);
    });
  }
}

// Uso
const pool = new WorkerPool('./heavy-computation.js');
const result = await pool.execute({ input: largeData });
```

---

## 6. Connection Management

```javascript
// HTTP client — reusar conexões (keep-alive)
import { Agent } from 'undici'; // Ou http.Agent nativo

const agent = new Agent({
  keepAliveTimeout: 30000,    // Manter conexão por 30s
  keepAliveMaxTimeout: 60000, // Máximo 60s
  pipelining: 1,              // HTTP pipelining
  connections: 20,            // Pool de 20 conexões por host
});

// Toda chamada fetch reusa o pool
const response = await fetch(url, { dispatcher: agent });

// Database — pool configuration
// Ver database-performance.md para detalhes
```

---

## 7. Checklist de Otimização Backend

```
Quick wins (fazer primeiro):
☐ I/O paralelo com Promise.all onde possível
☐ N+1 queries corrigidos (include/join/DataLoader)
☐ Fire-and-forget para tarefas não-críticas (email, log, analytics)
☐ SELECT apenas campos necessários (não SELECT *)
☐ Paginação em toda listagem
☐ Compression (gzip/brotli) habilitado
☐ Connection keep-alive em HTTP clients

Médio esforço:
☐ Cache Redis para queries pesadas/frequentes
☐ Índices nas queries mais executadas
☐ Batch writes ao invés de insert individual
☐ DataLoader para resolver N+1 complexos
☐ Fast JSON serializer para payloads grandes
☐ Queue para trabalho pesado (email, PDF, resize)

Alto esforço:
☐ Worker threads para CPU-bound
☐ Streaming para exports/downloads grandes
☐ Read replicas para separar read/write load
☐ Caching layer com invalidação inteligente
☐ Connection pooling com pgbouncer
```
