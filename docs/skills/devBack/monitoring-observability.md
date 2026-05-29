# Monitoring & Observability — Setup Completo

## Índice
1. Os 3 Pilares
2. Prometheus + Grafana (Docker Compose)
3. Métricas da Aplicação
4. Dashboards Grafana
5. Alertas (Alertmanager)
6. Logging Estruturado
7. Healthchecks Avançados
8. Stack Leve (sem Prometheus)

---

## 1. Os 3 Pilares

```
OBSERVABILIDADE
├── MÉTRICAS → Números ao longo do tempo (Prometheus/Grafana)
│   ├── Infra: CPU, RAM, disco, rede
│   ├── App: request rate, latency, errors (RED)
│   └── Business: signups/hr, orders/day, revenue
│
├── LOGS → Eventos discretos (Loki/ELK/CloudWatch)
│   ├── Formato: JSON estruturado
│   ├── Levels: error, warn, info, debug
│   └── Context: trace_id, user_id, request_id
│
└── TRACES → Fluxo entre serviços (Jaeger/Tempo)
    ├── Trace ID propagado entre serviços
    ├── Span por operação
    └── Latency breakdown por hop
```

### Quando usar cada coisa

| Pergunta | Pilar | Ferramenta |
|----------|-------|-----------|
| "O sistema está lento?" | Métricas | Grafana dashboard |
| "POR QUE está lento?" | Traces | Jaeger/Tempo |
| "O que aconteceu às 3h?" | Logs | Loki/ELK |
| "Quantos erros por minuto?" | Métricas | Prometheus counter |
| "Qual o erro exato?" | Logs | Log com stack trace |

---

## 2. Prometheus + Grafana (Docker Compose)

### Adicionar ao docker-compose.yml

```yaml
services:
  # ... (app, db, redis, nginx) ...

  # ====== PROMETHEUS ======
  prometheus:
    image: prom/prometheus:v2.50.0
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - ./monitoring/alert-rules.yml:/etc/prometheus/alert-rules.yml:ro
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--storage.tsdb.retention.time=30d'
      - '--web.enable-lifecycle'
    restart: unless-stopped
    networks:
      - monitoring

  # ====== GRAFANA ======
  grafana:
    image: grafana/grafana:10.3.0
    environment:
      - GF_SECURITY_ADMIN_USER=${GRAFANA_USER:-admin}
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_PASS:-changeme}
      - GF_USERS_ALLOW_SIGN_UP=false
    volumes:
      - grafana_data:/var/lib/grafana
      - ./monitoring/grafana/provisioning:/etc/grafana/provisioning:ro
      - ./monitoring/grafana/dashboards:/var/lib/grafana/dashboards:ro
    ports:
      - "${GRAFANA_PORT:-3001}:3000"
    depends_on:
      - prometheus
    restart: unless-stopped
    networks:
      - monitoring

  # ====== ALERTMANAGER ======
  alertmanager:
    image: prom/alertmanager:v0.27.0
    volumes:
      - ./monitoring/alertmanager.yml:/etc/alertmanager/alertmanager.yml:ro
    restart: unless-stopped
    networks:
      - monitoring

  # ====== LOKI (Logs) ======
  loki:
    image: grafana/loki:2.9.4
    command: -config.file=/etc/loki/local-config.yaml
    volumes:
      - loki_data:/loki
    restart: unless-stopped
    networks:
      - monitoring

  # ====== NODE EXPORTER (métricas do host) ======
  node-exporter:
    image: prom/node-exporter:v1.7.0
    volumes:
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
      - /:/rootfs:ro
    command:
      - '--path.procfs=/host/proc'
      - '--path.rootfs=/rootfs'
      - '--path.sysfs=/host/sys'
    restart: unless-stopped
    networks:
      - monitoring

volumes:
  prometheus_data:
  grafana_data:
  loki_data:

networks:
  monitoring:
    driver: bridge
```

### monitoring/prometheus.yml

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "alert-rules.yml"

alerting:
  alertmanagers:
    - static_configs:
        - targets: ["alertmanager:9093"]

scrape_configs:
  # Próprio Prometheus
  - job_name: "prometheus"
    static_configs:
      - targets: ["localhost:9090"]

  # Aplicação (precisa expor /metrics)
  - job_name: "app"
    metrics_path: /metrics
    static_configs:
      - targets: ["app:3000"]

  # Node Exporter (métricas do host)
  - job_name: "node"
    static_configs:
      - targets: ["node-exporter:9100"]

  # Nginx (com nginx-exporter ou stub_status)
  - job_name: "nginx"
    static_configs:
      - targets: ["nginx-exporter:9113"]

  # PostgreSQL (com postgres_exporter)
  - job_name: "postgres"
    static_configs:
      - targets: ["postgres-exporter:9187"]

  # Redis
  - job_name: "redis"
    static_configs:
      - targets: ["redis-exporter:9121"]
```

---

## 3. Métricas da Aplicação

### Node.js (prom-client)

```javascript
// metrics.js
const promClient = require('prom-client');

// Coletar métricas default (CPU, memory, event loop, GC)
promClient.collectDefaultMetrics({ prefix: 'app_' });

// HTTP request counter
const httpRequestsTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

// HTTP request duration
const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});

// Middleware para Express
const metricsMiddleware = (req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route?.path || req.path;
    httpRequestsTotal.inc({ method: req.method, route, status_code: res.statusCode });
    httpRequestDuration.observe({ method: req.method, route, status_code: res.statusCode }, duration);
  });
  next();
};

// Endpoint /metrics
app.use(metricsMiddleware);
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', promClient.register.contentType);
  res.end(await promClient.register.metrics());
});
```

### Python (prometheus_client)

```python
from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST
import time

REQUEST_COUNT = Counter('http_requests_total', 'Total requests', ['method', 'endpoint', 'status'])
REQUEST_LATENCY = Histogram('http_request_duration_seconds', 'Request latency', ['method', 'endpoint'])

# FastAPI middleware
@app.middleware("http")
async def metrics_middleware(request, call_next):
    start = time.time()
    response = await call_next(request)
    duration = time.time() - start
    REQUEST_COUNT.labels(request.method, request.url.path, response.status_code).inc()
    REQUEST_LATENCY.labels(request.method, request.url.path).observe(duration)
    return response

@app.get("/metrics")
async def metrics():
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)
```

---

## 4. Dashboards Grafana

### Provisioning automático

```yaml
# monitoring/grafana/provisioning/datasources/datasources.yml
apiVersion: 1
datasources:
  - name: Prometheus
    type: prometheus
    url: http://prometheus:9090
    isDefault: true
  - name: Loki
    type: loki
    url: http://loki:3100
```

### Métricas RED para dashboards

O framework RED cobre 90% das necessidades:

```
Rate    → Requests por segundo
Errors  → % de requests com erro
Duration → Latência (p50, p95, p99)
```

Queries Prometheus para dashboard:

```promql
# Request rate (req/s)
rate(http_requests_total[5m])

# Error rate (%)
sum(rate(http_requests_total{status_code=~"5.."}[5m]))
/ sum(rate(http_requests_total[5m])) * 100

# Latência p95
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Latência p99
histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))

# CPU usage (node exporter)
100 - (avg(rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)

# Memory usage (%)
(1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes) * 100

# Disk usage (%)
(1 - node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"}) * 100
```

---

## 5. Alertas (Alertmanager)

### monitoring/alert-rules.yml

```yaml
groups:
  - name: app
    rules:
      # Serviço DOWN
      - alert: ServiceDown
        expr: up{job="app"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Serviço {{ $labels.job }} está DOWN"
          description: "{{ $labels.instance }} não responde há mais de 1 minuto"

      # Error rate alto
      - alert: HighErrorRate
        expr: |
          sum(rate(http_requests_total{status_code=~"5.."}[5m]))
          / sum(rate(http_requests_total[5m])) * 100 > 5
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Error rate acima de 5%"
          description: "Error rate atual: {{ $value }}%"

      # Latência alta
      - alert: HighLatency
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 2
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Latência p95 acima de 2s"

  - name: infra
    rules:
      # Disco cheio
      - alert: DiskSpaceWarning
        expr: (1 - node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"}) * 100 > 85
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Disco acima de 85%"

      # CPU alta
      - alert: HighCPU
        expr: 100 - (avg(rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100) > 90
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "CPU acima de 90% por 10 minutos"

      # Memória alta
      - alert: HighMemory
        expr: (1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes) * 100 > 90
        for: 5m
        labels:
          severity: warning
```

### monitoring/alertmanager.yml

```yaml
global:
  resolve_timeout: 5m

route:
  receiver: "slack"
  group_by: ["alertname", "severity"]
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h

  routes:
    - match:
        severity: critical
      receiver: "slack-critical"
      repeat_interval: 1h

receivers:
  - name: "slack"
    slack_configs:
      - api_url: "https://hooks.slack.com/services/XXX/YYY/ZZZ"
        channel: "#monitoring"
        title: '{{ .GroupLabels.alertname }}'
        text: '{{ range .Alerts }}{{ .Annotations.summary }}{{ end }}'

  - name: "slack-critical"
    slack_configs:
      - api_url: "https://hooks.slack.com/services/XXX/YYY/ZZZ"
        channel: "#critical-alerts"
        title: '🔴 CRITICAL: {{ .GroupLabels.alertname }}'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'
```

---

## 6. Logging Estruturado

### Formato padrão (JSON)

```json
{
  "timestamp": "2025-01-15T10:30:45.123Z",
  "level": "error",
  "service": "api",
  "trace_id": "abc-123-def",
  "request_id": "req-456",
  "method": "POST",
  "path": "/api/orders",
  "status": 500,
  "duration_ms": 145,
  "user_id": "usr-789",
  "error": "Connection refused to payment gateway",
  "stack": "Error: Connection refused\n    at..."
}
```

### O que NÃO logar

```
NUNCA logar:
├── Senhas (nem hash)
├── Tokens de acesso
├── Números de cartão de crédito
├── CPF, RG, documentos pessoais
├── Dados de saúde
├── Request bodies com dados sensíveis
└── PII sem necessidade comprovada
```

---

## 7. Stack Leve (sem Prometheus)

Para projetos menores que não justificam Prometheus + Grafana completo:

### Opção 1: Healthcheck + Uptime Monitor

```bash
# Usar UptimeRobot, Betterstack, ou Checkly (free tier)
# Monitoram GET /health a cada 1-5 minutos
# Alertam por email/Slack se falhar
```

### Opção 2: Docker logs + Loki

```yaml
# Só Loki + Grafana (sem Prometheus)
services:
  loki:
    image: grafana/loki:2.9.4
  grafana:
    image: grafana/grafana:10.3.0
# Logs do Docker vão automaticamente para Loki com docker plugin
```

### Opção 3: Cloud-native

```
AWS      → CloudWatch (logs + métricas + alertas built-in)
GCP      → Cloud Monitoring + Cloud Logging
Azure    → Application Insights
Railway  → Built-in metrics
Fly.io   → Built-in metrics + Grafana integration
```
