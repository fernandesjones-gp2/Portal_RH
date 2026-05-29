# EXPLAIN Plans Guide — Como Ler e Interpretar

## Índice
1. Anatomia do EXPLAIN
2. Node Types (Operações)
3. Como Ler o Output
4. Red Flags (Sinais de Problema)
5. Exemplos Reais com Diagnóstico
6. MySQL EXPLAIN

---

## 1. Anatomia do EXPLAIN

### Sempre usar EXPLAIN completo

```sql
-- ❌ Insuficiente (mostra estimativa, não realidade)
EXPLAIN SELECT ...;

-- ✅ Correto (executa de verdade e mostra tempos reais)
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) SELECT ...;

-- ✅ Para queries que MODIFICAM dados (não executar o write)
BEGIN;
EXPLAIN (ANALYZE, BUFFERS) UPDATE orders SET status = 'cancelled' WHERE ...;
ROLLBACK;
```

### Campos do output

```
Seq Scan on orders  (cost=0.00..1542.00 rows=100 width=64) (actual time=0.012..12.345 rows=87 loops=1)
│                    │         │          │     │             │              │         │        │
│                    │         │          │     │             │              │         │        └── Vezes que executou
│                    │         │          │     │             │              │         └── Rows reais retornadas
│                    │         │          │     │             │              └── Tempo real (primeiro..último row)
│                    │         │          │     │             └── Tempo real de início
│                    │         │          │     └── Largura média por row (bytes)
│                    │         │          └── Rows ESTIMADAS
│                    │         └── Custo total estimado
│                    └── Custo de startup estimado
└── Tipo de operação (node type)
```

**Custo** = unidades arbitrárias (não são ms). Útil para comparar planos.
**Actual time** = milissegundos reais. É o que importa.
**Rows estimadas vs reais** = se muito diferentes, estatísticas estão ruins → `ANALYZE`.

---

## 2. Node Types (Operações)

### Scans (acesso a dados)

| Node | O que faz | Bom ou ruim? |
|------|----------|-------------|
| **Seq Scan** | Lê tabela inteira, linha por linha | 🔴 Ruim em tabelas grandes. OK se tabela é pequena ou retorna >5-10% dos rows |
| **Index Scan** | Usa índice para localizar rows, volta na tabela para dados | 🟢 Bom para poucos rows |
| **Index Only Scan** | Usa APENAS o índice (covering index) | 🟢🟢 Melhor cenário — não toca na tabela |
| **Bitmap Index Scan** | Usa índice para criar bitmap, depois faz Bitmap Heap Scan | 🟡 OK para volume médio de rows |
| **Bitmap Heap Scan** | Lê as páginas marcadas pelo bitmap | 🟡 Complemento do Bitmap Index Scan |

### Joins

| Node | O que faz | Quando |
|------|----------|--------|
| **Nested Loop** | Para cada row de A, busca match em B | 🟢 Bom quando inner table é pequena ou tem índice |
| **Hash Join** | Constrói hash table de uma side, probes com outra | 🟢 Bom para tabelas médias/grandes |
| **Merge Join** | Merge de duas sides já ordenadas | 🟢 Bom quando ambos lados já estão ordenados |

### Agregação e Sort

| Node | O que faz | Atenção |
|------|----------|---------|
| **Sort** | Ordena rows | 🔴 Se `Sort Method: external merge Disk` → work_mem baixo |
| **HashAggregate** | GROUP BY via hash table | 🟡 Pode usar memória |
| **GroupAggregate** | GROUP BY em dados já ordenados | 🟢 Eficiente se dados já estão sorted |
| **Limit** | Retorna N primeiros rows | 🟢 Pode short-circuit operação |

### Outros

| Node | O que faz |
|------|----------|
| **Materialize** | Armazena resultado em memória para reusar |
| **Subquery Scan** | Wrapper para subquery |
| **CTE Scan** | Leitura de CTE (WITH) |
| **Append** | Union de múltiplos resultados |

---

## 3. Como Ler o Output

### Regras de leitura

```
1. Ler de DENTRO para FORA (nó mais indentado primeiro)
2. Nós filhos alimentam o nó pai
3. O tempo do pai INCLUI o tempo dos filhos
4. "actual time" do nó mais externo = tempo total da query
5. Foco em: nós com mais tempo, scans em tabelas grandes, rows estimados vs reais
```

### Exemplo com anotações

```
Limit  (cost=0.56..45.23 rows=20 width=64) (actual time=0.123..2.456 rows=20 loops=1)
  ──────── TOTAL: 2.4ms. Bom.

  ->  Nested Loop  (cost=0.56..44522.33 rows=20000 width=64) (actual time=0.120..2.440 rows=20 loops=1)
        ──────── Nested Loop + Limit = só processou 20 rows. Eficiente.

        ->  Index Scan Backward using orders_created_at_idx on orders o
              (cost=0.29..1234.56 rows=500 width=32) (actual time=0.050..0.890 rows=20 loops=1)
              Filter: (status = 'pending')
              Rows Removed by Filter: 30
              ──────── Index scan OK. Filtro removeu 30 rows (60% das lidas). Possível melhoria:
              ──────── Índice composto (status, created_at DESC) eliminaria o filtro.

        ->  Index Scan using users_pkey on users u
              (cost=0.28..0.30 rows=1 width=32) (actual time=0.005..0.006 rows=1 loops=20)
              ──────── PK lookup, 0.006ms × 20 loops = 0.12ms total. Perfeito.

Planning Time: 0.234 ms
Execution Time: 2.567 ms
  ──────── Total real: 2.5ms. Query saudável.

Buffers: shared hit=89
  ──────── 89 páginas de cache. Zero reads de disco. Cache hit 100%. Excelente.
```

---

## 4. Red Flags (Sinais de Problema)

### 🔴 Seq Scan em tabela grande

```
Seq Scan on orders  (rows=2000000)
```
**Diagnóstico**: Falta índice para o filtro/join usado.
**Fix**: Criar índice nos campos do WHERE/JOIN.

### 🔴 Rows estimados ≠ rows reais (10x+ diferença)

```
Index Scan ... (rows=10) (actual ... rows=50000)
```
**Diagnóstico**: Estatísticas desatualizadas. Planner faz escolha errada.
**Fix**: `ANALYZE tabela;` ou aumentar `default_statistics_target`.

### 🔴 Sort com external merge (spill to disk)

```
Sort Method: external merge  Disk: 45632kB
```
**Diagnóstico**: `work_mem` insuficiente para o sort.
**Fix**: `SET work_mem = '256MB';` (para a sessão) ou ajustar em `postgresql.conf`.

### 🔴 Nested Loop com tabela grande no inner side

```
Nested Loop  (actual time=0.1..15000.0 rows=100000 loops=1)
  ->  Seq Scan on big_table  (rows=100000 loops=1)   ← outer
  ->  Index Scan on small_table  (rows=1 loops=100000) ← inner, 100K lookups
```
**Diagnóstico**: 100K index lookups. Se inner table não tem índice, é O(n²).
**Fix**: Hash Join pode ser melhor. Verificar se inner tem índice.

### 🔴 High buffer reads (I/O)

```
Buffers: shared hit=12 read=45000
```
**Diagnóstico**: 45K páginas lidas do disco (não do cache). Muito I/O.
**Fix**: Aumentar `shared_buffers`. Ou query lê dados demais (melhorar filtro).

### 🟡 Filter com muitos Rows Removed

```
Index Scan ... (actual rows=10)
  Filter: (status = 'active')
  Rows Removed by Filter: 99990
```
**Diagnóstico**: Índice traz 100K rows, filtro descarta 99.99%. Índice errado.
**Fix**: Índice composto que inclua o campo do filtro, ou índice parcial.

---

## 5. Exemplos Reais com Diagnóstico

### Caso 1: Query de listagem sem índice

```sql
-- Query
SELECT * FROM orders WHERE user_id = 123 ORDER BY created_at DESC LIMIT 20;

-- EXPLAIN (ruim)
Limit
  ->  Sort (Sort Method: top-N heapsort Memory: 30kB)
        ->  Seq Scan on orders  (actual rows=500000)
              Filter: (user_id = 123)
              Rows Removed by Filter: 499500
-- Execution Time: 2300ms

-- FIX: Índice composto
CREATE INDEX idx_orders_user_created ON orders (user_id, created_at DESC);

-- EXPLAIN (bom)
Limit
  ->  Index Scan using idx_orders_user_created on orders (actual rows=20)
-- Execution Time: 0.5ms
```

### Caso 2: N+1 do ORM

```sql
-- ORM gera:
SELECT * FROM orders WHERE id = 1;
SELECT * FROM users WHERE id = 10;  -- Para cada order
SELECT * FROM users WHERE id = 11;
SELECT * FROM users WHERE id = 12;
-- ... 100 queries separadas

-- FIX: Eager loading / JOIN
SELECT o.*, u.name FROM orders o JOIN users u ON u.id = o.user_id WHERE ...;
```

### Caso 3: COUNT(*) lento em tabela grande

```sql
-- Lento (seq scan em 10M rows)
SELECT COUNT(*) FROM events WHERE created_at > '2025-01-01';
-- Execution Time: 3500ms

-- FIX 1: Índice BRIN (melhor para colunas com correlação temporal)
CREATE INDEX idx_events_created_brin ON events USING BRIN (created_at);
-- Execution Time: 45ms

-- FIX 2: Materialized view para dashboards
CREATE MATERIALIZED VIEW event_counts AS
SELECT date_trunc('day', created_at) AS day, COUNT(*) AS count
FROM events GROUP BY 1;
-- Refresh periódico via cron
```

---

## 6. MySQL EXPLAIN

### Formato

```sql
EXPLAIN ANALYZE SELECT * FROM orders WHERE user_id = 123;

-- Ou formato tabular (mais detalhado)
EXPLAIN FORMAT=JSON SELECT ...;
```

### Campos importantes (MySQL)

| Campo | Significado | Red flag |
|-------|-----------|----------|
| `type` | Tipo de acesso | `ALL` = full table scan 🔴 |
| `possible_keys` | Índices candidatos | `NULL` = nenhum índice possível 🔴 |
| `key` | Índice usado | `NULL` = nenhum usado 🔴 |
| `rows` | Rows estimadas | Valor alto = muitas rows lidas |
| `Extra` | Info extra | `Using filesort` 🟡, `Using temporary` 🔴 |

### Type ranking (melhor → pior)

```
system > const > eq_ref > ref > range > index > ALL
  🟢       🟢      🟢      🟢     🟡      🟡    🔴
```
