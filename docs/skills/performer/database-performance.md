# Database Performance — EXPLAIN, Indexing, Queries, Pool

## Índice
1. EXPLAIN ANALYZE — Guia Completo
2. Indexing Strategies
3. N+1 Detection e Fix
4. Query Optimization Patterns
5. Connection Pool Tuning
6. Monitoring e pg_stat_statements
7. Advanced: Materialized Views e Partitioning

---

## 1. EXPLAIN ANALYZE — Guia Completo

```sql
-- EXPLAIN: mostra o PLANO (estimado)
-- EXPLAIN ANALYZE: mostra plano + EXECUÇÃO REAL (cuidado em prod — executa a query!)
-- EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT): inclui I/O de disco

EXPLAIN (ANALYZE, BUFFERS)
SELECT o.id, o.status, o.total, u.name
FROM orders o
JOIN users u ON u.id = o.user_id
WHERE o.status = 'pending'
  AND o.created_at > '2025-01-01'
ORDER BY o.created_at DESC
LIMIT 20;
```

### Operações e o que significam

```
Seq Scan          → Full table scan (lê TODA a tabela). Problema em tabelas grandes.
Index Scan        → Usa índice para encontrar rows. BOM.
Index Only Scan   → Dados vêm direto do índice sem ir na tabela. ÓTIMO.
Bitmap Index Scan → Usa índice para bitmap, depois busca na tabela. BOM para muitas rows.
Nested Loop       → Para cada row da tabela A, busca na tabela B. BOM se B é pequena/indexada.
Hash Join         → Cria hash de uma tabela, busca na outra. BOM para tabelas grandes.
Merge Join        → Junta tabelas já ordenadas. BOM quando ambas estão indexadas.
Sort              → Ordena resultado. Se "Sort Method: external merge Disk" → work_mem baixo.
Materialize       → Armazena resultado temporário em memória/disco.
```

### Red Flags no EXPLAIN

```
🔴 Seq Scan em tabela > 10K rows
   → Criar índice no(s) campo(s) do WHERE

🔴 actual rows >> estimated rows (ex: estimated 10, actual 50000)
   → Estatísticas desatualizadas → ANALYZE tabela;

🔴 Sort Method: external merge Disk
   → Sorting em disco (lento!) → Aumentar work_mem ou criar índice ordenado

🔴 Nested Loop com tabela grande no inner loop
   → Deveria ser Hash Join → Verificar índice na condição de JOIN

🔴 Rows Removed by Filter: número muito grande
   → Leu muitas rows para descartar → Índice mais seletivo

🔴 Buffers: shared read muito alto (vs shared hit)
   → Dados não estão em cache → Aumentar shared_buffers ou índice melhor
```

---

## 2. Indexing Strategies

### Tipos de índice PostgreSQL

```sql
-- B-tree (default, 95% dos casos)
CREATE INDEX idx_orders_status ON orders(status);
-- Bom para: =, <, >, <=, >=, BETWEEN, IN, IS NULL, ORDER BY

-- Composite (multi-column) — ORDEM IMPORTA!
CREATE INDEX idx_orders_user_created ON orders(user_id, created_at DESC);
-- Regra: campos de IGUALDADE primeiro, depois RANGE/ORDER
-- Usa para: WHERE user_id = 'x' ORDER BY created_at DESC ✅
-- NÃO usa para: WHERE created_at > '2025-01-01' (user_id não está no WHERE) ❌

-- Partial index (índice apenas em subset da tabela)
CREATE INDEX idx_orders_pending ON orders(created_at DESC)
WHERE status = 'pending';
-- Menor que índice full, mais rápido. Ideal para queries frequentes com filtro fixo.

-- Covering index (include — dados extras sem ir na tabela)
CREATE INDEX idx_orders_covering ON orders(user_id, status)
INCLUDE (total, created_at);
-- Index Only Scan: dados vêm direto do índice, sem disk lookup na tabela

-- GIN (Generalized Inverted Index — full text, JSON, arrays)
CREATE INDEX idx_products_search ON products USING gin(to_tsvector('portuguese', name || ' ' || description));
-- Para: Full text search

-- GiST (geoespacial, ranges)
CREATE INDEX idx_locations_geo ON locations USING gist(coordinates);
```

### Quando criar (e quando NÃO)

```
CRIAR índice quando:
├── Query no slow query log (> 100ms)
├── Seq Scan em tabela > 10K rows no EXPLAIN
├── Campo usado em WHERE/JOIN/ORDER BY frequentemente
├── Selectividade alta (campo distingue muitas rows)
└── Query é executada muitas vezes (pg_stat_statements)

NÃO criar quando:
├── Tabela pequena (< 1K rows) — Seq Scan é mais rápido
├── Campo com baixa cardinalidade (boolean, status com 3 valores)
│   Exceção: partial index se filtra por 1 valor específico
├── Tabela com muito INSERT/UPDATE (cada índice desacelera writes)
├── Query executada raramente (cost do índice > benefício)
└── Índice duplicado (outro índice já cobre essa query)

Monitorar índices não usados:
SELECT indexrelname, idx_scan FROM pg_stat_user_indexes
WHERE idx_scan = 0 AND indexrelname NOT LIKE 'pg_%'
ORDER BY pg_relation_size(indexrelid) DESC;
-- Índices com idx_scan = 0 são candidatos a remoção
```

---

## 3. N+1 Detection e Fix

### Detectar

```javascript
// Prisma — log query count
const prisma = new PrismaClient({ log: [{ level: 'query', emit: 'event' }] });

let queryCount = 0;
prisma.$on('query', () => queryCount++);

app.use((req, res, next) => {
  queryCount = 0;
  res.on('finish', () => {
    if (queryCount > 10) {
      logger.warn('Possible N+1', { path: req.path, queries: queryCount });
    }
  });
  next();
});
```

```sql
-- PostgreSQL: queries mais executadas
SELECT query, calls, mean_exec_time, total_exec_time
FROM pg_stat_statements
ORDER BY calls DESC LIMIT 20;
-- Se a mesma SELECT WHERE id = $1 aparece 10.000x → N+1
```

### Fix patterns

```javascript
// Pattern 1: Include (Prisma) / eager loading
const orders = await prisma.order.findMany({
  where: { userId },
  include: {
    items: { include: { product: true } },  // JOIN, não N+1
    user: { select: { name: true } },
  },
  take: 20,
});

// Pattern 2: DataLoader (batch individual queries)
// Ver backend-performance.md seção 4

// Pattern 3: Raw JOIN quando ORM não otimiza
const orders = await prisma.$queryRaw`
  SELECT o.*, json_agg(oi.*) as items
  FROM orders o
  LEFT JOIN order_items oi ON oi.order_id = o.id
  WHERE o.user_id = ${userId}
  GROUP BY o.id
  ORDER BY o.created_at DESC
  LIMIT 20
`;
```

---

## 4. Query Optimization Patterns

### Paginação eficiente

```sql
-- ❌ OFFSET pagination (lento em páginas altas)
SELECT * FROM orders ORDER BY created_at DESC LIMIT 20 OFFSET 10000;
-- PostgreSQL PRECISA ler e descartar 10.000 rows!

-- ✅ Cursor pagination (constante em qualquer página)
SELECT * FROM orders
WHERE created_at < '2025-02-15T10:30:00Z'  -- Cursor: último item da página anterior
ORDER BY created_at DESC
LIMIT 20;
-- Usa índice, sempre rápido.
```

### Evitar SELECT *

```sql
-- ❌ Traz 50 colunas quando precisa de 5
SELECT * FROM orders WHERE user_id = $1;

-- ✅ Apenas o necessário
SELECT id, status, total, created_at FROM orders WHERE user_id = $1;
-- Menos I/O, menos memória, serialização mais rápida
-- Com covering index: pode virar Index Only Scan
```

### COUNT eficiente

```sql
-- ❌ COUNT(*) em tabela grande (full scan ou index scan lento)
SELECT COUNT(*) FROM orders WHERE status = 'pending';
-- Em tabela de 1M rows: ~200ms

-- ✅ Estimativa rápida (para "Total: ~15.000 resultados")
SELECT reltuples::bigint FROM pg_class WHERE relname = 'orders';
-- ~0ms (estatística, não exata)

-- ✅ COUNT com LIMIT (só preciso saber se tem mais)
SELECT EXISTS(SELECT 1 FROM orders WHERE user_id = $1 LIMIT 1);
-- Em vez de COUNT(*) para verificar se existe, use EXISTS
```

---

## 5. Connection Pool Tuning

```
Regra de ouro: max_connections = (CPU cores × 2) + discos
Para SSD: ~20-30 conexões por instância é geralmente ótimo.
MAIS conexões ≠ mais performance (context switching, lock contention).
```

```javascript
// Prisma — connection pool
// schema.prisma
// url = "postgresql://user:pass@host/db?connection_limit=20&pool_timeout=10"

// pg (driver nativo)
const pool = new Pool({
  max: 20,                       // Máximo de conexões
  idleTimeoutMillis: 30000,      // Fechar idle após 30s
  connectionTimeoutMillis: 5000, // Timeout para obter conexão
  allowExitOnIdle: true,
});

// Monitorar pool
setInterval(() => {
  logger.info('Pool stats', {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount, // Se > 0 frequentemente → aumentar max
  });
}, 60000);
```

```
Diagnóstico de pool:
├── waitingCount > 0 frequentemente → pool pequeno OU queries lentas segurando conexão
├── totalCount = max constantemente → pool esgotado, queries acumulando
├── idleCount = max sempre → pool grande demais (desperdício)
└── connectionTimeoutMillis atingido → queries lentas ou pool muito pequeno

pgBouncer (connection pooler externo):
├── App abre 100 conexões → pgBouncer roteia para 20 no banco
├── Overhead mínimo (~1ms por query)
├── Essencial para: serverless, muitas instâncias da app, muitas conexões
└── Mode: transaction (recomendado) — conexão retorna ao pool após cada transação
```

---

## 6. Monitoring e pg_stat_statements

```sql
-- Habilitar pg_stat_statements (adicionar ao postgresql.conf)
-- shared_preload_libraries = 'pg_stat_statements'

-- Top 10 queries por tempo total
SELECT query,
       calls,
       round(total_exec_time::numeric, 2) as total_ms,
       round(mean_exec_time::numeric, 2) as mean_ms,
       round((100 * total_exec_time / sum(total_exec_time) OVER())::numeric, 2) as pct
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 10;

-- Top 10 queries mais lentas (por execução)
SELECT query, calls, round(mean_exec_time::numeric, 2) as mean_ms,
       round(max_exec_time::numeric, 2) as max_ms
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Tabelas mais acessadas
SELECT relname, seq_scan, idx_scan,
       round(100.0 * idx_scan / (seq_scan + idx_scan), 1) as idx_pct
FROM pg_stat_user_tables
WHERE seq_scan + idx_scan > 0
ORDER BY seq_scan DESC;
-- Se idx_pct < 90% → considerar índices

-- Cache hit ratio (deveria ser > 99%)
SELECT round(100.0 * sum(blks_hit) / sum(blks_hit + blks_read), 2) as cache_hit_pct
FROM pg_stat_database WHERE datname = current_database();
```

---

## 7. Advanced: Materialized Views e Partitioning

### Materialized Views

```sql
-- Para queries de relatório/dashboard que são pesadas mas dados mudam pouco
CREATE MATERIALIZED VIEW mv_daily_sales AS
SELECT
  date_trunc('day', created_at) as day,
  COUNT(*) as total_orders,
  SUM(total) as revenue,
  AVG(total) as avg_order_value
FROM orders
WHERE status = 'paid'
GROUP BY 1
ORDER BY 1 DESC;

-- Criar índice na materialized view
CREATE INDEX idx_mv_daily_sales_day ON mv_daily_sales(day);

-- Refresh (pode ser via cron job)
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_sales;
-- CONCURRENTLY: não bloqueia leituras durante refresh (requer unique index)
```

### Table Partitioning

```sql
-- Para tabelas muito grandes (>50M rows), particionar por range
CREATE TABLE orders (
  id UUID PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL,
  total BIGINT NOT NULL
) PARTITION BY RANGE (created_at);

-- Partições por mês
CREATE TABLE orders_2025_01 PARTITION OF orders
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
CREATE TABLE orders_2025_02 PARTITION OF orders
  FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');

-- PostgreSQL automaticamente roteia queries para a partição correta
-- WHERE created_at BETWEEN '2025-01-15' AND '2025-01-31'
-- → Acessa APENAS orders_2025_01 (partition pruning)
```
