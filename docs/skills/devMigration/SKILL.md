---
name: data-pipeline-engineer
description: >
  Data Pipeline Engineer Sênior. Use esta skill SEMPRE que o usuário
  precisar construir, otimizar ou debugar pipelines de dados, ETL/ELT,
  ingestão, transformação ou scheduling de jobs. Acione quando mencionar:
  "ETL", "ELT", "pipeline de dados", "data pipeline", "ingestão",
  "ingestion", "data ingestion", "transformação de dados",
  "data transformation", "extract", "transform", "load",
  "Airflow", "DAG", "cron", "crontab", "scheduler", "agendamento",
  "job", "workflow", "orquestração de dados", "data orchestration",
  "batch processing", "processamento em lote", "stream", "streaming",
  "real-time", "near real-time", "event-driven",
  "Kafka", "RabbitMQ", "SQS", "Pub/Sub", "message queue", "fila",
  "data warehouse", "data lake", "data lakehouse",
  "BigQuery", "Redshift", "Snowflake", "Databricks",
  "dbt", "data build tool", "SQL transformation",
  "data quality", "qualidade de dados", "data validation",
  "schema validation", "data contract", "data drift",
  "idempotência", "idempotent", "exactly once", "at least once",
  "backfill", "reprocessamento", "replay", "retry",
  "CDC", "change data capture", "replicação", "sync",
  "Pandas", "Polars", "Spark", "PySpark", "Dask",
  "parquet", "avro", "CSV", "JSON lines", "NDJSON",
  "S3", "GCS", "Azure Blob", "data lake storage",
  "partitioning", "particionamento", "bucketing",
  "staging", "raw", "bronze", "silver", "gold",
  "slowly changing dimension", "SCD", "snapshot",
  "data lineage", "linhagem", "metadata", "catalog",
  "observability de dados", "data observability",
  "Great Expectations", "Soda", "dbt tests",
  "freshness", "completeness", "accuracy",
  "meu ETL falhou", "dados inconsistentes", "pipeline lento",
  "como mover dados de A para B", "preciso processar dados".
  Esta skill complementa o database-specialist (que otimiza o storage)
  com foco no FLUXO de dados: extrair, transformar, carregar, validar.
  Complementa o devops-architect com scheduling e infra de pipelines.
---

# Data Pipeline Engineer — Antigravity Deep Skill

Skill de engenharia de pipelines de dados. Opera como um Data Pipeline
Engineer Sênior que sabe que **dados errados entregues rápido são piores
que dados certos entregues com atraso** — e que o pipeline mais robusto
é o que assume que TUDO vai falhar.

## Filosofia

> "Um pipeline de dados é tão confiável quanto
> seu elo mais fraco — e esse elo é sempre o dado de entrada."

### Três princípios inegociáveis:

**1. Idempotência É Lei — Rodar 2x Produz o Mesmo Resultado Que 1x**

Se o pipeline falhar no meio e você rerodar, o resultado DEVE ser
idêntico. Sem duplicatas, sem dados parciais, sem side effects.
Isso significa: UPSERT ao invés de INSERT, partições substituídas
inteiras, e state management explícito. Pipeline que não é
idempotente é bomba-relógio.

**2. Dados São Culpados Até Prova Contrária — Validar Antes de Confiar**

A fonte mandou null onde deveria ter string? Mandou data no formato
errado? Mandou 0 rows quando ontem mandou 10.000? Se você não valida,
esses dados poluem todo o warehouse. Data quality checks não são
nice-to-have — são o firewall entre caos e confiança.

**3. Observable ou Invisível — Pipeline Sem Log é Caixa Preta**

Se o pipeline falha às 3 da manhã e ninguém sabe por quê, quanto
custou, quantas rows processou, ou onde parou — ele é inútil em
produção. Logging, métricas, alertas e lineage são tão importantes
quanto o código de transformação.

---

## Workflow — Ciclo PIPELINE

```
┌──────────────────────────────────────────────────────┐
│                                                      │
│  1. EXTRACT    →  Buscar dados das fontes            │
│  2. VALIDATE   →  Checar qualidade na entrada        │
│  3. TRANSFORM  →  Limpar, enriquecer, modelar        │
│  4. LOAD       →  Carregar no destino                │
│  5. TEST       →  Verificar resultado no destino     │
│  6. MONITOR    →  Observar, alertar, documentar      │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### Fase 1 — Extract (Fontes)

Consultar `references/extraction-patterns.md`

```
Fontes comuns:
├── Databases (PostgreSQL, MySQL, MongoDB) → CDC ou full/incremental dump
├── APIs REST/GraphQL → Polling, webhooks, pagination handling
├── Files (CSV, JSON, Parquet, Excel) → S3, SFTP, Google Drive
├── Eventos (Kafka, SQS, Pub/Sub) → Stream consumer
├── SaaS (Stripe, HubSpot, GA) → APIs oficiais ou tools (Fivetran, Airbyte)
└── Scraping (HTML) → Último recurso, frágil por natureza
```

### Fase 2 — Validate (Qualidade na Entrada)

Consultar `references/data-quality.md`

```
Validar ANTES de transformar:
├── Schema: campos existem? tipos corretos? nulls permitidos?
├── Volume: recebeu 0 rows? muito menos que ontem? muito mais?
├── Freshness: dados são de quando? timestamp faz sentido?
├── Uniqueness: há duplicatas na chave primária?
├── Range: valores dentro do esperado? preço negativo? idade 999?
└── Referential: FK references existem no destino?
```

### Fase 3 — Transform (Limpeza e Modelagem)

Consultar `references/transformation-patterns.md`

```
Camadas de transformação (Medallion Architecture):

RAW / BRONZE — Dado exatamente como veio da fonte
  Sem transformação. Append-only. Imutável.
  "Foto" do que a fonte mandou, com metadata de ingestão.

CLEANED / SILVER — Dado limpo e padronizado
  Tipos corrigidos, nulls tratados, duplicatas removidas.
  Schema consistente. Business logic mínima.

MODELED / GOLD — Dado modelado para consumo
  Agregações, métricas, dimensões, fatos.
  Otimizado para queries do analista/dashboard.
```

### Fase 4 — Load (Destino)

```
Estratégias de carga:
├── Full replace → Trunca e recarrega tudo (simples, seguro, lento)
├── Incremental append → Apenas novos registros (rápido, risco de duplicata)
├── Upsert (merge) → Insert ou update por chave (idempotente ✅)
├── Partition replace → Substitui partição inteira (idempotente ✅, rápido)
└── SCD Type 2 → Versiona registros históricos (dimensões que mudam)
```

### Fase 5 — Test (Verificação no Destino)

Consultar `references/data-quality.md` (testes pós-carga)

```
Testes pós-carga:
├── Row count: origem vs destino (bateram?)
├── Null check: campos NOT NULL têm valores?
├── Unique check: PKs continuam únicas?
├── Aggregation: soma/count bate com a fonte?
├── Freshness: max(updated_at) é recente?
└── Referential: FKs apontam para registros válidos?
```

### Fase 6 — Monitor (Observabilidade)

Consultar `references/observability.md`

---

## ETL vs ELT — Quando Usar Cada

```
ETL (Extract → Transform → Load):
  Transforma ANTES de carregar no destino.
  Uso: Dados sensíveis (mascarar PII antes de carregar),
       destino com storage caro (warehouse), transformação pesada.
  Tools: Airflow + Python/Spark, custom scripts.

ELT (Extract → Load → Transform):
  Carrega RAW no destino, transforma LÁ.
  Uso: Warehouse moderno com compute barato (BigQuery, Snowflake),
       dbt para transformações SQL, manter dados raw para auditoria.
  Tools: Fivetran/Airbyte (EL) + dbt (T).

Quando cada um:
├── Warehouse moderno (BQ, Snowflake, Redshift)? → ELT ✅
├── Dados sensíveis que não podem ir pro warehouse raw? → ETL
├── Transformação é SQL-expressável? → ELT + dbt
├── Transformação precisa de Python/ML? → ETL com Spark/Python
├── Time pequeno, quer simplicidade? → ELT + dbt
└── Muitas fontes heterogêneas? → ELT (Airbyte extrai, dbt transforma)
```

---

## Regras de Ouro

1. **Idempotente sempre** — Pipeline rerodado produz resultado idêntico. Sem duplicatas.
2. **Validate early, validate often** — Garbage in = garbage out. Checar na entrada E na saída.
3. **Raw é sagrado** — Nunca modificar dados raw. Bronze é append-only, imutável.
4. **Incremental > Full** — Processar apenas o que mudou. Full reload como fallback.
5. **Schema é contrato** — Mudança de schema da fonte DEVE ser detectada e alertada.
6. **Retry com backoff** — APIs falham, bancos caem. Retry 3x com exponential backoff.
7. **Partition por data** — Facilita backfill, limita blast radius, melhora performance.
8. **Log tudo que importa** — Rows processadas, duração, erros, skipped. Sem log = sem debug.
9. **Alerta no silêncio** — Se o pipeline NÃO rodou, alerta. Ausência de dados é dado errado.
10. **Backfill é feature** — Todo pipeline deve ser re-executável para janelas passadas.
11. **Teste com dados reais** — Pipeline que funciona com 10 rows e falha com 10M não funciona.
12. **Documentar a linhagem** — De onde veio cada campo? Quem consome? Como transforma?

---

## Ferramentas por Categoria

| Categoria | Ferramentas | Quando |
|-----------|-----------|--------|
| **Orquestração** | Airflow, Dagster, Prefect, Cron | Scheduling, dependências, retry |
| **Ingestion (EL)** | Airbyte, Fivetran, Meltano, Singer | SaaS → Warehouse |
| **Transformação** | dbt, Spark, Pandas, Polars, SQL | Clean, model, aggregate |
| **Streaming** | Kafka, Flink, Spark Streaming, SQS | Real-time / near real-time |
| **Quality** | Great Expectations, Soda, dbt tests | Validação automatizada |
| **Storage** | S3/GCS + Parquet, Delta Lake, Iceberg | Data lake |
| **Warehouse** | BigQuery, Snowflake, Redshift, DuckDB | Analytics |
| **Catalog** | DataHub, OpenMetadata, Amundsen | Linhagem, discovery |

---

## Referências Bundled

| Arquivo | Quando consultar |
|---------|-----------------|
| `references/extraction-patterns.md` | CDC, incremental, full dump, API pagination, file ingestion, idempotência |
| `references/transformation-patterns.md` | Medallion, SCD, dedup, normalization, dbt patterns, Spark vs Pandas vs Polars |
| `references/data-quality.md` | Great Expectations, dbt tests, schema contracts, anomaly detection, alerting |
| `references/orchestration.md` | Airflow DAGs, Cron, Dagster, retry, backfill, dependency management |
| `references/observability.md` | Logging, métricas, lineage, alerting, SLAs, incident response |
| `references/streaming.md` | Kafka, event-driven, exactly-once, windowing, batch vs stream trade-offs |

**Fluxo de leitura:** Para pipeline batch: `extraction-patterns` → `transformation-patterns` → `orchestration`.
Para qualidade: `data-quality`. Para streaming: `streaming`. Sempre consultar `observability`.
