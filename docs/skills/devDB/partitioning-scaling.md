# Partitioning & Scaling — Quando e Como Escalar o Banco

## Índice
1. Escada de Escalabilidade
2. Particionamento (PostgreSQL)
3. Read Replicas
4. Connection Pooling
5. Materialized Views
6. Archiving (Dados Históricos)
7. Sharding (Último Recurso)

---

## 1. Escada de Escalabilidade

Escalar banco de dados é uma escada. Subir degrau a degrau.
NUNCA pular para sharding sem esgotar os degraus anteriores.

```
Degrau 1: Otimizar queries + índices             ← 90% dos problemas morrem aqui
Degrau 2: Tuning do banco (shared_buffers, etc.)  ← Mais 5%
Degrau 3: Connection pooling (PgBouncer)          ← Resolve connection storms
Degrau 4: Materialized views / cache              ← Queries pesadas de leitura
Degrau 5: Read replicas                           ← Separar reads de writes
Degrau 6: Particionamento                         ← Tabelas com 100M+ rows
Degrau 7: Archiving                               ← Mover dados antigos
Degrau 8: Sharding                                ← Último recurso, complexidade alta
```

---

## 2. Particionamento (PostgreSQL)

### O que é

Dividir uma tabela grande em pedaços menores (partitions) que o banco
gerencia como se fosse uma tabela só. Queries que filtram pela partition key
acessam APENAS a partition relevante (partition pruning).

### Tipos

```sql
-- RANGE: Mais comum. Ideal para dados temporais.
CREATE TABLE events (
  id BIGINT GENERATED ALWAYS AS IDENTITY,
  event_type TEXT,
  data JSONB,
  created_at TIMESTAMPTZ NOT NULL
) PARTITION BY RANGE (created_at);

-- Partitions mensais
CREATE TABLE events_2025_01 PARTITION OF events
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
CREATE TABLE events_2025_02 PARTITION OF events
  FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
-- ... criar partitions futuras via cron ou extensão (pg_partman)

-- LIST: Para categorias discretas
CREATE TABLE orders (
  id UUID PRIMARY KEY,
  region TEXT NOT NULL,
  total NUMERIC
) PARTITION BY LIST (region);

CREATE TABLE orders_br PARTITION OF orders FOR VALUES IN ('BR');
CREATE TABLE orders_us PARTITION OF orders FOR VALUES IN ('US');
CREATE TABLE orders_eu PARTITION OF orders FOR VALUES IN ('EU');

-- HASH: Distribuição uniforme (quando não tem padrão natural)
CREATE TABLE sessions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  data JSONB
) PARTITION BY HASH (user_id);

CREATE TABLE sessions_0 PARTITION OF sessions FOR VALUES WITH (MODULUS 4, REMAINDER 0);
CREATE TABLE sessions_1 PARTITION OF sessions FOR VALUES WITH (MODULUS 4, REMAINDER 1);
CREATE TABLE sessions_2 PARTITION OF sessions FOR VALUES WITH (MODULUS 4, REMAINDER 2);
CREATE TABLE sessions_3 PARTITION OF sessions FOR VALUES WITH (MODULUS 4, REMAINDER 3);
```

### Quando particionar

| Sinal | Particionar? |
|-------|-------------|
| Tabela > 100M rows | ✅ Provavelmente sim |
| Tabela > 10M rows com range queries em timestamps | ✅ BRIN + partition |
| Queries SEMPRE filtram por data/região/tenant | ✅ Partition key natural |
| Tabela grande mas queries não filtram por nada previsível | ❌ Não ajuda |
| Precisa deletar dados antigos periodicamente | ✅ DROP partition é instant |

### Automação com pg_partman

```sql
-- Instalar extensão
CREATE EXTENSION pg_partman;

-- Criar gerenciamento automático
SELECT partman.create_parent(
  p_parent_table := 'public.events',
  p_control := 'created_at',
  p_type := 'range',
  p_interval := '1 month',
  p_premake := 3  -- Criar 3 partitions futuras
);

-- Manutenção (rodar via cron diário)
SELECT partman.run_maintenance();
```

---

## 3. Read Replicas

### Quando usar

```
USAR read replica quando:
├── Reads representam > 80% do tráfego
├── Queries de relatório/analytics estão impactando o primary
├── Precisa de disponibilidade geográfica (replica em outra região)
└── App pode tolerar lag de milissegundos nos reads

NÃO USAR quando:
├── O gargalo é WRITE (replica não ajuda com writes)
├── A aplicação precisa de consistência forte em reads
└── O problema é query ruim (fix a query primeiro!)
```

### Configuração na aplicação

```javascript
// Node.js com Prisma — Read/Write splitting
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,  // Primary (writes)
    },
  },
});

// Para reads, usar replica
const readPrisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_REPLICA_URL,  // Replica (reads)
    },
  },
});

// Uso
await prisma.order.create({ data: {...} });       // Write → primary
const orders = await readPrisma.order.findMany();  // Read → replica
```

### Monitorar replication lag

```sql
-- No primary
SELECT
  client_addr,
  state,
  sent_lsn,
  write_lsn,
  replay_lsn,
  pg_wal_lsn_diff(sent_lsn, replay_lsn) AS replication_lag_bytes
FROM pg_stat_replication;

-- Na replica
SELECT
  now() - pg_last_xact_replay_timestamp() AS replication_lag;
```

---

## 4. Connection Pooling

### Por que é essencial

```
Sem pool:
├── Cada request HTTP abre uma conexão ao PostgreSQL
├── Conexão PostgreSQL custa ~2MB de RAM + overhead de fork
├── max_connections = 100 (default)
├── 200 requests simultâneas = 100 esperando + timeouts
└── Resultado: "FATAL: too many connections" em produção

Com pool (PgBouncer):
├── App abre conexão para PgBouncer (barato, processo leve)
├── PgBouncer mantém N conexões reais ao PostgreSQL (ex: 20)
├── 200 requests compartilham 20 conexões reais
├── PostgreSQL está feliz com 20 conexões
└── Resultado: escala para milhares de requests simultâneas
```

### PgBouncer config

```ini
; pgbouncer.ini
[databases]
myapp = host=db port=5432 dbname=myapp

[pgbouncer]
listen_addr = 0.0.0.0
listen_port = 6432
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt

; Pool mode: transaction é o mais comum
pool_mode = transaction

; Conexões
default_pool_size = 20        ; Conexões reais por database
min_pool_size = 5             ; Mínimo mantido aberto
max_client_conn = 1000        ; Máximo de clients no PgBouncer
max_db_connections = 50       ; Máximo de conexões reais ao PG

; Timeouts
server_idle_timeout = 300
client_idle_timeout = 600
query_timeout = 30
```

### Docker Compose com PgBouncer

```yaml
services:
  pgbouncer:
    image: bitnami/pgbouncer:latest
    environment:
      - POSTGRESQL_HOST=db
      - POSTGRESQL_PORT=5432
      - POSTGRESQL_USERNAME=${DB_USER}
      - POSTGRESQL_PASSWORD=${DB_PASS}
      - POSTGRESQL_DATABASE=${DB_NAME}
      - PGBOUNCER_POOL_MODE=transaction
      - PGBOUNCER_DEFAULT_POOL_SIZE=20
      - PGBOUNCER_MAX_CLIENT_CONN=500
    depends_on:
      db:
        condition: service_healthy
    networks:
      - backend
    # App conecta no PgBouncer (porta 6432), não direto no PG
```

---

## 5. Materialized Views

### Para queries pesadas de leitura que não precisam de dados real-time

```sql
-- Dashboard que agrega milhões de rows
CREATE MATERIALIZED VIEW daily_revenue AS
SELECT
  date_trunc('day', created_at) AS day,
  status,
  COUNT(*) AS order_count,
  SUM(total) AS revenue,
  AVG(total) AS avg_order_value
FROM orders
GROUP BY 1, 2;

-- Índice na materialized view
CREATE UNIQUE INDEX idx_daily_revenue ON daily_revenue (day, status);

-- Refresh (rodar via cron a cada X minutos)
REFRESH MATERIALIZED VIEW CONCURRENTLY daily_revenue;
-- CONCURRENTLY: não bloqueia reads durante refresh (requer UNIQUE INDEX)
```

### Quando usar

| Cenário | Materialized View? |
|---------|-------------------|
| Dashboard com agregações pesadas | ✅ Refresh a cada 5-15 min |
| Relatório que roda 1x por dia | ✅ Refresh diário |
| Query de listagem com JOIN complexo | ✅ Se tolerância de dados stale |
| Dados que precisam ser real-time | ❌ Use query otimizada ou cache Redis |

---

## 6. Archiving (Dados Históricos)

### Estratégia

```
Dados HOT (< 3 meses):  Na tabela principal, indexados, rápidos
Dados WARM (3-12 meses): Em tabela archive, menos índices
Dados COLD (> 12 meses): Em storage barato (S3) ou deletados

Mover dados de hot → warm:
1. INSERT INTO orders_archive SELECT * FROM orders WHERE created_at < NOW() - INTERVAL '3 months';
2. DELETE FROM orders WHERE created_at < NOW() - INTERVAL '3 months';

Ou com particionamento:
1. ALTER TABLE orders DETACH PARTITION orders_2024_01;
2. ALTER TABLE orders_archive ATTACH PARTITION orders_2024_01 ...;
```

### Automação

```sql
-- Função de archiving
CREATE OR REPLACE FUNCTION archive_old_orders() RETURNS void AS $$
BEGIN
  -- Mover para archive
  INSERT INTO orders_archive
  SELECT * FROM orders
  WHERE created_at < NOW() - INTERVAL '3 months'
  ON CONFLICT DO NOTHING;

  -- Deletar da tabela principal
  DELETE FROM orders
  WHERE created_at < NOW() - INTERVAL '3 months';

  RAISE NOTICE 'Archived orders older than 3 months';
END;
$$ LANGUAGE plpgsql;

-- Rodar mensalmente via pg_cron ou cron do sistema
```

---

## 7. Sharding (Último Recurso)

### Por que é o último recurso

```
Sharding adiciona:
├── Complexidade de roteamento (qual shard tem o dado?)
├── JOINs cross-shard são impossíveis ou muito lentos
├── Transações cross-shard são complexas (2PC)
├── Rebalanceamento de shards é operação pesada
├── Cada shard precisa de backup, monitoring, manutenção
└── Debugging fica 10x mais difícil

Sharding resolve:
├── Write-throughput além do que 1 servidor aguenta
├── Dataset que não cabe em 1 servidor
└── Latência geográfica (shard por região)
```

### Estratégias

```
Por tenant (multi-tenant SaaS):
├── Cada cliente grande tem seu shard
├── Clientes pequenos compartilham shard
└── Roteamento: tenant_id → shard

Por range (dados temporais):
├── Dados recentes no shard principal
├── Dados antigos em shards de archive
└── Similar a particionamento, mas em servidores diferentes

Por hash:
├── hash(user_id) % N = shard number
├── Distribuição uniforme
└── Rebalancear ao adicionar shards é complexo
```

### Alternativas antes de shardar

| Alternativa | Resolve |
|-------------|---------|
| Índices melhores | 90% dos problemas de read |
| Connection pool | Connection storms |
| Read replicas | Read-heavy workloads |
| Particionamento | Tabelas enormes (mesmo servidor) |
| Vertical scaling (máquina maior) | Tudo, até o limite da máquina |
| Citus (extensão PostgreSQL) | Sharding transparente sem rewrite de app |
