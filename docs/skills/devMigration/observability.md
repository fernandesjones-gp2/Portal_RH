# Observability — Logging, Métricas, Lineage, SLAs

## Índice
1. Pipeline Observability Stack
2. Logging Estruturado
3. Métricas Essenciais
4. Data Lineage
5. SLAs e SLOs de Dados
6. Dashboards de Pipeline
7. Incident Response para Dados

---

## 1. Pipeline Observability Stack

```
Observabilidade responde 3 perguntas:

1. O pipeline RODOU? (scheduling, execution status)
2. O pipeline FUNCIONOU? (quality checks, row counts, timing)
3. Os dados estão CORRETOS? (quality scores, anomalias, freshness)

Stack:
├── Orquestrador (Airflow UI, Dagster UI) → Execução
├── Logging (structured JSON) → Debug
├── Métricas (Prometheus/Datadog) → Alerting
├── Data Catalog (DataHub, OpenMetadata) → Lineage
└── Quality Dashboard → Confiança
```

---

## 2. Logging Estruturado

```python
import structlog
from datetime import datetime

logger = structlog.get_logger()

class PipelineLogger:
    """Logger com contexto de pipeline."""

    def __init__(self, pipeline_name: str, run_id: str, run_date: str):
        self.log = logger.bind(
            pipeline=pipeline_name,
            run_id=run_id,
            run_date=run_date,
        )
        self.metrics = {
            'start_time': datetime.utcnow(),
            'rows_extracted': 0,
            'rows_loaded': 0,
            'rows_rejected': 0,
            'quality_checks_passed': 0,
            'quality_checks_failed': 0,
        }

    def step_start(self, step: str, **kwargs):
        self.log.info('Step started', step=step, **kwargs)
        self._step_start = datetime.utcnow()

    def step_end(self, step: str, rows: int = 0, **kwargs):
        duration = (datetime.utcnow() - self._step_start).total_seconds()
        self.log.info('Step completed', step=step, rows=rows,
                      duration_seconds=round(duration, 2), **kwargs)

    def step_failed(self, step: str, error: str, **kwargs):
        duration = (datetime.utcnow() - self._step_start).total_seconds()
        self.log.error('Step FAILED', step=step, error=error,
                       duration_seconds=round(duration, 2), **kwargs)

    def summary(self):
        """Log de resumo da execução."""
        total_duration = (datetime.utcnow() - self.metrics['start_time']).total_seconds()
        self.log.info('Pipeline completed', **self.metrics,
                      total_duration_seconds=round(total_duration, 2))
        return self.metrics

# Uso
log = PipelineLogger('etl_orders', run_id='run-abc-123', run_date='2025-03-15')
log.step_start('extract')
rows = extract_orders()
log.metrics['rows_extracted'] = rows
log.step_end('extract', rows=rows)
```

---

## 3. Métricas Essenciais

```
Métricas por pipeline:

EXECUÇÃO:
├── pipeline_duration_seconds — Quanto demorou?
├── pipeline_status — success | failed | running
├── pipeline_last_success_at — Quando rodou com sucesso pela última vez?
├── pipeline_retries — Quantos retries foram necessários?
└── pipeline_runs_today — Quantas vezes rodou hoje?

DADOS:
├── rows_extracted — Quantas rows extraíram?
├── rows_loaded — Quantas carregaram?
├── rows_rejected — Quantas foram rejeitadas por qualidade?
├── data_freshness_hours — Há quanto tempo os dados foram atualizados?
├── null_rate_by_column — % de nulls em cada coluna
└── duplicate_rate — % de duplicatas detectadas

QUALIDADE:
├── quality_checks_total — Total de checks executados
├── quality_checks_failed — Quantos falharam?
├── quality_score — Score composto (0-100)
├── schema_drift_detected — Mudança de schema detectada?
└── volume_anomaly_detected — Volume anômalo?
```

```python
# Exportar métricas para Prometheus / Datadog

from prometheus_client import Counter, Gauge, Histogram, Summary

# Counters (acumulativos)
rows_extracted = Counter('pipeline_rows_extracted_total',
    'Total rows extracted', ['pipeline', 'source'])
rows_loaded = Counter('pipeline_rows_loaded_total',
    'Total rows loaded', ['pipeline', 'destination'])
quality_failures = Counter('pipeline_quality_failures_total',
    'Quality check failures', ['pipeline', 'check_type'])

# Gauges (valor atual)
data_freshness = Gauge('pipeline_data_freshness_hours',
    'Hours since last data update', ['pipeline', 'table'])
last_success = Gauge('pipeline_last_success_timestamp',
    'Timestamp of last successful run', ['pipeline'])

# Histograms (distribuição)
pipeline_duration = Histogram('pipeline_duration_seconds',
    'Pipeline execution duration', ['pipeline'],
    buckets=[60, 300, 600, 1800, 3600])

# Uso no pipeline
rows_extracted.labels(pipeline='orders', source='postgres').inc(15000)
pipeline_duration.labels(pipeline='orders').observe(342.5)
data_freshness.labels(pipeline='orders', table='silver_orders').set(0.5)
```

---

## 4. Data Lineage

```
Lineage responde: "De onde veio esse dado? Quem consome?"

Exemplo:
  production.orders → bronze.orders → silver.orders → gold.daily_revenue
                                    → gold.customer_ltv
                                    → dashboard.revenue

Por que importa:
├── Bug num campo → Quais dashboards são afetados?
├── Coluna vai ser removida → Quem consome?
├── Dado parece errado → Qual transformação causou?
├── Compliance (LGPD) → Onde esse CPF transita?
└── Impact analysis → Se mudar isso, o que quebra?
```

```yaml
# Lineage via dbt (automática — dbt gera o grafo)
# dbt docs generate → abre graph de dependências

# Lineage manual (quando não usa dbt)
# Documentar em YAML:
lineage:
  bronze_orders:
    source: production.public.orders
    extraction: CDC via Debezium
    consumers: [silver_orders]

  silver_orders:
    source: bronze_orders
    transformation: dedup, type casting, null handling
    consumers: [gold_daily_revenue, gold_customer_ltv]

  gold_daily_revenue:
    source: silver_orders
    transformation: aggregate by date, filter paid
    consumers: [dashboard.revenue, report.weekly_sales]
```

---

## 5. SLAs e SLOs de Dados

```
SLA (Service Level Agreement):
  Contrato com consumidores sobre QUANDO e COM QUE QUALIDADE
  os dados estarão disponíveis.

SLO (Service Level Objective):
  Meta interna que sustenta o SLA.

Exemplos:

Pipeline: ETL Orders Daily
├── SLO Freshness: dados disponíveis até 7h UTC (1h após run das 6h)
├── SLO Completeness: >= 99.5% de registros com campos obrigatórios
├── SLO Accuracy: row count divergência < 0.1% vs fonte
├── SLO Uptime: >= 99% das runs executam com sucesso
└── SLA: Dashboard de vendas atualizado até 8h BRT todo dia útil

Se SLO é violado:
├── Alerta automático no Slack/PagerDuty
├── On-call investiga em até 30 minutos
├── Se SLA está em risco: escalar para lead
├── Post-mortem se SLA foi violado
└── Action items para prevenir recorrência
```

---

## 6. Dashboards de Pipeline

```
Dashboard mínimo (tela única):

┌──────────────────────────────────────────────────────────┐
│ DATA PIPELINE HEALTH                    Last updated: now │
├────────────────────┬─────────────────────────────────────┤
│ PIPELINES          │ STATUS                              │
│ etl_orders         │ ✅ Success (6:42 UTC, 342s)         │
│ etl_users          │ ✅ Success (6:15 UTC, 89s)          │
│ etl_payments       │ ❌ FAILED (6:50 UTC, retry 2/3)     │
│ sync_products      │ ⏳ Running (started 7:00 UTC)       │
├────────────────────┼─────────────────────────────────────┤
│ DATA FRESHNESS     │                                     │
│ silver_orders      │ 🟢 0.5h ago                         │
│ silver_users       │ 🟢 1.2h ago                         │
│ gold_daily_revenue │ 🟡 3.5h ago (threshold: 4h)        │
│ gold_customer_ltv  │ 🔴 26h ago (STALE!)                 │
├────────────────────┼─────────────────────────────────────┤
│ QUALITY SCORE      │ Today: 94/100 (yesterday: 97)       │
│ Checks passed      │ 142/150                             │
│ Checks failed      │ 8 (3 critical, 5 warning)           │
│ Volume anomalies   │ 1 (etl_payments: -40% vs avg)       │
└────────────────────┴─────────────────────────────────────┘
```

---

## 7. Incident Response para Dados

```markdown
# Playbook: Pipeline Falhou

## Severidade
- P1 (CRITICAL): Dashboard de receita está down / dados incorretos visíveis
- P2 (HIGH): Pipeline falhou, dados stale mas não incorretos
- P3 (MEDIUM): Warning de qualidade, pipeline rodou mas com issues

## Steps
1. Verificar logs do run no Airflow UI (link: ...)
2. Identificar qual STEP falhou (extract? transform? load?)
3. Se extract:
   - Fonte está online? (healthcheck da API/DB)
   - Credenciais válidas? (rotação de secret recente?)
   - Rate limited? (verificar response headers)
4. Se transform:
   - Schema mudou na fonte? (drift detection logs)
   - Dados inesperados? (nulls, tipos, volume)
   - Memória insuficiente? (OOM no worker)
5. Se load:
   - Destino está online? (warehouse health)
   - Espaço em disco? (storage quota)
   - Lock/conflito? (outra query bloqueando)
6. Retry manual: `airflow dags trigger etl_orders --conf '{"date":"2025-03-14"}'`
7. Se persistir: escalar para lead de dados
8. Comunicar stakeholders se SLA em risco
```
