# Orchestration — Airflow, Cron, Scheduling, Dependencies

## Índice
1. Escolha de Orquestrador
2. Airflow — DAGs e Patterns
3. Cron — Quando é Suficiente
4. Dagster — Modern Alternative
5. Backfill e Reprocessamento
6. Dependency Management
7. Error Handling e Retry

---

## 1. Escolha de Orquestrador

| Ferramenta | Complexidade | Quando usar |
|-----------|-------------|-------------|
| **Cron + Script** | Baixa | 1-5 jobs simples, sem dependências entre eles |
| **Airflow** | Alta | 10+ DAGs, dependências complexas, time de dados |
| **Dagster** | Média | Foco em data assets, tipagem forte, dev experience |
| **Prefect** | Média | Airflow-like mas mais moderno, cloud-native |
| **dbt Cloud** | Baixa | Apenas transformações SQL (sem extract/load) |
| **GitHub Actions** | Baixa | Jobs simples com schedule, já usa GitHub |

```
Regra prática:
├── < 5 jobs independentes → Cron
├── 5-20 jobs com dependências → Dagster ou Prefect
├── 20+ jobs, time de dados → Airflow
├── Apenas SQL transforms → dbt Cloud
└── Já tem CI/CD no GitHub → GitHub Actions com schedule
```

---

## 2. Airflow — DAGs e Patterns

### DAG Básica

```python
# dags/etl_orders.py
from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.operators.empty import EmptyOperator
from airflow.utils.dates import days_ago
from datetime import timedelta

default_args = {
    'owner': 'data-team',
    'depends_on_past': False,
    'email_on_failure': True,
    'email': ['data-alerts@company.com'],
    'retries': 3,
    'retry_delay': timedelta(minutes=5),
    'retry_exponential_backoff': True,
    'execution_timeout': timedelta(hours=1),
}

with DAG(
    dag_id='etl_orders_daily',
    default_args=default_args,
    description='ETL diário de pedidos: fonte → bronze → silver → gold',
    schedule='0 6 * * *',  # 6h UTC todo dia
    start_date=days_ago(7),
    catchup=True,  # Executar runs perdidos (backfill)
    max_active_runs=1,  # Não rodar em paralelo
    tags=['orders', 'daily', 'etl'],
) as dag:

    start = EmptyOperator(task_id='start')

    extract = PythonOperator(
        task_id='extract_orders',
        python_callable=extract_orders_from_source,
        op_kwargs={'date': '{{ ds }}'},  # Jinja template: data da execução
    )

    validate_source = PythonOperator(
        task_id='validate_source_data',
        python_callable=validate_source_quality,
        op_kwargs={'date': '{{ ds }}'},
    )

    transform_silver = PythonOperator(
        task_id='transform_to_silver',
        python_callable=transform_orders_silver,
        op_kwargs={'date': '{{ ds }}'},
    )

    transform_gold = PythonOperator(
        task_id='transform_to_gold',
        python_callable=transform_orders_gold,
        op_kwargs={'date': '{{ ds }}'},
    )

    validate_dest = PythonOperator(
        task_id='validate_destination',
        python_callable=validate_destination_quality,
        op_kwargs={'date': '{{ ds }}'},
    )

    notify = PythonOperator(
        task_id='notify_success',
        python_callable=send_success_notification,
        op_kwargs={'date': '{{ ds }}'},
    )

    end = EmptyOperator(task_id='end')

    # Dependências
    start >> extract >> validate_source >> transform_silver >> transform_gold >> validate_dest >> notify >> end
```

### Patterns de Airflow

```python
# Pattern 1: Branch (decisão condicional)
from airflow.operators.python import BranchPythonOperator

def choose_path(**context):
    row_count = context['ti'].xcom_pull(task_ids='extract')
    if row_count == 0:
        return 'skip_processing'  # Nada para processar
    return 'transform_silver'

branch = BranchPythonOperator(
    task_id='check_data',
    python_callable=choose_path,
)

# Pattern 2: Sensor (esperar condição)
from airflow.sensors.s3 import S3KeySensor

wait_for_file = S3KeySensor(
    task_id='wait_for_source_file',
    bucket_name='data-lake',
    bucket_key='raw/orders/{{ ds }}/*.parquet',
    timeout=3600,  # Esperar até 1 hora
    poke_interval=300,  # Checar a cada 5 minutos
)

# Pattern 3: TaskGroup (organizar steps complexos)
from airflow.utils.task_group import TaskGroup

with TaskGroup('quality_checks') as quality:
    check_nulls = PythonOperator(task_id='check_nulls', ...)
    check_volume = PythonOperator(task_id='check_volume', ...)
    check_freshness = PythonOperator(task_id='check_freshness', ...)
    [check_nulls, check_volume, check_freshness]  # Paralelo

extract >> quality >> transform
```

---

## 3. Cron — Quando é Suficiente

```bash
# Cron é suficiente para jobs simples e independentes.
# Não tem: dependências, retry, UI, backfill, XCom.
# Tem: simplicidade, zero infra, confiabilidade de 50 anos.

# crontab -e
# ┌───── minuto (0-59)
# │ ┌───── hora (0-23)
# │ │ ┌───── dia do mês (1-31)
# │ │ │ ┌───── mês (1-12)
# │ │ │ │ ┌───── dia da semana (0-6, 0=domingo)

# ETL diário às 6h
0 6 * * * /app/scripts/etl_orders.sh >> /var/log/etl/orders.log 2>&1

# Sync horário (a cada hora, minuto 15)
15 * * * * /app/scripts/sync_products.sh >> /var/log/etl/products.log 2>&1

# Relatório semanal (segunda 8h)
0 8 * * 1 /app/scripts/weekly_report.sh >> /var/log/etl/weekly.log 2>&1

# Limpeza mensal (dia 1, 3h)
0 3 1 * * /app/scripts/cleanup_old_data.sh >> /var/log/etl/cleanup.log 2>&1
```

```bash
#!/bin/bash
# /app/scripts/etl_orders.sh — Script de ETL robusto para Cron

set -euo pipefail  # Fail on error, undefined vars, pipe failures

DATE=${1:-$(date -d "yesterday" +%Y-%m-%d)}
LOG_PREFIX="[ETL-ORDERS][${DATE}]"
LOCK_FILE="/tmp/etl_orders.lock"

# Evitar execução dupla
if [ -f "$LOCK_FILE" ]; then
    echo "${LOG_PREFIX} Already running (lock file exists). Exiting."
    exit 0
fi
trap "rm -f $LOCK_FILE" EXIT
touch "$LOCK_FILE"

echo "${LOG_PREFIX} Starting extraction..."
python /app/etl/extract_orders.py --date "$DATE" || {
    echo "${LOG_PREFIX} EXTRACTION FAILED" >&2
    # Enviar alerta
    curl -X POST "$SLACK_WEBHOOK" -d "{\"text\":\"❌ ETL Orders FAILED: extraction for $DATE\"}"
    exit 1
}

echo "${LOG_PREFIX} Starting transformation..."
python /app/etl/transform_orders.py --date "$DATE" || {
    echo "${LOG_PREFIX} TRANSFORMATION FAILED" >&2
    curl -X POST "$SLACK_WEBHOOK" -d "{\"text\":\"❌ ETL Orders FAILED: transform for $DATE\"}"
    exit 1
}

echo "${LOG_PREFIX} Completed successfully."
curl -X POST "$SLACK_WEBHOOK" -d "{\"text\":\"✅ ETL Orders completed for $DATE\"}"
```

---

## 4. Dagster — Modern Alternative

```python
# Dagster: foco em "data assets" ao invés de "tasks"
# Um asset = um dado que seu pipeline produz

from dagster import asset, AssetExecutionContext, Definitions
import polars as pl

@asset(
    description="Orders extraídos da fonte (bronze)",
    group_name="bronze",
    metadata={"source": "production_db", "freshness_policy": "daily"},
)
def bronze_orders(context: AssetExecutionContext) -> pl.DataFrame:
    """Extrair orders do banco de produção."""
    df = extract_from_source('orders')
    context.log.info(f"Extracted {len(df)} orders")
    return df

@asset(
    description="Orders limpos e deduplicados (silver)",
    group_name="silver",
    deps=[bronze_orders],  # Depende de bronze
)
def silver_orders(context: AssetExecutionContext, bronze_orders: pl.DataFrame) -> pl.DataFrame:
    """Limpar, tipar e deduplicar orders."""
    cleaned = (
        bronze_orders
        .unique(subset=['id'], keep='last')
        .filter(pl.col('id').is_not_null())
        .with_columns(pl.col('total').cast(pl.Int64))
    )
    context.log.info(f"Silver orders: {len(cleaned)} rows (from {len(bronze_orders)})")
    return cleaned

@asset(
    description="Receita diária agregada (gold)",
    group_name="gold",
    deps=[silver_orders],
)
def gold_daily_revenue(context: AssetExecutionContext, silver_orders: pl.DataFrame) -> pl.DataFrame:
    """Agregar receita por dia."""
    return (
        silver_orders
        .filter(pl.col('status') == 'paid')
        .group_by(pl.col('created_at').dt.date().alias('date'))
        .agg(pl.col('total').sum().alias('revenue'), pl.count().alias('orders'))
    )

defs = Definitions(assets=[bronze_orders, silver_orders, gold_daily_revenue])
```

---

## 5. Backfill e Reprocessamento

```
Backfill: re-executar o pipeline para datas passadas.

Cenários:
├── Bug no transform → corrigir → reprocessar últimos 30 dias
├── Nova coluna adicionada → backfill para preencher historicamente
├── Fonte mandou dados atrasados → processar dias retroativos
├── Mudança de lógica de negócio → reprocessar tudo
└── Primeiro deploy → processar todo histórico

Requisitos para backfill funcionar:
├── Pipeline é idempotente (re-rodar não duplica)
├── Pipeline aceita parâmetro de data (não hardcoded para "ontem")
├── Dados raw/bronze estão preservados (não foram deletados)
├── Destino suporta replace por partição (não append cego)
└── Timeout adequado (backfill de 1 ano ≠ run diária)
```

```bash
# Airflow: backfill de 30 dias
airflow dags backfill etl_orders_daily \
  --start-date 2025-02-01 \
  --end-date 2025-03-01 \
  --reset-dagruns  # Resetar runs existentes
```

---

## 6. Dependency Management

```
Dependências entre pipelines:

1. Intra-DAG (dentro da mesma DAG):
   extract >> validate >> transform >> load
   → Airflow task dependencies

2. Inter-DAG (entre DAGs diferentes):
   DAG orders precisa que DAG users tenha rodado primeiro
   → ExternalTaskSensor ou Dataset triggers (Airflow 2.4+)

3. Cross-system (entre sistemas):
   Pipeline de ETL precisa que backup do DB tenha completado
   → Sensor (S3, HTTP), ou evento via API/queue
```

```python
# Airflow: Dataset trigger (DAG A produz dataset, DAG B consome)
from airflow import Dataset

orders_dataset = Dataset('s3://lake/silver/orders')

# DAG A: produz o dataset
with DAG('etl_orders', schedule='0 6 * * *') as dag_a:
    load_orders = PythonOperator(
        task_id='load_orders',
        python_callable=load_orders_fn,
        outlets=[orders_dataset],  # Marca que produz este dataset
    )

# DAG B: roda quando o dataset é atualizado
with DAG('analytics_daily', schedule=[orders_dataset]) as dag_b:
    # Roda automaticamente quando orders_dataset é atualizado
    build_report = PythonOperator(task_id='build_report', ...)
```

---

## 7. Error Handling e Retry

```python
# Airflow: retry configuração
default_args = {
    'retries': 3,                              # 3 tentativas
    'retry_delay': timedelta(minutes=5),       # 5 min entre retries
    'retry_exponential_backoff': True,         # 5 → 10 → 20 min
    'max_retry_delay': timedelta(minutes=60),  # Máximo 1 hora
    'execution_timeout': timedelta(hours=2),   # Matar se > 2h
    'on_failure_callback': alert_on_failure,   # Alertar quando falha
    'on_retry_callback': log_retry,            # Logar cada retry
}

def alert_on_failure(context):
    """Callback de falha: enviar alerta com contexto."""
    task = context['task_instance']
    send_slack_alert(
        channel='#data-alerts',
        message=f"❌ Pipeline FAILED\n"
                f"DAG: {task.dag_id}\n"
                f"Task: {task.task_id}\n"
                f"Execution: {context['execution_date']}\n"
                f"Error: {context.get('exception', 'Unknown')}\n"
                f"Logs: {task.log_url}",
    )
```
