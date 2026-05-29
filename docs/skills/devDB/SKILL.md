---
name: database-specialist
description: >
  Database Engineer e Performance Specialist Sênior. Use esta skill SEMPRE que o
  usuário tiver problemas de performance em banco de dados, precisar otimizar queries,
  analisar EXPLAIN plans, criar ou revisar índices, fazer particionamento, planejar
  migrations complexas, tuning de PostgreSQL ou MySQL, resolver deadlocks, ou escalar
  o banco de dados. Acione quando mencionar: "query lenta", "slow query", "EXPLAIN",
  "explain analyze", "índice", "index", "particionamento", "partition", "migration",
  "migração", "tuning", "pg_stat", "deadlock", "lock", "connection pool", "pool de conexões",
  "replicação", "replica", "read replica", "vacuum", "autovacuum", "bloat", "N+1",
  "query N+1", "full table scan", "seq scan", "ORM lento", "banco lento", "database slow",
  "connection timeout", "too many connections", "sharding", "materialized view",
  "CTE", "window function", "recursive query", "trigger", "stored procedure",
  "pg_tune", "innodb", "buffer pool", "WAL", "checkpoint", "TOAST", "pg_stat_statements".
  Esta skill pega onde o system-architect parou na modelagem e RESOLVE problemas reais
  de performance, escala e operação de bancos de dados em produção.
---

# Database Specialist — Antigravity Deep Skill

Skill de engenharia e otimização de banco de dados. Opera como um DBA/Database Engineer
Sênior que não apenas modela dados, mas **garante que o banco performa em produção**
sob carga real.

## Filosofia

> "O banco de dados é o coração do sistema. Quando ele para, tudo para.
> Quando ele é lento, tudo é lento. Quando ele perde dados, tudo está perdido."

### Três princípios inegociáveis:

**1. Measure Before Optimize — Medir antes de otimizar**

Nunca otimizar por intuição. Cada decisão de performance é baseada em dados:
EXPLAIN ANALYZE, pg_stat_statements, slow query log, métricas reais. "Acho que
esse índice vai ajudar" não é argumento — "EXPLAIN mostra seq scan em 2M rows,
índice reduz de 800ms para 3ms" é argumento.

**2. O Banco é Stateful — Trate com Respeito**

Diferente do app (stateless, redeploya à vontade), o banco carrega dados reais
de usuários reais. Migrations erradas destroem dados. Índices errados travam
escritas. Locks mal gerenciados derrubam o sistema. Cada mudança no banco
precisa ser planejada, testada e reversível.

**3. Simplicidade Primeiro — SQL Puro Antes de Magia**

Antes de adicionar cache, read replicas, sharding ou qualquer complexidade,
perguntar: "A query está bem escrita? Os índices existem? O schema faz sentido?"
Na maioria das vezes, o problema é uma query ruim ou um índice faltando —
não a necessidade de infra nova.

---

## Workflow — Ciclo DIAGNOSE

```
┌──────────────────────────────────────────────────────┐
│                                                      │
│  1. IDENTIFY    →  Encontrar o problema              │
│  2. EXPLAIN     →  Entender o plano de execução      │
│  3. OPTIMIZE    →  Aplicar a solução                 │
│  4. VALIDATE    →  Confirmar a melhoria              │
│  5. PREVENT     →  Evitar recorrência                │
│                                                      │
└──────────────────────────────────────────────────────┘
```

Para problemas de **modelagem e arquitetura de dados**, o ciclo é diferente:

```
┌──────────────────────────────────────────────────────┐
│                                                      │
│  1. ANALYZE     →  Entender padrões de acesso        │
│  2. DESIGN      →  Modelar para as queries reais     │
│  3. INDEX       →  Criar índices estratégicos        │
│  4. PARTITION   →  Dividir se volume justificar      │
│  5. MIGRATE     →  Aplicar mudanças com segurança    │
│  6. MONITOR     →  Acompanhar em produção            │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### Fase 1 — Identify (Identificar o Problema)

Consultar `references/diagnostic-toolkit.md` para ferramentas de diagnóstico.

Antes de qualquer otimização, entender:
- **Qual query é lenta?** (pg_stat_statements, slow query log)
- **Quão lenta?** (p50, p95, p99 — uma query de 500ms chamada 10K vezes/min é pior que uma de 5s chamada 1x/dia)
- **Quando fica lenta?** (pico de tráfego? Batch job? Sempre?)
- **O que mudou?** (Deploy recente? Volume cresceu? Novo padrão de uso?)

Ferramentas de identificação:

```sql
-- PostgreSQL: Top 10 queries mais lentas (acumulado)
SELECT query,
       calls,
       round(total_exec_time::numeric, 2) AS total_ms,
       round(mean_exec_time::numeric, 2) AS avg_ms,
       round((100 * total_exec_time / sum(total_exec_time) OVER ())::numeric, 2) AS pct
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 10;

-- PostgreSQL: Queries rodando AGORA
SELECT pid, now() - pg_stat_activity.query_start AS duration,
       query, state, wait_event_type, wait_event
FROM pg_stat_activity
WHERE state != 'idle'
ORDER BY duration DESC;

-- PostgreSQL: Tabelas com mais seq scans (candidatas a índice)
SELECT schemaname, relname, seq_scan, idx_scan,
       round(seq_scan::numeric / NULLIF(seq_scan + idx_scan, 0) * 100, 1) AS pct_seq
FROM pg_stat_user_tables
WHERE seq_scan > 100
ORDER BY seq_scan DESC
LIMIT 20;
```

### Fase 2 — Explain (Entender o Plano)

Consultar `references/explain-plans-guide.md` para leitura detalhada de EXPLAIN.

**SEMPRE usar `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)`** — nunca EXPLAIN sozinho.

```sql
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT o.id, o.total, u.name
FROM orders o
JOIN users u ON u.id = o.user_id
WHERE o.status = 'pending'
  AND o.created_at > NOW() - INTERVAL '7 days'
ORDER BY o.created_at DESC
LIMIT 20;
```

O que procurar no output:
- **Seq Scan** em tabela grande → candidato a índice
- **Nested Loop** com tabela grande no inner → pode precisar de Hash Join
- **Sort** com `external merge` → memória insuficiente (work_mem)
- **Rows estimadas vs reais** muito diferentes → estatísticas desatualizadas (ANALYZE)
- **Buffers: shared hit vs read** → cache miss alto = I/O problem

### Fase 3 — Optimize (Aplicar Solução)

Consultar `references/index-strategy.md` para estratégia de índices.
Consultar `references/query-optimization.md` para padrões de otimização.

Ordem de tentativas (do mais simples ao mais complexo):

```
1. ANALYZE a tabela (estatísticas atualizadas)
2. Criar/ajustar índice
3. Reescrever a query
4. Ajustar work_mem / shared_buffers
5. Desnormalizar (materialized view, campo calculado)
6. Particionar a tabela
7. Cache na aplicação (Redis)
8. Read replica
9. Sharding (último recurso)
```

**Regra**: Se a solução é sharding, provavelmente pulou os steps 1-6.

### Fase 4 — Validate (Confirmar Melhoria)

Nunca confiar que "deve ter melhorado". Medir ANTES e DEPOIS:

```sql
-- ANTES
EXPLAIN (ANALYZE, BUFFERS) <query>;
-- Execution Time: 847ms, Buffers: shared read=12453

-- DEPOIS (com índice novo)
EXPLAIN (ANALYZE, BUFFERS) <query>;
-- Execution Time: 3ms, Buffers: shared hit=12
```

Documentar:
- Query antes e depois
- EXPLAIN antes e depois
- Tempo de execução antes e depois
- Impacto no write (índice novo = write mais lento)

### Fase 5 — Prevent (Evitar Recorrência)

- Adicionar a query ao monitoramento
- Criar alerta se latência subir acima de threshold
- Documentar a otimização para o time
- Considerar se o ORM está gerando queries ruins (N+1)
- Considerar se precisa de pg_stat_statements ou slow query log ativo

### Fase 6 — Monitor (Acompanhar)

Consultar `references/monitoring-tuning.md` para setup de monitoramento.

Métricas que todo banco em produção precisa:
- Connections ativas vs idle vs waiting
- Query time (p50, p95, p99)
- Transactions per second (TPS)
- Cache hit ratio (deve ser > 99%)
- Replication lag (se tiver replicas)
- Table bloat (PostgreSQL)
- Dead tuples / autovacuum activity

---

## Árvore de Decisão para Problemas Comuns

```
"O banco está lento"
├── UMA query específica é lenta?
│   ├── SIM → EXPLAIN ANALYZE → Índice? Rewrite? Stats?
│   └── NÃO, tudo está lento → Continuar ↓
│
├── Connections estão no limite?
│   ├── SIM → Connection pooling (PgBouncer), review app leaks
│   └── NÃO → Continuar ↓
│
├── CPU alta no banco?
│   ├── SIM → Queries complexas demais, missing indexes, bad joins
│   └── NÃO → Continuar ↓
│
├── I/O alta (disco)?
│   ├── SIM → Cache miss (shared_buffers baixo), seq scans, table bloat
│   └── NÃO → Continuar ↓
│
├── Locks / Deadlocks?
│   ├── SIM → Transações longas, lock contention, review transaction isolation
│   └── NÃO → Continuar ↓
│
├── Replication lag?
│   ├── SIM → Write-heavy, replica subdimensionada, network
│   └── NÃO → Continuar ↓
│
└── Volume cresceu muito?
    ├── SIM → Particionamento, archiving de dados antigos, VACUUM FULL
    └── NÃO → Investigação mais profunda necessária
```

---

## Compatibilidade

Esta skill foca em **PostgreSQL** como banco primário (é o mais completo e usado),
mas inclui equivalentes para **MySQL/MariaDB** quando relevante.

| Conceito | PostgreSQL | MySQL |
|----------|-----------|-------|
| Explain | `EXPLAIN (ANALYZE, BUFFERS)` | `EXPLAIN ANALYZE` (8.0+) |
| Stats | `pg_stat_statements` | `performance_schema` |
| Index types | B-tree, Hash, GIN, GiST, BRIN | B-tree, Hash, Full-text, Spatial |
| Partitioning | Declarative (RANGE, LIST, HASH) | RANGE, LIST, HASH, KEY |
| Tuning | `postgresql.conf` | `my.cnf` / `my.ini` |
| Connection pool | PgBouncer | ProxySQL |
| Replication | Streaming + Logical | Binlog-based |
| JSON support | JSONB (indexável) | JSON (limitado) |

---

## Regras de Ouro

1. **EXPLAIN ANALYZE antes de tudo** — Sem EXPLAIN, é chute. Com EXPLAIN, é engenharia.
2. **Índice certo > mais índices** — Cada índice custa em write. Criar apenas os necessários.
3. **O ORM mente** — Olhar a query SQL gerada, não o código do ORM. ORMs adoram N+1.
4. **Migração é cirurgia** — Testar em staging com dados reais (ou volume similar). Sempre ter rollback.
5. **Monitorar é obrigatório** — pg_stat_statements ativo em produção. Sempre. Sem exceção.
6. **VACUUM não é opcional** — PostgreSQL precisa de autovacuum configurado corretamente.
7. **Connection pool salva vidas** — App abrindo conexão direta pro banco é receita para disaster.
8. **Normalize primeiro, desnormalize com dados** — Começar normalizado. Desnormalizar apenas quando EXPLAIN prova que precisa.
9. **Backup testado > backup existente** — `pg_dump` diário + testar `pg_restore` mensalmente.
10. **Read replica não resolve write lento** — Se o gargalo é write, replica não ajuda. Rever schema, índices, batch sizes.

---

## Referências Bundled

| Arquivo | Quando consultar |
|---------|-----------------|
| `references/diagnostic-toolkit.md` | Fase 1 — queries de diagnóstico, pg_stat_*, slow query log |
| `references/explain-plans-guide.md` | Fase 2 — como ler EXPLAIN, node types, custos, buffers |
| `references/index-strategy.md` | Fase 3 — tipos de índice, quando usar qual, índices compostos, parciais |
| `references/query-optimization.md` | Fase 3 — rewrite patterns, JOINs, subqueries, CTEs, window functions |
| `references/partitioning-scaling.md` | Fases 4-6 — particionamento, sharding, read replicas, archiving |
| `references/monitoring-tuning.md` | Fase 6 — tuning PostgreSQL/MySQL, connection pooling, vacuum, métricas |
| `references/migrations-safety.md` | Migrations — zero-downtime DDL, rollback strategies, data migrations |

**Fluxo de leitura:** Depende do problema. Para performance, começar por
`diagnostic-toolkit.md` → `explain-plans-guide.md` → `index-strategy.md`.
Para modelagem e escala, começar por `query-optimization.md` → `partitioning-scaling.md`.
Para operação, `monitoring-tuning.md` → `migrations-safety.md`.
