# Monitoring & Tuning — Configuração e Métricas

## Índice
1. PostgreSQL Tuning Essencial
2. MySQL Tuning Essencial
3. Autovacuum (PostgreSQL)
4. Métricas Críticas
5. Alertas de Banco
6. Ferramentas

---

## 1. PostgreSQL Tuning Essencial

### Parâmetros mais impactantes

```ini
# postgresql.conf — Ajustar baseado na máquina

# === MEMÓRIA ===
# shared_buffers: Cache de páginas do PostgreSQL
# Regra: 25% da RAM total (não mais que 8GB em maioria dos casos)
shared_buffers = '4GB'       # Para servidor com 16GB RAM

# effective_cache_size: Estimativa de cache total (PG + OS)
# Regra: 50-75% da RAM total
effective_cache_size = '12GB' # PG estima melhor se pode contar com cache do OS

# work_mem: Memória por operação de sort/hash (POR QUERY, não global)
# Regra: RAM disponível / max_connections / 2-4
# CUIDADO: 256MB × 100 connections = 25GB de RAM possível
work_mem = '64MB'            # Para queries com JOINs e sorts moderados

# maintenance_work_mem: Para VACUUM, CREATE INDEX, ALTER TABLE
maintenance_work_mem = '512MB'

# === DISCO / WAL ===
# wal_buffers: Buffer de Write-Ahead Log
wal_buffers = '64MB'

# checkpoint_completion_target: Espalhar I/O do checkpoint
checkpoint_completion_target = 0.9

# max_wal_size: Quanto WAL acumula antes de forçar checkpoint
max_wal_size = '2GB'

# === QUERY PLANNER ===
# random_page_cost: Custo de random I/O (SSD = 1.1, HDD = 4.0)
random_page_cost = 1.1       # SSD (a maioria hoje)

# effective_io_concurrency: I/O paralelo (SSD = 200, HDD = 2)
effective_io_concurrency = 200

# === CONEXÕES ===
max_connections = 200         # Manter baixo, usar PgBouncer na frente

# === LOGGING ===
log_min_duration_statement = 1000  # Logar queries > 1 segundo
log_lock_waits = on
log_checkpoints = on
log_temp_files = 0                 # Logar qualquer uso de temp files

# === STATISTICS ===
track_activities = on
track_counts = on
track_io_timing = on               # Essencial para EXPLAIN BUFFERS
```

### Tuning por tamanho de servidor

| Parâmetro | 4GB RAM | 16GB RAM | 64GB RAM |
|-----------|---------|----------|----------|
| shared_buffers | 1GB | 4GB | 8GB |
| effective_cache_size | 3GB | 12GB | 48GB |
| work_mem | 16MB | 64MB | 256MB |
| maintenance_work_mem | 256MB | 512MB | 2GB |
| max_connections | 100 | 200 | 300 |
| max_wal_size | 1GB | 2GB | 4GB |

### Ferramenta: PGTune

```
https://pgtune.leopard.in.ua/
Input: RAM, CPU cores, tipo de storage, tipo de app
Output: postgresql.conf otimizado
```

---

## 2. MySQL Tuning Essencial

```ini
# my.cnf
[mysqld]
# === InnoDB (engine padrão) ===
# Buffer pool: cache de dados e índices. O mais importante.
# Regra: 70-80% da RAM total
innodb_buffer_pool_size = 12G    # Para servidor com 16GB

# Buffer pool instances: paralelismo do buffer pool
innodb_buffer_pool_instances = 8  # 1 por GB (até 64)

# Log file size: tamanho do redo log
innodb_log_file_size = 1G
innodb_log_buffer_size = 64M

# I/O threads
innodb_read_io_threads = 8
innodb_write_io_threads = 8

# Flush method (Linux)
innodb_flush_method = O_DIRECT

# === QUERY CACHE (desabilitado no 8.0+) ===
# MySQL 8.0 removeu query cache. Usar Redis/Memcached para caching.

# === CONNECTIONS ===
max_connections = 200
wait_timeout = 600
interactive_timeout = 600

# === LOGGING ===
slow_query_log = 1
long_query_time = 1
log_queries_not_using_indexes = 1
```

---

## 3. Autovacuum (PostgreSQL)

### Por que é crítico

PostgreSQL usa MVCC: UPDATE não modifica a row — cria uma versão nova
e marca a antiga como "dead". VACUUM limpa as dead rows.
Sem VACUUM: tabela cresce infinitamente (bloat), queries ficam lentas,
disco enche, e eventualmente o banco para.

### Tuning do autovacuum

```ini
# postgresql.conf

# Autovacuum ligado (NUNCA desligar)
autovacuum = on

# Quando triggar: quando 20% da tabela tem dead rows (default)
autovacuum_vacuum_scale_factor = 0.1    # Reduzir para 10% (melhor para tabelas grandes)
autovacuum_vacuum_threshold = 50

# Quando triggar ANALYZE
autovacuum_analyze_scale_factor = 0.05  # 5% de mudanças → re-analyze
autovacuum_analyze_threshold = 50

# Performance do autovacuum
autovacuum_vacuum_cost_delay = 2ms      # Pausa entre batches (reduzir = mais rápido)
autovacuum_vacuum_cost_limit = 1000     # Budget por batch (aumentar = mais rápido)

# Workers
autovacuum_max_workers = 4              # Parallelism
```

### Para tabelas high-write (override por tabela)

```sql
-- Tabela de eventos com milhões de inserts/dia
ALTER TABLE events SET (
  autovacuum_vacuum_scale_factor = 0.01,    -- 1% de dead rows → vacuum
  autovacuum_vacuum_cost_delay = 0,          -- Sem pausa
  autovacuum_vacuum_cost_limit = 10000       -- Budget alto
);
```

### VACUUM FULL (reclamar espaço em disco — com downtime)

```sql
-- VACUUM normal: marca espaço como reutilizável (não encolhe o arquivo)
VACUUM orders;

-- VACUUM FULL: reescreve a tabela inteira (LOCK EXCLUSIVO, downtime)
-- Usar apenas quando bloat > 50% e espaço em disco é critical
VACUUM FULL orders;

-- Alternativa sem downtime: pg_repack
-- Instalar extensão e rodar:
-- pg_repack --table orders --no-order
```

---

## 4. Métricas Críticas

### Dashboard mínimo de banco

```
CONNECTIONS
├── Active connections (vs max_connections)
├── Idle connections
├── Waiting connections (bloqueadas por lock)
└── Alerta: > 80% do max_connections

PERFORMANCE
├── Queries per second (TPS)
├── Query duration: p50, p95, p99
├── Rows fetched vs rows returned (eficiência de filtro)
└── Alerta: p95 > 2x do baseline

CACHE
├── Cache hit ratio (deve ser > 99%)
├── Shared buffers usage
├── Temp files created (work_mem insuficiente)
└── Alerta: hit ratio < 95%

STORAGE
├── Database size (total e por tabela)
├── Table bloat (dead tuples)
├── WAL generation rate
├── Disk usage (% do volume)
└── Alerta: disco > 80%, bloat > 30%

REPLICATION (se aplicável)
├── Replication lag (seconds)
├── WAL sender state
└── Alerta: lag > 30 segundos

LOCKS
├── Lock waits
├── Deadlocks (counter)
├── Longest running transaction
└── Alerta: deadlocks > 0, transaction > 10 min
```

### Prometheus queries para PostgreSQL (postgres_exporter)

```promql
# Conexões ativas
pg_stat_activity_count{state="active"}

# Cache hit ratio
pg_stat_database_blks_hit / (pg_stat_database_blks_hit + pg_stat_database_blks_read)

# Transactions per second
rate(pg_stat_database_xact_commit[5m]) + rate(pg_stat_database_xact_rollback[5m])

# Replication lag
pg_replication_lag_seconds

# Dead tuples (bloat indicator)
pg_stat_user_tables_n_dead_tup
```

---

## 5. Alertas de Banco

| Alerta | Threshold | Severidade | Ação |
|--------|-----------|-----------|------|
| Connections > 80% max | > 160/200 | Warning | Verificar leaks, escalar pool |
| Cache hit ratio < 95% | < 0.95 | Warning | Aumentar shared_buffers |
| Query p95 > 5s | > 5000ms | Warning | Investigar slow queries |
| Disk usage > 85% | > 85% | Critical | Cleanup, expand volume |
| Replication lag > 60s | > 60s | Critical | Verificar replica/network |
| Deadlocks detected | > 0 | Warning | Investigar transaction order |
| Long running transaction > 30min | > 30min | Warning | Kill ou investigar |
| Autovacuum blocked > 1h | > 1h | Warning | Verificar locks |

---

## 6. Ferramentas

### Diagnóstico

| Ferramenta | Uso |
|-----------|-----|
| `pg_stat_statements` | Top queries por tempo/chamadas |
| `pg_stat_activity` | Queries rodando agora |
| `pg_stat_user_tables` | Estatísticas por tabela |
| `auto_explain` | Logar EXPLAIN de queries lentas automaticamente |
| `pgBadger` | Analisar logs do PostgreSQL (gera relatório HTML) |
| `pg_top` | htop para PostgreSQL |

### Tuning

| Ferramenta | Uso |
|-----------|-----|
| PGTune | Gerar postgresql.conf baseado no hardware |
| pg_repack | VACUUM FULL sem downtime |
| pgbouncer | Connection pooling |
| pg_partman | Gerenciamento automático de partições |

### Monitoramento

| Ferramenta | Uso |
|-----------|-----|
| postgres_exporter | Exportar métricas para Prometheus |
| pgwatch2 | Monitoring dedicado para PostgreSQL |
| Grafana | Dashboards (usar dashboard ID 9628 para PostgreSQL) |
| Datadog / New Relic | SaaS com deep PostgreSQL integration |
