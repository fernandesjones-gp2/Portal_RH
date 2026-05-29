# Performance Debugging — Queries, Profiling, Bottlenecks

## Índice
1. Metodologia de Performance Debugging
2. Slow Queries e EXPLAIN ANALYZE
3. N+1 Problem
4. CPU Profiling e Flame Graphs
5. Connection Pool Issues
6. Frontend Performance
7. Checklist de Performance por Camada

---

## 1. Metodologia de Performance Debugging

```
Passo 1: MEDIR antes de otimizar
  "O endpoint está lento" → Quanto lento? Qual percentil?
  p50 = 200ms, p95 = 2000ms → O problema é nos outliers, não na mediana

Passo 2: LOCALIZAR o gargalo
  Request → Middleware → Controller → Service → DB → Response
  Onde o tempo é gasto? Adicionar timing em cada camada.

Passo 3: DIAGNOSTICAR a causa
  É CPU-bound? (cálculo pesado, serialização, bcrypt)
  É I/O-bound? (query lenta, API externa, filesystem)
  É memória? (GC pause, swap)
  É rede? (latência, DNS, TLS handshake)

Passo 4: OTIMIZAR o gargalo específico
  NÃO otimizar "por intuição". MEDIR → ENCONTRAR → CORRIGIR → MEDIR de novo.
```

```javascript
// Timing rápido para localizar gargalo
async function handleRequest(req, res) {
  const t = {};
  t.start = Date.now();

  const validated = validate(req.body);
  t.validate = Date.now();

  const user = await userRepo.findById(req.userId);
  t.getUser = Date.now();

  const order = await orderService.create(validated, user);
  t.createOrder = Date.now();

  await emailService.sendConfirmation(user.email, order);
  t.sendEmail = Date.now();

  logger.info('Request timing', {
    requestId: req.id,
    validate: t.validate - t.start,       // ms
    getUser: t.getUser - t.validate,       // ms
    createOrder: t.createOrder - t.getUser, // ms
    sendEmail: t.sendEmail - t.createOrder, // ms
    total: t.sendEmail - t.start,           // ms
  });

  res.json(order);
}
// Output: { validate: 2, getUser: 5, createOrder: 1200, sendEmail: 800, total: 2007 }
// Diagnóstico: createOrder + sendEmail = 2s. Investigar esses dois.
```

---

## 2. Slow Queries e EXPLAIN ANALYZE

### PostgreSQL — EXPLAIN ANALYZE

```sql
-- EXPLAIN mostra o PLANO. EXPLAIN ANALYZE mostra plano + EXECUÇÃO REAL.
EXPLAIN ANALYZE
SELECT o.*, u.name
FROM orders o
JOIN users u ON u.id = o.user_id
WHERE o.status = 'pending'
AND o.created_at > '2025-01-01'
ORDER BY o.created_at DESC
LIMIT 20;

-- Output (exemplo):
-- Limit (cost=0.43..15.32 rows=20 width=412) (actual time=0.05..1245.32 rows=20 loops=1)
--   → Sort (cost=10000.00..10250.00 rows=50000 width=412) (actual time=1200.00..1245.00 ...)
--     Sort Key: o.created_at DESC
--     Sort Method: external merge Disk: 15000kB     ← SORTING EM DISCO!
--     → Hash Join (cost=... rows=50000 ...)
--       → Seq Scan on orders o (cost=0..8500 rows=50000)   ← FULL TABLE SCAN!
--         Filter: (status = 'pending' AND created_at > '2025-01-01')
--         Rows Removed by Filter: 450000                    ← Filtrou 450K rows!
```

### Red Flags no EXPLAIN

```
🔴 Seq Scan em tabela grande → Falta INDEX
🔴 Rows Removed by Filter: número grande → Índice ineficaz ou ausente
🔴 Sort Method: external merge Disk → Memória insuficiente para sort → work_mem
🔴 Nested Loop com tabela grande → Deveria ser Hash Join ou Merge Join
🔴 actual rows >> estimated rows → Estatísticas desatualizadas → ANALYZE
🔴 actual time muito maior que cost estimado → Problema de I/O ou lock wait
```

### Fixes comuns

```sql
-- Fix 1: Índice para filtros frequentes
CREATE INDEX idx_orders_status_created ON orders(status, created_at DESC);

-- Fix 2: Índice parcial (menor, mais rápido)
CREATE INDEX idx_orders_pending ON orders(created_at DESC)
WHERE status = 'pending';

-- Fix 3: Covering index (evita ir na tabela)
CREATE INDEX idx_orders_covering ON orders(status, created_at DESC)
INCLUDE (user_id, total);

-- Fix 4: Atualizar estatísticas
ANALYZE orders;

-- Fix 5: Aumentar work_mem para sorts grandes
SET work_mem = '256MB'; -- Temporário, para a sessão
-- Ou no postgresql.conf para global (cuidado com concorrência × work_mem)
```

### Habilitar slow query log

```sql
-- postgresql.conf
log_min_duration_statement = 1000  -- Logar queries > 1 segundo
-- Ou em runtime:
ALTER SYSTEM SET log_min_duration_statement = 1000;
SELECT pg_reload_conf();
```

---

## 3. N+1 Problem

```
O bug de performance #1 em aplicações com ORM.

Cenário:
  Listar 20 pedidos com nome do cliente.

N+1:
  Query 1: SELECT * FROM orders LIMIT 20                    (1 query)
  Query 2: SELECT * FROM users WHERE id = 'user-1'          (N queries)
  Query 3: SELECT * FROM users WHERE id = 'user-2'
  ... (20 queries)
  Total: 21 queries para algo que deveria ser 1 ou 2.

Com 20 orders → 21 queries → ~100ms
Com 1000 orders → 1001 queries → ~5000ms (catastrófico)
```

### Detecção

```javascript
// Prisma — logging de queries
const prisma = new PrismaClient({
  log: [
    { level: 'query', emit: 'event' },
  ],
});

let queryCount = 0;
prisma.$on('query', () => { queryCount++; });

// No final do request:
logger.info('Query count', { requestId: req.id, queries: queryCount });
// Se queryCount > 10 para uma listagem simples → provavelmente N+1
```

### Fixes

```javascript
// ❌ N+1 — Prisma carrega orders, depois busca user 1 por 1
const orders = await prisma.order.findMany({ take: 20 });
for (const order of orders) {
  order.user = await prisma.user.findUnique({ where: { id: order.userId } });
}

// ✅ FIX — Include (eager loading)
const orders = await prisma.order.findMany({
  take: 20,
  include: { user: { select: { id: true, name: true, email: true } } },
});
// Prisma gera: SELECT orders + SELECT users WHERE id IN (...)
// 2 queries, não 21.

// ✅ FIX alternativo — JOIN manual
const orders = await prisma.$queryRaw`
  SELECT o.*, u.name as user_name
  FROM orders o
  JOIN users u ON u.id = o.user_id
  LIMIT 20
`;
// 1 query.
```

```python
# SQLAlchemy — N+1

# ❌ Lazy loading (default) → N+1
orders = session.query(Order).limit(20).all()
for order in orders:
    print(order.user.name)  # Cada acesso gera 1 query!

# ✅ Eager loading
from sqlalchemy.orm import joinedload
orders = session.query(Order).options(joinedload(Order.user)).limit(20).all()
```

---

## 4. CPU Profiling e Flame Graphs

### Node.js — Profiling

```bash
# Opção 1: --prof (V8 built-in)
node --prof src/server.js
# Gera isolate-0xNNNNN-v8.log
node --prof-process isolate-0xNNNNN-v8.log > profile.txt
# Mostra onde o CPU gasta tempo

# Opção 2: clinic.js (visual)
npx clinic doctor -- node src/server.js
# Rodar carga contra o app
# Gera report HTML com diagnóstico

# Opção 3: 0x (flame graph)
npx 0x src/server.js
# Rodar carga
# Gera flame graph SVG interativo

# Opção 4: Chrome DevTools
node --inspect src/server.js
# Chrome → chrome://inspect → Performance → Record
```

### Lendo um Flame Graph

```
    ┌─────────────────────────────────────────────────────┐
    │                    bcrypt.hash                       │ ← LARGO = muito tempo
    │                    (45% CPU time)                   │
    ├──────────────────────┬──────────────────────────────┤
    │  userService.create  │    orderService.calculateTotal│
    │     (48% CPU)        │         (12% CPU)            │
    ├──────────────────────┴──────────────────────────────┤
    │              express.handleRequest                   │
    └─────────────────────────────────────────────────────┘

Leitura:
- Eixo X = porcentagem do tempo de CPU (NÃO é linha do tempo)
- Eixo Y = call stack (cima chamou baixo)
- LARGURA da barra = tempo gasto nessa função
- Barras LARGAS no topo = candidatas a otimização

Diagnóstico: bcrypt.hash consome 45% do CPU
Fix: Se precisa de bcrypt, não tem muito o que fazer (é lento por design).
     Se está hash-ando em cada request, considerar cache ou async worker.
```

---

## 5. Connection Pool Issues

```
Sintomas:
├── Requests demoram para começar (esperam conexão disponível)
├── "Cannot acquire connection" / timeout
├── Pico de conexões durante carga (pgbouncer, pg_stat_activity)
├── Queries rápidas mas responses lentas (bottleneck no pool)
└── Depois de N requests simultâneos, tudo trava

Diagnóstico:
```

```sql
-- PostgreSQL: ver conexões ativas
SELECT state, count(*), avg(now() - state_change) as avg_duration
FROM pg_stat_activity
WHERE datname = 'mydb'
GROUP BY state;

-- Ver queries lentas rodando agora
SELECT pid, now() - query_start AS duration, query, state
FROM pg_stat_activity
WHERE state != 'idle'
ORDER BY duration DESC;
```

```javascript
// Configurar pool adequadamente
const pool = new Pool({
  max: 20,                  // Máximo de conexões (não 100!)
  idleTimeoutMillis: 30000, // Fechar idle após 30s
  connectionTimeoutMillis: 5000, // Timeout para obter conexão
});

// REGRA: max connections = (CPU cores × 2) + disk spindles
// Para SSD: ~20-30 conexões é suficiente para maioria dos apps.
// Mais que isso → filas no banco, lock contention, overhead de context switch
```

---

## 6. Frontend Performance

```
Core Web Vitals:
├── LCP (Largest Contentful Paint) < 2.5s — Conteúdo principal visível
├── FID (First Input Delay) < 100ms — Responde ao primeiro clique
├── CLS (Cumulative Layout Shift) < 0.1 — Não pula na tela

Diagnóstico rápido:
├── Chrome DevTools → Performance → Record → Interagir → Analisar
├── Lighthouse: chrome://lighthouse (ou DevTools → Lighthouse tab)
├── Network tab: Qual recurso demora? Bundle JS grande? Imagens pesadas?
└── React DevTools → Profiler → Quais componentes re-renderizam demais?

Problemas comuns:
├── Bundle JS > 500KB → Code splitting (lazy/Suspense)
├── Imagens sem otimização → WebP, lazy loading, srcset
├── Re-renders desnecessários → React.memo, useMemo, useCallback
├── Layout shift → Dimensões fixas em img/video, skeleton loading
├── Blocking JS → defer/async no script tag
└── Fonts → preload, font-display: swap
```

---

## 7. Checklist de Performance por Camada

```
DATABASE:
☐ Queries têm EXPLAIN ANALYZE aceitável?
☐ Índices nos campos de WHERE, JOIN, ORDER BY?
☐ N+1 queries detectados e corrigidos (eager loading)?
☐ Connection pool configurado adequadamente?
☐ Slow query log habilitado (> 1s)?
☐ VACUUM e ANALYZE rodando periodicamente?

API / BACKEND:
☐ Timing por camada mostra onde o tempo é gasto?
☐ Operações CPU-heavy (bcrypt, JSON parse grande) são async?
☐ Payloads de response são mínimos (SELECT campos, não *)?
☐ Paginação implementada (não retorna tudo)?
☐ Cache para dados que mudam pouco (Redis, in-memory)?
☐ Compressão habilitada (gzip/brotli)?

FRONTEND:
☐ Bundle size < 300KB gzipped?
☐ Code splitting para rotas?
☐ Imagens otimizadas (WebP, lazy loading)?
☐ Core Web Vitals passando?
☐ Sem re-renders desnecessários?

INFRA:
☐ CDN para assets estáticos?
☐ HTTP/2 habilitado?
☐ Keep-alive habilitado?
☐ Monitoring de CPU/memória/disco?
☐ Auto-scaling configurado (se cloud)?
```
