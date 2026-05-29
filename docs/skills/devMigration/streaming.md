# Streaming — Kafka, Event-Driven, Real-Time

## Índice
1. Batch vs Stream — Quando Cada Um
2. Kafka — Conceitos e Patterns
3. Event-Driven Architecture
4. Delivery Guarantees
5. Windowing e Aggregation
6. Stream Processing Frameworks
7. Hybrid: Lambda e Kappa Architecture

---

## 1. Batch vs Stream — Quando Cada Um

```
BATCH (processar em lote, schedule):
├── Dados históricos, relatórios, analytics
├── Latência aceitável: minutos a horas
├── Volume grande processado de uma vez
├── Mais simples de debugar e reprocessar
├── Mais barato (compute sob demanda)
└── Exemplos: ETL diário, relatórios, ML training

STREAM (processar evento a evento, contínuo):
├── Eventos que precisam de ação imediata
├── Latência requerida: segundos
├── Processamento contínuo (24/7)
├── Mais complexo (ordering, exactly-once, state)
├── Mais caro (compute sempre ligado)
└── Exemplos: fraude real-time, notificações, dashboards live

NEAR REAL-TIME (micro-batch):
├── Latência: 1-15 minutos
├── Batch pequeno e frequente (a cada 5 min)
├── Mais simples que streaming puro
├── Suficiente para 90% dos "preciso em tempo real"
└── Exemplos: metrics dashboard, inventory sync, search index update

Regra:
├── "Precisa em tempo real" → Realmente? Ou 5 minutos serve?
├── Se 5 minutos serve → micro-batch (muito mais simples)
├── Se precisa em < 30 segundos → streaming
└── Se é analytics/report → batch (por definição retroativo)
```

---

## 2. Kafka — Conceitos e Patterns

```
Kafka: plataforma de streaming distribuído.
Produtores publicam EVENTOS em TOPICS.
Consumidores leem eventos dos topics.
Eventos são persistidos (replay possível).

Conceitos:
├── Topic: canal de eventos (ex: "orders", "payments")
├── Partition: subdivisão do topic (paralelismo)
├── Offset: posição do consumidor na partição
├── Consumer Group: grupo de consumidores que divide as partições
├── Producer: quem publica eventos
├── Consumer: quem lê eventos
└── Retention: quanto tempo manter eventos (7 dias default)

Partition key: determina em qual partição o evento vai.
  Eventos com mesma key → mesma partição → ordem garantida.
  key = user_id → todos eventos do mesmo user em ordem.
```

```python
# Produtor Kafka (Python + confluent-kafka)
from confluent_kafka import Producer
import json

producer = Producer({
    'bootstrap.servers': 'kafka:9092',
    'acks': 'all',                    # Esperar confirmação de todas replicas
    'enable.idempotence': True,       # Garantir exactly-once no producer
    'retries': 5,
    'retry.backoff.ms': 1000,
})

def publish_event(topic: str, key: str, event: dict):
    """Publicar evento no Kafka."""
    producer.produce(
        topic=topic,
        key=key.encode('utf-8'),
        value=json.dumps(event).encode('utf-8'),
        callback=delivery_report,
    )
    producer.flush()  # Garantir envio

def delivery_report(err, msg):
    if err:
        logger.error(f'Delivery failed: {err}')
    else:
        logger.debug(f'Delivered to {msg.topic()}[{msg.partition()}] @ offset {msg.offset()}')

# Publicar evento de order
publish_event('orders', key=order.user_id, event={
    'event_type': 'order.created',
    'order_id': order.id,
    'user_id': order.user_id,
    'total_cents': order.total,
    'created_at': order.created_at.isoformat(),
})
```

```python
# Consumidor Kafka
from confluent_kafka import Consumer

consumer = Consumer({
    'bootstrap.servers': 'kafka:9092',
    'group.id': 'order-processor',
    'auto.offset.reset': 'earliest',
    'enable.auto.commit': False,       # Commit manual (controle)
    'max.poll.interval.ms': 300000,
})

consumer.subscribe(['orders'])

try:
    while True:
        msg = consumer.poll(timeout=1.0)
        if msg is None:
            continue
        if msg.error():
            logger.error(f'Consumer error: {msg.error()}')
            continue

        event = json.loads(msg.value().decode('utf-8'))

        try:
            process_order_event(event)
            consumer.commit(message=msg)  # Commit APÓS processar
        except Exception as e:
            logger.error(f'Failed to process: {e}')
            # Não commit → vai reprocessar no próximo poll
            send_to_dlq(event, str(e))
finally:
    consumer.close()
```

---

## 3. Event-Driven Architecture

```
Eventos como "fonte da verdade":

Tradicional (request/response):
  Service A → HTTP POST → Service B
  Acoplamento direto. A precisa saber de B.

Event-driven:
  Service A → Publica evento no Kafka → Service B, C, D consomem
  Desacoplado. A não sabe quem consome.

Vantagens:
├── Desacoplamento (adicionar consumidores sem mudar produtor)
├── Replay (reprocessar eventos do passado)
├── Audit trail (log de tudo que aconteceu)
├── Escalabilidade (consumidores independentes)
└── Resiliência (consumidor pode estar down temporariamente)

Desvantagens:
├── Complexidade (consistência eventual, ordering)
├── Debugging mais difícil (fluxo distribuído)
├── Infra adicional (Kafka cluster, monitoring)
└── Latência não-zero (não é RPC)
```

---

## 4. Delivery Guarantees

```
At-Most-Once: evento processado 0 ou 1 vez (pode perder)
  Commit offset ANTES de processar.
  Se crash após commit, evento é perdido.
  Uso: métricas onde perder 0.01% é aceitável.

At-Least-Once: evento processado 1 ou mais vezes (pode duplicar)
  Commit offset DEPOIS de processar.
  Se crash após processar mas antes do commit, reprocessa.
  Uso: maioria dos casos (com dedup no consumidor).

Exactly-Once: evento processado exatamente 1 vez
  Transação atômica: processar + commit offset + write resultado.
  Kafka Transactions (EOS) ou dedup no consumidor.
  Uso: financeiro, contadores exatos.
```

```python
# At-Least-Once + Idempotência = Effectively Exactly-Once

def process_order_event(event: dict):
    """Processar evento de order de forma idempotente."""
    order_id = event['order_id']

    # Verificar se já processou (dedup)
    if redis.exists(f'processed:order:{order_id}'):
        logger.info(f'Already processed order {order_id}, skipping')
        return

    # Processar
    update_analytics(event)
    update_inventory(event)

    # Marcar como processado (TTL = retention do Kafka)
    redis.set(f'processed:order:{order_id}', '1', ex=86400 * 7)
```

---

## 5. Windowing e Aggregation

```
Windowing: agrupar eventos por janela de tempo para agregar.

Tumbling Window (janelas fixas, sem overlap):
  |--5min--|--5min--|--5min--|
  Cada evento pertence a exatamente 1 janela.
  Uso: métricas por intervalo (orders/5min, revenue/hora)

Sliding Window (janelas que se sobrepõem):
  |---5min---|
     |---5min---|
        |---5min---|
  Evento pode pertencer a múltiplas janelas.
  Uso: média móvel, detecção de anomalia contínua

Session Window (baseada em atividade):
  |--user ativo--|gap|--user ativo--|
  Janela fecha após N minutos sem evento.
  Uso: sessões de usuário, tempo no site
```

```python
# Exemplo: Flink SQL — contagem de orders por janela de 5 minutos
"""
SELECT
    TUMBLE_START(event_time, INTERVAL '5' MINUTE) AS window_start,
    COUNT(*) AS order_count,
    SUM(total_cents) AS revenue
FROM orders_stream
GROUP BY TUMBLE(event_time, INTERVAL '5' MINUTE);
"""
```

---

## 6. Stream Processing Frameworks

| Framework | Linguagem | Quando usar |
|-----------|----------|-------------|
| **Kafka Streams** | Java/Kotlin | Processamento no mesmo cluster Kafka |
| **Flink** | Java/Python | Stream processing pesado, stateful |
| **Spark Structured Streaming** | Python/Scala | Time já usa Spark para batch |
| **Benthos/Redpanda Connect** | Config/YAML | Transformações simples, ETL streams |
| **Node.js + Kafka consumer** | JavaScript | Apps Node existentes |
| **Python consumer** | Python | Simples, volume baixo-médio |

---

## 7. Hybrid: Lambda e Kappa Architecture

```
Lambda Architecture:
  Batch layer (historico, completo, lento)  ──┐
                                               ├──→ Serving layer → Queries
  Speed layer (real-time, aproximado, rápido) ─┘

  Problema: manter 2 pipelines (batch + stream) com mesma lógica.
  Duplicação de código, bugs divergentes.

Kappa Architecture:
  Apenas streaming. Tudo é evento.
  Replay de eventos = "batch".

  Vantagem: 1 pipeline, 1 lógica.
  Desvantagem: mais complexo para analytics pesados.

Prática (2025):
  Maioria dos times usa BATCH + micro-batch para near real-time.
  Streaming puro apenas quando latência < 30s é REQUERIMENTO do negócio.
  Não complicar com Lambda/Kappa se batch de 5 min resolve.
```
