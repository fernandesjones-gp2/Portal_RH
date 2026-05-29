# Extraction Patterns — CDC, Incremental, APIs, Files

## Índice
1. Estratégias de Extração
2. Full Dump vs Incremental
3. Change Data Capture (CDC)
4. Extração de APIs
5. Extração de Arquivos
6. Idempotência na Extração
7. Error Handling e Retry

---

## 1. Estratégias de Extração

```
O tipo de extração DEPENDE da fonte e do volume:

Fonte              Volume    Estratégia primária       Alternativa
─────────────────────────────────────────────────────────────────
DB relacional      Pequeno   Full dump (< 100K rows)   Incremental
DB relacional      Grande    Incremental por timestamp  CDC
MongoDB            Qualquer  Change streams (CDC)       Incremental
API REST           Qualquer  Polling incremental        Webhooks
API com Webhook    Qualquer  Webhook → Queue → Process  Polling backup
Arquivos (S3/SFTP) Qualquer  List + compare + download  Event trigger
Kafka/SQS          Qualquer  Consumer group             -
SaaS (Stripe, etc) Qualquer  Fivetran/Airbyte           API manual
```

---

## 2. Full Dump vs Incremental

### Full Dump

```python
# Toda execução extrai TUDO. Simples, seguro, lento.

def extract_full(conn, table: str, output_path: str):
    """Full extraction — todos os registros."""
    query = f"SELECT * FROM {table}"
    df = pd.read_sql(query, conn)

    # Salvar com metadata de extração
    df['_extracted_at'] = datetime.utcnow().isoformat()
    df['_extraction_type'] = 'full'

    df.to_parquet(output_path, index=False)
    logger.info(f"Full extract: {len(df)} rows from {table}")
    return len(df)

# Quando usar:
# ├── Tabela pequena (< 100K rows)
# ├── Tabela sem campo de timestamp confiável
# ├── Dados que mudam de forma imprevisível (deletes sem soft delete)
# ├── Primeira carga (bootstrap)
# └── Backfill / reprocessamento
```

### Incremental

```python
# Extrai apenas registros novos ou modificados desde último checkpoint.

def extract_incremental(conn, table: str, output_path: str, state: dict):
    """Incremental extraction por updated_at."""
    last_extracted = state.get('last_updated_at', '1970-01-01T00:00:00Z')

    query = f"""
        SELECT * FROM {table}
        WHERE updated_at > %(last)s
        ORDER BY updated_at ASC
    """
    df = pd.read_sql(query, conn, params={'last': last_extracted})

    if df.empty:
        logger.info(f"No new rows in {table} since {last_extracted}")
        return 0

    # Salvar
    df['_extracted_at'] = datetime.utcnow().isoformat()
    df['_extraction_type'] = 'incremental'
    df.to_parquet(output_path, index=False)

    # Atualizar checkpoint
    new_checkpoint = df['updated_at'].max().isoformat()
    state['last_updated_at'] = new_checkpoint
    save_state(state)

    logger.info(f"Incremental extract: {len(df)} rows, checkpoint: {new_checkpoint}")
    return len(df)

# Requisitos:
# ├── Campo updated_at confiável (atualizado em TODA modificação)
# ├── Campo indexado (senão, query lenta em tabela grande)
# ├── Nunca perde dados? → Cuidado com deletes (não capturados!)
# └── Clock drift entre servers? → Usar overlap safety margin
```

### Overlap Safety Margin

```python
# Problema: se o clock do DB tem 2s de drift, registros podem ser perdidos.
# Solução: extrair com overlap — pegar 5 min antes do checkpoint.

safety_margin = timedelta(minutes=5)
safe_checkpoint = last_extracted - safety_margin

query = f"SELECT * FROM {table} WHERE updated_at > %(last)s"
# Dedup no destino via UPSERT para eliminar o overlap
```

---

## 3. Change Data Capture (CDC)

```
CDC: captura CADA mudança no banco (INSERT, UPDATE, DELETE) via WAL/binlog.
É o método mais confiável — nunca perde dados, captura deletes.

PostgreSQL: Logical replication / Debezium
MySQL: Binlog / Debezium
MongoDB: Change Streams

Arquitetura típica:
  DB → Debezium (connector) → Kafka → Consumer → Data Lake/Warehouse

Vantagens:
├── Captura deletes (incremental por timestamp não captura)
├── Baixa latência (near real-time)
├── Não sobrecarrega o DB com queries pesadas
├── Exato — captura toda mudança, não amostra
└── Inclui before/after state (para SCD)

Desvantagens:
├── Mais complexo de configurar (Debezium + Kafka)
├── Schema changes precisam de handling especial
├── WAL retention tem limite (se consumer ficar offline muito tempo)
└── Custo de infra (Kafka cluster, Debezium, storage)
```

```yaml
# Debezium connector config (PostgreSQL → Kafka)
{
  "name": "pg-orders-cdc",
  "config": {
    "connector.class": "io.debezium.connector.postgresql.PostgresConnector",
    "database.hostname": "db-host",
    "database.port": "5432",
    "database.user": "cdc_user",
    "database.password": "${SECRETS:db_password}",
    "database.dbname": "production",
    "table.include.list": "public.orders,public.order_items,public.users",
    "topic.prefix": "cdc",
    "plugin.name": "pgoutput",
    "slot.name": "debezium_slot",
    "publication.name": "cdc_publication",
    "snapshot.mode": "initial"
  }
}
# Produz events em topics: cdc.public.orders, cdc.public.users, etc.
```

---

## 4. Extração de APIs

```python
# Patterns essenciais: pagination, rate limiting, retry, checkpoint

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=2, max=30))
def fetch_page(client: httpx.Client, url: str, params: dict) -> dict:
    """Fetch com retry automático e exponential backoff."""
    response = client.get(url, params=params, timeout=30)
    response.raise_for_status()
    return response.json()

def extract_api_paginated(base_url: str, api_key: str, state: dict):
    """Extração paginada com checkpoint."""
    results = []
    cursor = state.get('cursor', None)
    page = 0

    with httpx.Client(headers={'Authorization': f'Bearer {api_key}'}) as client:
        while True:
            params = {'limit': 100}
            if cursor:
                params['starting_after'] = cursor

            data = fetch_page(client, base_url, params)

            if not data.get('data'):
                break

            results.extend(data['data'])
            cursor = data['data'][-1]['id']
            page += 1

            # Checkpoint intermediário (a cada 10 páginas)
            if page % 10 == 0:
                state['cursor'] = cursor
                save_state(state)
                logger.info(f"Checkpoint: page {page}, cursor {cursor}")

            # Rate limiting (respeitar headers)
            if 'X-RateLimit-Remaining' in data.headers:
                remaining = int(data.headers['X-RateLimit-Remaining'])
                if remaining < 5:
                    time.sleep(10)

            # Sem próxima página
            if not data.get('has_more', False):
                break

    state['cursor'] = cursor
    save_state(state)
    return results

# Tipos de paginação que APIs usam:
# ├── Offset: ?page=3&limit=100 (simples, inconsistente se dados mudam)
# ├── Cursor: ?after=abc123 (recomendado, consistente)
# ├── Keyset: ?created_after=2025-01-01 (bom para incremental)
# └── Link header: next_url no response (seguir links)
```

---

## 5. Extração de Arquivos

```python
# S3: listar, filtrar novos, baixar e processar

import boto3
from datetime import datetime

def extract_new_files(bucket: str, prefix: str, state: dict) -> list:
    """Extrair apenas arquivos novos do S3."""
    s3 = boto3.client('s3')
    last_processed = state.get('last_file_key', '')
    processed_keys = set(state.get('processed_keys', []))

    # Listar arquivos
    paginator = s3.get_paginator('list_objects_v2')
    new_files = []

    for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
        for obj in page.get('Contents', []):
            key = obj['Key']
            if key not in processed_keys and key.endswith(('.csv', '.parquet', '.json')):
                new_files.append({'key': key, 'size': obj['Size'], 'modified': obj['LastModified']})

    # Processar cada arquivo
    for file_info in sorted(new_files, key=lambda f: f['modified']):
        try:
            process_file(bucket, file_info['key'])
            processed_keys.add(file_info['key'])
            state['processed_keys'] = list(processed_keys)[-1000:]  # Manter últimos 1000
            save_state(state)
        except Exception as e:
            logger.error(f"Failed to process {file_info['key']}: {e}")
            raise  # Fail fast — não pular arquivos com erro

    return new_files

# Alternativa: S3 Event Notification → SQS → Lambda/Worker
# Mais eficiente que polling (event-driven, near real-time)
```

---

## 6. Idempotência na Extração

```
Problema: pipeline falha no meio → rerodar → DUPLICATAS!

Soluções por tipo de destino:

Arquivo (S3/GCS):
  ✅ Sobrescrever arquivo da partição inteira
  ✅ Nome de arquivo determinístico (data + source + hash)
  ❌ Append sem dedup (gera duplicatas)

Banco (PostgreSQL/Warehouse):
  ✅ UPSERT (INSERT ON CONFLICT UPDATE)
  ✅ DELETE + INSERT por partição (staging → swap)
  ✅ MERGE (SQL Standard)
  ❌ INSERT direto (duplicatas se rerodar)

Queue/Stream:
  ✅ Consumer offset tracking (Kafka consumer groups)
  ✅ Dedup por message ID no consumer
  ❌ Processar sem tracking de offset
```

```python
# Pattern: staging table → merge → produção
def load_idempotent(df, conn, target_table: str, key_columns: list, partition_date: str):
    """Carga idempotente via staging + merge."""
    staging_table = f"staging_{target_table}_{partition_date.replace('-', '')}"

    # 1. Criar staging table temporária
    conn.execute(f"CREATE TEMP TABLE {staging_table} (LIKE {target_table})")

    # 2. Carregar dados no staging
    df.to_sql(staging_table, conn, if_exists='append', index=False)

    # 3. Merge: upsert do staging para produção
    key_match = ' AND '.join([f"target.{k} = staging.{k}" for k in key_columns])
    update_cols = [c for c in df.columns if c not in key_columns]
    update_set = ', '.join([f"{c} = EXCLUDED.{c}" for c in update_cols])

    conn.execute(f"""
        INSERT INTO {target_table}
        SELECT * FROM {staging_table}
        ON CONFLICT ({', '.join(key_columns)})
        DO UPDATE SET {update_set}
    """)

    # 4. Limpar staging
    conn.execute(f"DROP TABLE IF EXISTS {staging_table}")
```

---

## 7. Error Handling e Retry

```python
# Princípios:
# ├── Retry com backoff para erros transitórios (timeout, rate limit, 5xx)
# ├── Fail fast para erros permanentes (404, auth, schema mismatch)
# ├── Dead letter queue para registros individuais que falham
# └── Circuit breaker se a fonte está consistentemente falhando

from tenacity import (
    retry, stop_after_attempt, wait_exponential,
    retry_if_exception_type
)

TRANSIENT_ERRORS = (httpx.TimeoutException, httpx.HTTPStatusError, ConnectionError)

@retry(
    retry=retry_if_exception_type(TRANSIENT_ERRORS),
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=2, min=4, max=60),
    before_sleep=lambda state: logger.warning(f"Retry {state.attempt_number}/3: {state.outcome.exception()}")
)
def fetch_with_retry(client, url, params):
    response = client.get(url, params=params)
    if response.status_code == 429:
        retry_after = int(response.headers.get('Retry-After', 30))
        time.sleep(retry_after)
        raise httpx.HTTPStatusError("Rate limited", request=response.request, response=response)
    response.raise_for_status()
    return response.json()

# Dead Letter para registros individuais
def process_batch_with_dlq(records: list, process_fn, dlq: list):
    """Processar batch, enviar falhas individuais para DLQ."""
    successes = 0
    for record in records:
        try:
            process_fn(record)
            successes += 1
        except Exception as e:
            logger.error(f"Record failed: {record.get('id')}: {e}")
            dlq.append({'record': record, 'error': str(e), 'timestamp': datetime.utcnow()})

    logger.info(f"Batch: {successes}/{len(records)} succeeded, {len(records)-successes} to DLQ")
```
