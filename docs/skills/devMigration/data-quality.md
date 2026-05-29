# Data Quality — Validação, Contratos, Anomalias

## Índice
1. Framework de Data Quality
2. Checks Pré-Carga (Source)
3. Checks Pós-Carga (Destination)
4. Great Expectations
5. dbt Tests
6. Schema Contracts e Data Drift
7. Anomaly Detection
8. Alerting e Escalation

---

## 1. Framework de Data Quality

```
6 dimensões de qualidade de dados:

COMPLETENESS — Dados estão presentes?
  "email está preenchido em 99.5%+ dos registros?"

ACCURACY — Dados estão corretos?
  "preço -500 faz sentido? idade 200?"

CONSISTENCY — Dados batem entre sistemas?
  "count na origem = count no destino?"

TIMELINESS — Dados são recentes?
  "max(updated_at) é de hoje, não de semana passada?"

UNIQUENESS — Sem duplicatas?
  "order_id é único? ou tem duplicatas?"

VALIDITY — Dados seguem o formato esperado?
  "email tem @? CPF tem 11 dígitos? status é um dos enum válidos?"
```

---

## 2. Checks Pré-Carga (Source)

```python
# Validar ANTES de processar — rejeitar dados ruins na porta

def validate_source(df: pl.DataFrame, source_name: str) -> tuple[pl.DataFrame, list]:
    """Validar dados da fonte. Retorna (dados limpos, erros)."""
    errors = []
    original_count = len(df)

    # 1. Volume check — esperamos dados?
    if len(df) == 0:
        errors.append({'check': 'volume', 'severity': 'critical',
                       'message': f'{source_name}: 0 rows received'})
        return df, errors

    # 2. Volume anomaly — desvio > 50% do esperado?
    expected_min = get_expected_volume(source_name) * 0.5
    if len(df) < expected_min:
        errors.append({'check': 'volume_anomaly', 'severity': 'warning',
                       'message': f'{source_name}: {len(df)} rows (expected >= {expected_min})'})

    # 3. Schema check — campos obrigatórios existem?
    required_columns = get_required_schema(source_name)
    missing = set(required_columns) - set(df.columns)
    if missing:
        errors.append({'check': 'schema', 'severity': 'critical',
                       'message': f'Missing columns: {missing}'})
        return df, errors

    # 4. Null check em campos obrigatórios
    for col in ['id', 'created_at']:
        null_count = df.filter(pl.col(col).is_null()).height
        if null_count > 0:
            errors.append({'check': f'null_{col}', 'severity': 'high',
                           'message': f'{col}: {null_count} nulls ({null_count/len(df)*100:.1f}%)'})

    # 5. Freshness — dados são recentes?
    if 'created_at' in df.columns:
        max_date = df['created_at'].max()
        if max_date and (datetime.now() - max_date).days > 2:
            errors.append({'check': 'freshness', 'severity': 'warning',
                           'message': f'Most recent record: {max_date} (> 2 days old)'})

    # 6. Uniqueness — PKs únicas?
    pk_col = 'id'
    dupe_count = len(df) - df[pk_col].n_unique()
    if dupe_count > 0:
        errors.append({'check': 'uniqueness', 'severity': 'high',
                       'message': f'{dupe_count} duplicate {pk_col}s'})

    return df, errors
```

---

## 3. Checks Pós-Carga (Destination)

```sql
-- Rodar APÓS a carga para confirmar integridade

-- Check 1: Row count match (origem vs destino)
-- Se a diferença > 1%, ALERTAR
SELECT
    (SELECT COUNT(*) FROM staging_orders) AS source_count,
    (SELECT COUNT(*) FROM silver_orders WHERE date = CURRENT_DATE) AS dest_count,
    ABS(source_count - dest_count) AS diff,
    CASE WHEN ABS(source_count - dest_count) / GREATEST(source_count, 1) > 0.01
         THEN 'FAIL' ELSE 'PASS' END AS status;

-- Check 2: Null percentage em campos críticos
SELECT
    column_name,
    COUNT(*) FILTER (WHERE value IS NULL) AS null_count,
    ROUND(100.0 * COUNT(*) FILTER (WHERE value IS NULL) / COUNT(*), 2) AS null_pct
FROM silver_orders
UNPIVOT (value FOR column_name IN (user_id, status, total_cents))
GROUP BY column_name
HAVING null_pct > 1.0;  -- Alertar se > 1% null

-- Check 3: Aggregation sanity (soma bate?)
SELECT
    SUM(total_cents) AS total_revenue,
    COUNT(*) AS total_orders,
    AVG(total_cents) AS avg_order,
    -- Sanity: avg order entre R$10 e R$10.000?
    CASE WHEN AVG(total_cents) BETWEEN 1000 AND 1000000
         THEN 'PASS' ELSE 'FAIL' END AS avg_sanity;
```

---

## 4. Great Expectations

```python
# Great Expectations: framework de data quality para Python pipelines

import great_expectations as gx

context = gx.get_context()

# Definir expectativas
suite = context.add_expectation_suite("orders_suite")

# Schema
suite.add_expectation(gx.expectations.ExpectColumnToExist(column="id"))
suite.add_expectation(gx.expectations.ExpectColumnToExist(column="total_cents"))

# Tipos
suite.add_expectation(gx.expectations.ExpectColumnValuesToBeOfType(
    column="total_cents", type_="int"))

# Valores
suite.add_expectation(gx.expectations.ExpectColumnValuesToNotBeNull(column="id"))
suite.add_expectation(gx.expectations.ExpectColumnValuesToBeUnique(column="id"))
suite.add_expectation(gx.expectations.ExpectColumnValuesToBeBetween(
    column="total_cents", min_value=0, max_value=100000000))
suite.add_expectation(gx.expectations.ExpectColumnValuesToBeInSet(
    column="status", value_set=["pending", "paid", "shipped", "cancelled"]))

# Volume
suite.add_expectation(gx.expectations.ExpectTableRowCountToBeBetween(
    min_value=100, max_value=1000000))

# Rodar validação
results = context.run_checkpoint(checkpoint_name="orders_checkpoint")

if not results.success:
    failed = [r for r in results.results if not r.success]
    logger.error(f"Data quality check FAILED: {len(failed)} expectations failed")
    send_alert(failed)
    raise DataQualityError(f"{len(failed)} quality checks failed")
```

---

## 5. dbt Tests

```yaml
# models/silver/schema.yml — testes declarativos
version: 2
models:
  - name: silver_orders
    description: "Orders limpos e deduplicados"
    tests:
      - dbt_utils.recency:
          datepart: day
          field: created_at
          interval: 2  # Dados de no máximo 2 dias atrás
    columns:
      - name: id
        tests: [unique, not_null]
      - name: total_cents
        tests:
          - not_null
          - dbt_utils.accepted_range:
              min_value: 0
              inclusive: true
      - name: status
        tests:
          - accepted_values:
              values: ['pending', 'paid', 'shipped', 'cancelled', 'refunded']
      - name: user_id
        tests:
          - not_null
          - relationships:
              to: ref('silver_users')
              field: id
```

```sql
-- tests/assert_no_negative_revenue.sql (custom test)
-- Retorna rows que FALHAM — se retorna algo, teste falha
SELECT date_day, revenue_cents
FROM {{ ref('gold_daily_revenue') }}
WHERE revenue_cents < 0
```

---

## 6. Schema Contracts e Data Drift

```
Schema contract: acordo formal entre produtor e consumidor
sobre a estrutura dos dados. Se a fonte muda o schema sem avisar,
o pipeline DETECTA e ALERTA (ao invés de falhar silenciosamente).

Detectar drift:
├── Colunas novas (fonte adicionou campo)
├── Colunas removidas (fonte removeu campo)
├── Tipo mudou (era string, agora int)
├── Enum expandiu (novo valor de status)
├── Null behavior mudou (campo obrigatório agora vem null)
└── Volume pattern mudou (10K/dia → 100/dia)
```

```python
def check_schema_drift(df: pl.DataFrame, expected_schema: dict) -> list:
    """Detectar mudanças no schema vs contrato."""
    drifts = []
    actual_cols = set(df.columns)
    expected_cols = set(expected_schema.keys())

    # Colunas novas (pode ser ok, mas alertar)
    new_cols = actual_cols - expected_cols
    if new_cols:
        drifts.append({'type': 'new_columns', 'severity': 'info', 'columns': list(new_cols)})

    # Colunas removidas (PERIGO)
    missing_cols = expected_cols - actual_cols
    if missing_cols:
        drifts.append({'type': 'missing_columns', 'severity': 'critical', 'columns': list(missing_cols)})

    # Tipo mudou
    for col, expected_type in expected_schema.items():
        if col in df.columns:
            actual_type = str(df[col].dtype)
            if actual_type != expected_type:
                drifts.append({'type': 'type_change', 'severity': 'high',
                               'column': col, 'expected': expected_type, 'actual': actual_type})

    return drifts
```

---

## 7. Anomaly Detection

```python
# Detectar anomalias de volume com Z-score simples

def check_volume_anomaly(current_count: int, history: list[int], threshold: float = 2.0) -> dict:
    """Detectar se o volume de hoje é anômalo vs histórico."""
    if len(history) < 7:
        return {'anomaly': False, 'reason': 'Insufficient history'}

    mean = sum(history) / len(history)
    std = (sum((x - mean) ** 2 for x in history) / len(history)) ** 0.5

    if std == 0:
        return {'anomaly': current_count != mean, 'z_score': float('inf')}

    z_score = (current_count - mean) / std

    return {
        'anomaly': abs(z_score) > threshold,
        'z_score': round(z_score, 2),
        'current': current_count,
        'mean': round(mean, 0),
        'std': round(std, 0),
        'severity': 'critical' if abs(z_score) > 3 else 'warning' if abs(z_score) > 2 else 'ok',
    }

# Uso
history = get_daily_counts('orders', days=30)  # Últimos 30 dias
result = check_volume_anomaly(today_count, history)
if result['anomaly']:
    send_alert(f"Volume anomaly: {result}")
```

---

## 8. Alerting e Escalation

```
Severidades de data quality:

CRITICAL (pipeline PARA):
├── Schema break (colunas obrigatórias removidas)
├── 0 rows recebidas (fonte morta?)
├── PKs duplicadas no destino
└── Ação: parar pipeline, alertar on-call, NÃO carregar dados ruins

HIGH (pipeline continua, mas alerta):
├── Null rate > threshold em campo importante
├── Volume drop > 50%
├── Valores fora do range esperado
└── Ação: carregar, mas flag para revisão, alert no Slack

WARNING (logar, monitorar):
├── Schema drift (colunas novas)
├── Volume variação 20-50%
├── Freshness borderline
└── Ação: logar, dashboard, review semanal

INFO (apenas registrar):
├── Pipeline executou com sucesso
├── Métricas de volume e duração
├── Schema confirmado sem mudanças
└── Ação: log, dashboard
```
