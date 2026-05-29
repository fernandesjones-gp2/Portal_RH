# Diagnostic Toolkit — Queries de Investigação

## Índice
1. Setup Inicial (pg_stat_statements)
2. Identificar Queries Lentas
3. Investigar Conexões
4. Investigar Locks e Deadlocks
5. Investigar Tabelas e Bloat
6. Investigar Cache e I/O
7. MySQL Equivalents

---

## 1. Setup Inicial

### Habilitar pg_stat_statements (PostgreSQL)

```sql
-- postgresql.conf (requer restart)
shared_preload_libraries = 'pg_stat_statements'
pg_stat_statements.max = 10000
pg_stat_statements.track = all

-- Ou via ALTER SYSTEM (requer restart)
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';

-- Criar a extensão
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Reset stats (para começar limpo)
SELECT pg_stat_statements_reset();
```

### Habilitar slow query log (MySQL)

```ini
# my.cnf
[mysqld]
slow_query_log = 1
slow_query_log_file = /var/log/mysql/slow.log
long_query_time = 1    # Queries > 1 segundo
log_queries_not_using_indexes = 1
```

---

## 2. Identificar Queries Lentas

### Top queries por tempo total (PostgreSQL)

```sql
-- As queries que MAIS consomem tempo no total (frequência × duração)
SELECT
  LEFT(query, 100) AS query_preview,
  calls,
  round(total_exec_time::numeric, 1) AS total_ms,
  round(mean_exec_time::numeric, 1) AS avg_ms,
  round(min_exec_time::numeric, 1) AS min_ms,
  round(max_exec_time::numeric, 1) AS max_ms,
  round(stddev_exec_time::numeric, 1) AS stddev_ms,
  rows AS total_rows,
  round((rows::numeric / NULLIF(calls, 0)), 1) AS avg_rows,
  round((100 * total_exec_time / sum(total_exec_time) OVER ())::numeric, 2) AS pct_total
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat%'
ORDER BY total_exec_time DESC
LIMIT 20;
```

### Top queries por tempo médio (as mais lentas individualmente)

```sql
SELECT
  LEFT(query, 100) AS query_preview,
  calls,
  round(mean_exec_time::numeric, 1) AS avg_ms,
  round(max_exec_time::numeric, 1) AS max_ms,
  rows / NULLIF(calls, 0) AS avg_rows
FROM pg_stat_statements
WHERE calls > 10  -- Ignorar queries raras
  AND query NOT LIKE '%pg_stat%'
ORDER BY mean_exec_time DESC
LIMIT 20;
```

### Queries rodando AGORA (long running)

```sql
SELECT
  pid,
  now() - query_start AS duration,
  state,
  wait_event_type,
  wait_event,
  LEFT(query, 100) AS query_preview
FROM pg_stat_activity
WHERE state != 'idle'
  AND query NOT LIKE '%pg_stat_activity%'
ORDER BY duration DESC;
```

### Matar query travada

```sql
-- Cancelar (gentil — espera transação terminar)
SELECT pg_cancel_backend(<pid>);

-- Terminar (forçado — mata a conexão)
SELECT pg_terminate_backend(<pid>);

-- Matar TODAS queries lentas > 5 minutos
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state != 'idle'
  AND query_start < now() - interval '5 minutes'
  AND pid != pg_backend_pid();
```

---

## 3. Investigar Conexões

### Estado das conexões

```sql
-- Resumo de conexões por estado
SELECT
  state,
  count(*) AS count,
  round(100.0 * count(*) / sum(count(*)) OVER (), 1) AS pct
FROM pg_stat_activity
GROUP BY state
ORDER BY count DESC;

-- Conexões por aplicação/usuário
SELECT
  usename,
  application_name,
  client_addr,
  state,
  count(*)
FROM pg_stat_activity
GROUP BY usename, application_name, client_addr, state
ORDER BY count(*) DESC;

-- Limites
SHOW max_connections;
SELECT count(*) AS current_connections FROM pg_stat_activity;
```

### Diagnosticar connection leaks

```sql
-- Conexões idle há muito tempo (possível leak)
SELECT
  pid,
  usename,
  application_name,
  state,
  now() - state_change AS idle_duration,
  LEFT(query, 80) AS last_query
FROM pg_stat_activity
WHERE state = 'idle'
  AND now() - state_change > interval '10 minutes'
ORDER BY idle_duration DESC;
```

---

## 4. Investigar Locks e Deadlocks

### Locks ativos

```sql
-- Quem está bloqueando quem
SELECT
  blocked.pid AS blocked_pid,
  blocked.query AS blocked_query,
  blocking.pid AS blocking_pid,
  blocking.query AS blocking_query,
  now() - blocked.query_start AS blocked_duration
FROM pg_stat_activity blocked
JOIN pg_locks bl ON bl.pid = blocked.pid
JOIN pg_locks kl ON kl.locktype = bl.locktype
  AND kl.database IS NOT DISTINCT FROM bl.database
  AND kl.relation IS NOT DISTINCT FROM bl.relation
  AND kl.page IS NOT DISTINCT FROM bl.page
  AND kl.tuple IS NOT DISTINCT FROM bl.tuple
  AND kl.transactionid IS NOT DISTINCT FROM bl.transactionid
  AND kl.classid IS NOT DISTINCT FROM bl.classid
  AND kl.objid IS NOT DISTINCT FROM bl.objid
  AND kl.objsubid IS NOT DISTINCT FROM bl.objsubid
  AND kl.pid != bl.pid
JOIN pg_stat_activity blocking ON kl.pid = blocking.pid
WHERE NOT bl.granted;
```

### Lock waits simplificado

```sql
SELECT
  pg_blocking_pids(pid) AS blocked_by,
  pid,
  LEFT(query, 80) AS query,
  wait_event_type,
  wait_event,
  now() - query_start AS duration
FROM pg_stat_activity
WHERE cardinality(pg_blocking_pids(pid)) > 0;
```

### Verificar deadlocks recentes

```sql
-- Checar logs do PostgreSQL para deadlocks
-- Em postgresql.conf:
-- log_lock_waits = on
-- deadlock_timeout = 1s

-- Contagem de deadlocks desde último reset
SELECT deadlocks FROM pg_stat_database WHERE datname = current_database();
```

---

## 5. Investigar Tabelas e Bloat

### Tabelas maiores

```sql
SELECT
  schemaname,
  relname AS table_name,
  pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
  pg_size_pretty(pg_relation_size(relid)) AS table_size,
  pg_size_pretty(pg_indexes_size(relid)) AS index_size,
  n_live_tup AS live_rows,
  n_dead_tup AS dead_rows,
  round(n_dead_tup::numeric / NULLIF(n_live_tup + n_dead_tup, 0) * 100, 1) AS dead_pct,
  last_vacuum,
  last_autovacuum,
  last_analyze,
  last_autoanalyze
FROM pg_stat_user_tables
ORDER BY pg_total_relation_size(relid) DESC
LIMIT 20;
```

### Tabelas que precisam de VACUUM

```sql
-- Tabelas com mais dead tuples (bloat)
SELECT
  schemaname || '.' || relname AS table_name,
  n_dead_tup AS dead_tuples,
  n_live_tup AS live_tuples,
  round(n_dead_tup::numeric / NULLIF(n_live_tup, 0) * 100, 1) AS dead_pct,
  last_autovacuum
FROM pg_stat_user_tables
WHERE n_dead_tup > 10000
ORDER BY n_dead_tup DESC;
```

### Tabelas que precisam de ANALYZE (estatísticas desatualizadas)

```sql
SELECT
  schemaname || '.' || relname AS table_name,
  n_mod_since_analyze AS modifications_since_analyze,
  last_analyze,
  last_autoanalyze
FROM pg_stat_user_tables
WHERE n_mod_since_analyze > 10000
ORDER BY n_mod_since_analyze DESC;
```

### Seq Scans vs Index Scans (tabelas sem índice útil)

```sql
SELECT
  schemaname || '.' || relname AS table_name,
  seq_scan,
  idx_scan,
  CASE WHEN seq_scan + idx_scan > 0
    THEN round(100.0 * seq_scan / (seq_scan + idx_scan), 1)
    ELSE 0
  END AS pct_seq_scan,
  pg_size_pretty(pg_relation_size(relid)) AS size,
  n_live_tup AS rows
FROM pg_stat_user_tables
WHERE seq_scan > 0
  AND n_live_tup > 10000  -- Ignorar tabelas pequenas
ORDER BY seq_scan DESC
LIMIT 20;
```

---

## 6. Investigar Cache e I/O

### Cache hit ratio (deve ser > 99%)

```sql
SELECT
  sum(heap_blks_read) AS heap_read,
  sum(heap_blks_hit) AS heap_hit,
  round(
    sum(heap_blks_hit)::numeric /
    NULLIF(sum(heap_blks_hit) + sum(heap_blks_read), 0) * 100, 2
  ) AS cache_hit_ratio
FROM pg_statio_user_tables;

-- Por tabela
SELECT
  relname,
  heap_blks_read,
  heap_blks_hit,
  round(
    heap_blks_hit::numeric /
    NULLIF(heap_blks_hit + heap_blks_read, 0) * 100, 2
  ) AS hit_ratio
FROM pg_statio_user_tables
WHERE heap_blks_read > 0
ORDER BY heap_blks_read DESC
LIMIT 20;
```

### Index usage ratio

```sql
SELECT
  indexrelname AS index_name,
  relname AS table_name,
  idx_scan AS scans,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
ORDER BY idx_scan ASC  -- Índices MENOS usados primeiro (candidatos a remoção)
LIMIT 20;
```

### Índices não utilizados (candidatos a remoção)

```sql
SELECT
  schemaname || '.' || relname AS table_name,
  indexrelname AS index_name,
  idx_scan AS times_used,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND indexrelname NOT LIKE '%pkey%'  -- Manter PKs
  AND indexrelname NOT LIKE '%unique%'  -- Manter UNIQUEs
ORDER BY pg_relation_size(indexrelid) DESC;
```

---

## 7. MySQL Equivalents

### Queries lentas

```sql
-- MySQL: Queries rodando agora
SHOW FULL PROCESSLIST;

-- MySQL: Performance Schema (equivalente a pg_stat_statements)
SELECT
  DIGEST_TEXT AS query,
  COUNT_STAR AS calls,
  ROUND(AVG_TIMER_WAIT / 1000000000, 2) AS avg_ms,
  ROUND(SUM_TIMER_WAIT / 1000000000, 2) AS total_ms
FROM performance_schema.events_statements_summary_by_digest
ORDER BY SUM_TIMER_WAIT DESC
LIMIT 20;
```

### Tabelas e índices (MySQL)

```sql
-- Tamanho das tabelas
SELECT
  table_name,
  ROUND(data_length / 1024 / 1024, 2) AS data_mb,
  ROUND(index_length / 1024 / 1024, 2) AS index_mb,
  table_rows
FROM information_schema.tables
WHERE table_schema = DATABASE()
ORDER BY data_length + index_length DESC;

-- Índices não usados (MySQL 8.0+)
SELECT * FROM sys.schema_unused_indexes
WHERE object_schema = DATABASE();
```
