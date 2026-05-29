# Transformation Patterns — Medallion, SCD, dbt, Engines

## Índice
1. Medallion Architecture (Bronze/Silver/Gold)
2. Deduplication Patterns
3. Slowly Changing Dimensions (SCD)
4. dbt — SQL Transformations
5. Python: Pandas vs Polars vs Spark
6. Common Transformations Cookbook
7. Anti-Patterns

---

## 1. Medallion Architecture (Bronze/Silver/Gold)

```
┌─────────┐      ┌──────────┐      ┌─────────┐
│ BRONZE  │─────→│  SILVER  │─────→│  GOLD   │
│ Raw     │      │ Cleaned  │      │ Modeled │
│ As-is   │      │ Typed    │      │ Business│
│ Append  │      │ Deduped  │      │ Ready   │
└─────────┘      └──────────┘      └─────────┘

BRONZE (Raw / Landing):
├── Dado exatamente como veio da fonte
├── Sem transformação alguma
├── Append-only (nunca deleta, nunca modifica)
├── Metadata: _source, _extracted_at, _batch_id
├── Formato: Parquet particionado por data de ingestão
└── Propósito: auditoria, reprocessamento, debug

SILVER (Cleaned / Standardized):
├── Tipos corrigidos (string→date, string→int)
├── Nulls tratados (default, coalesce, ou flag)
├── Duplicatas removidas (por PK + dedup strategy)
├── Schema consistente (renomear colunas, padronizar)
├── Filtros de qualidade aplicados (remove lixo)
├── Formato: Parquet particionado por data do dado
└── Propósito: base limpa para qualquer consumidor

GOLD (Modeled / Business):
├── Agregações (daily_sales, monthly_metrics)
├── Joins (fatos + dimensões)
├── Métricas calculadas (LTV, churn rate, MRR)
├── Modelos dimensionais (star schema, OBT)
├── Otimizado para BI/dashboards
└── Propósito: alimentar analistas, dashboards, reports
```

```sql
-- Exemplo dbt: Bronze → Silver
-- models/silver/orders.sql
WITH source AS (
    SELECT * FROM {{ ref('bronze_orders') }}
),

cleaned AS (
    SELECT
        id,
        CAST(user_id AS VARCHAR) AS user_id,
        CAST(total AS BIGINT) AS total_cents,
        COALESCE(status, 'unknown') AS status,
        CAST(created_at AS TIMESTAMP) AS created_at,
        _extracted_at,
        -- Dedup: manter o registro mais recente por id
        ROW_NUMBER() OVER (PARTITION BY id ORDER BY _extracted_at DESC) AS _row_num
    FROM source
    WHERE id IS NOT NULL  -- Rejeitar registros sem PK
)

SELECT * EXCEPT(_row_num)
FROM cleaned
WHERE _row_num = 1
```

---

## 2. Deduplication Patterns

```sql
-- Pattern 1: ROW_NUMBER (mais comum)
-- Manter o registro mais recente por chave
WITH ranked AS (
    SELECT *,
        ROW_NUMBER() OVER (
            PARTITION BY order_id
            ORDER BY updated_at DESC, _extracted_at DESC
        ) AS rn
    FROM raw_orders
)
SELECT * FROM ranked WHERE rn = 1;

-- Pattern 2: QUALIFY (BigQuery, Snowflake)
SELECT *
FROM raw_orders
QUALIFY ROW_NUMBER() OVER (PARTITION BY order_id ORDER BY updated_at DESC) = 1;

-- Pattern 3: DISTINCT ON (PostgreSQL)
SELECT DISTINCT ON (order_id) *
FROM raw_orders
ORDER BY order_id, updated_at DESC;
```

```python
# Python — dedup
import polars as pl

# Polars (recomendado para performance)
df_deduped = (
    df.sort('updated_at', descending=True)
    .unique(subset=['order_id'], keep='first')
)

# Pandas
df_deduped = (
    df.sort_values('updated_at', ascending=False)
    .drop_duplicates(subset=['order_id'], keep='first')
)
```

---

## 3. Slowly Changing Dimensions (SCD)

```
Problema: o endereço do cliente mudou. O que fazer com os pedidos antigos?
Eles devem mostrar o endereço de quando foram feitos, não o atual.

SCD Type 1 — Sobrescrever (sem histórico)
  Simplesmente UPDATE. Perde o valor anterior.
  Uso: Dados que não precisam de histórico (correção de typo).

SCD Type 2 — Versionar (com histórico)
  Cria nova linha para cada mudança, com valid_from/valid_to.
  Uso: Dimensões que mudam e o histórico importa (endereço, plano).

SCD Type 3 — Coluna anterior
  Coluna extra para valor anterior (address, previous_address).
  Uso: Quando só precisa do valor atual e anterior.
```

```sql
-- SCD Type 2: implementação
CREATE TABLE dim_customers (
    customer_key SERIAL PRIMARY KEY,     -- Surrogate key
    customer_id VARCHAR NOT NULL,         -- Natural key (da fonte)
    name VARCHAR,
    email VARCHAR,
    plan VARCHAR,
    address_city VARCHAR,
    valid_from TIMESTAMP NOT NULL,
    valid_to TIMESTAMP DEFAULT '9999-12-31',
    is_current BOOLEAN DEFAULT TRUE
);

-- Quando o plano do customer muda:
-- 1. Fechar o registro atual
UPDATE dim_customers
SET valid_to = NOW(), is_current = FALSE
WHERE customer_id = 'cust-123' AND is_current = TRUE;

-- 2. Inserir novo registro
INSERT INTO dim_customers (customer_id, name, email, plan, address_city, valid_from)
VALUES ('cust-123', 'Maria', 'maria@email.com', 'premium', 'São Paulo', NOW());

-- Query: plano do customer no momento do pedido
SELECT o.*, d.plan
FROM orders o
JOIN dim_customers d ON o.customer_id = d.customer_id
    AND o.created_at BETWEEN d.valid_from AND d.valid_to;
```

---

## 4. dbt — SQL Transformations

```yaml
# dbt_project.yml
name: 'ecommerce_analytics'
version: '1.0.0'
profile: 'warehouse'

models:
  ecommerce_analytics:
    bronze:
      +materialized: view        # Raw data — views (não materializar)
    silver:
      +materialized: incremental  # Cleaned — incremental
    gold:
      +materialized: table        # Modeled — table materializada
```

```sql
-- models/gold/daily_revenue.sql
-- Modelo Gold: receita diária para dashboard

{{ config(
    materialized='incremental',
    unique_key='date_day',
    partition_by={'field': 'date_day', 'data_type': 'date'}
) }}

WITH orders AS (
    SELECT * FROM {{ ref('silver_orders') }}
    WHERE status = 'paid'
    {% if is_incremental() %}
        AND created_at > (SELECT MAX(date_day) FROM {{ this }})
    {% endif %}
),

daily AS (
    SELECT
        DATE(created_at) AS date_day,
        COUNT(DISTINCT id) AS total_orders,
        COUNT(DISTINCT user_id) AS unique_customers,
        SUM(total_cents) AS revenue_cents,
        AVG(total_cents) AS avg_order_value_cents,
        SUM(CASE WHEN is_first_order THEN 1 ELSE 0 END) AS new_customers
    FROM orders
    GROUP BY 1
)

SELECT * FROM daily
```

```sql
-- dbt tests inline
-- models/silver/schema.yml
version: 2

models:
  - name: silver_orders
    columns:
      - name: id
        tests:
          - unique
          - not_null
      - name: status
        tests:
          - accepted_values:
              values: ['pending', 'paid', 'shipped', 'cancelled', 'refunded']
      - name: total_cents
        tests:
          - not_null
          - dbt_utils.accepted_range:
              min_value: 0
              max_value: 100000000  # R$1M max
      - name: user_id
        tests:
          - not_null
          - relationships:
              to: ref('silver_users')
              field: id
```

---

## 5. Python: Pandas vs Polars vs Spark

```
Escolha por volume:

< 1GB (< 1M rows):    Pandas OU Polars
  Pandas: ecossistema maduro, mais bibliotecas
  Polars: 10-50x mais rápido que Pandas, API moderna

1GB - 100GB:           Polars OU DuckDB
  Polars: processa em memória com lazy evaluation
  DuckDB: SQL em arquivos Parquet, zero setup

> 100GB:               Spark (PySpark)
  Cluster distribuído, escala horizontalmente
  Overhead alto — não usar para volumes pequenos

Streaming:             Spark Structured Streaming ou Flink
```

```python
# Polars — recomendado para pipelines modernos
import polars as pl

# Lazy evaluation (só executa no collect)
result = (
    pl.scan_parquet('s3://bucket/orders/*.parquet')
    .filter(pl.col('status') == 'paid')
    .filter(pl.col('created_at') > '2025-01-01')
    .with_columns([
        (pl.col('total_cents') / 100).alias('total_brl'),
        pl.col('created_at').dt.date().alias('order_date'),
    ])
    .group_by('order_date')
    .agg([
        pl.count().alias('total_orders'),
        pl.col('total_brl').sum().alias('revenue'),
        pl.col('user_id').n_unique().alias('unique_customers'),
    ])
    .sort('order_date')
    .collect()  # Executa tudo de uma vez, otimizado
)
```

---

## 6. Common Transformations Cookbook

```python
# Tipagem e parsing
df = df.with_columns([
    pl.col('price').cast(pl.Int64),
    pl.col('created_at').str.to_datetime('%Y-%m-%dT%H:%M:%SZ'),
    pl.col('email').str.to_lowercase(),
    pl.col('cpf').str.replace_all(r'[.\-]', ''),  # Remove formatação
])

# Null handling
df = df.with_columns([
    pl.col('status').fill_null('unknown'),
    pl.col('phone').fill_null(pl.lit('')),
    pl.coalesce(['preferred_name', 'name']).alias('display_name'),
])

# Enriquecimento (join)
df_enriched = df_orders.join(
    df_users.select(['id', 'name', 'segment']),
    left_on='user_id',
    right_on='id',
    how='left'
)

# Pivot / Agregação
monthly = (
    df.with_columns(pl.col('created_at').dt.strftime('%Y-%m').alias('month'))
    .group_by(['month', 'category'])
    .agg(pl.col('total').sum().alias('revenue'))
    .pivot(values='revenue', index='month', on='category')
)
```

---

## 7. Anti-Patterns

```
❌ Transformar no Bronze
   Bronze é SAGRADO. Raw, imutável, append-only.
   Transformação começa no Silver.

❌ SELECT * em produção
   Carregar todos os campos quando só precisa de 5.
   Mais I/O, mais memória, mais custo no warehouse.

❌ Sem particionamento
   Tabela com 1 bilhão de rows sem partição = full scan em toda query.
   Particionar por data (dia, mês) no mínimo.

❌ Depender de ordem dos dados
   "Os dados chegam em ordem cronológica" — NÃO.
   Sempre ORDER BY explícito. Nunca assumir ordem.

❌ Hardcoded IDs e valores
   WHERE category_id = 42 → o que é 42?
   Usar tabela de referência ou constante nomeada.

❌ Transformação sem teste
   "Rodou sem erro" ≠ "resultado correto".
   dbt tests, assertions, row count checks.

❌ Pipeline monolítico
   1 script de 2000 linhas que faz tudo.
   Quebrar em steps: extract → validate → transform → load.
```
