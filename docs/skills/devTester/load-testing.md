# Load Testing — k6, Artillery, Cenários e Thresholds

## Índice
1. Tipos de Teste de Carga
2. k6 — Setup e Cenários
3. Artillery — Setup e Cenários
4. O Que Medir
5. Cenários Comuns
6. Thresholds e SLOs
7. Load Test no CI/CD
8. Diagnóstico de Gargalos

---

## 1. Tipos de Teste de Carga

| Tipo | Objetivo | Users | Duração |
|------|---------|-------|---------|
| **Smoke** | Funciona com 1 user? | 1-5 | 1 min |
| **Load** | Funciona com carga normal? | 50-200 | 5-15 min |
| **Stress** | Onde é o limite? | Incrementar até quebrar | 10-30 min |
| **Spike** | Aguenta pico repentino? | 0 → 500 → 0 | 5 min |
| **Soak** | Estável por horas? (memory leaks) | 50-100 | 1-4 horas |

```
Quando rodar cada tipo:

Smoke   → Toda PR (rápido, baseline)
Load    → Pré-release, semanal
Stress  → Mensalmente ou antes de grandes lançamentos
Spike   → Antes de eventos (Black Friday, lançamento)
Soak    → Mensal ou quando suspeita de memory leak
```

---

## 2. k6 — Setup e Cenários

### Smoke test

```javascript
// tests/load/smoke.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 1,           // 1 virtual user
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<500'],  // p95 < 500ms
    http_req_failed: ['rate<0.01'],    // < 1% erro
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  const res = http.get(`${BASE_URL}/api/v1/health`);
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 200ms': (r) => r.timings.duration < 200,
  });
  sleep(1);
}
```

### Load test — Fluxo de API completo

```javascript
// tests/load/api-load.js
import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Métricas customizadas
const errorRate = new Rate('errors');
const loginDuration = new Trend('login_duration');
const orderDuration = new Trend('create_order_duration');

export const options = {
  stages: [
    { duration: '2m', target: 50 },   // Ramp up para 50 users
    { duration: '5m', target: 50 },   // Manter 50 users
    { duration: '2m', target: 100 },  // Ramp up para 100
    { duration: '5m', target: 100 },  // Manter 100
    { duration: '2m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000', 'p(99)<2000'],
    http_req_failed: ['rate<0.05'],
    errors: ['rate<0.1'],
    login_duration: ['p(95)<500'],
    create_order_duration: ['p(95)<1500'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const headers = { 'Content-Type': 'application/json' };

export default function () {
  let token;

  // Login
  group('login', () => {
    const start = Date.now();
    const loginRes = http.post(`${BASE_URL}/api/v1/auth/login`, JSON.stringify({
      email: `loadtest+${__VU}@test.com`,
      password: 'Test@123',
    }), { headers });

    loginDuration.add(Date.now() - start);

    const success = check(loginRes, {
      'login status 200': (r) => r.status === 200,
      'login has token': (r) => r.json('data.accessToken') !== undefined,
    });

    if (!success) {
      errorRate.add(1);
      return;
    }
    errorRate.add(0);
    token = loginRes.json('data.accessToken');
  });

  if (!token) return;
  const authHeaders = { ...headers, Authorization: `Bearer ${token}` };

  // Listar produtos
  group('list products', () => {
    const res = http.get(`${BASE_URL}/api/v1/products?limit=20`, { headers: authHeaders });
    check(res, { 'products status 200': (r) => r.status === 200 });
  });

  sleep(1); // Simular "tempo de leitura" do user

  // Criar pedido
  group('create order', () => {
    const start = Date.now();
    const res = http.post(`${BASE_URL}/api/v1/orders`, JSON.stringify({
      items: [{ productId: 'prod-001', quantity: 1 }],
      shippingAddressId: 'addr-001',
    }), { headers: authHeaders });

    orderDuration.add(Date.now() - start);

    const success = check(res, {
      'order status 201': (r) => r.status === 201,
      'order has id': (r) => r.json('data.id') !== undefined,
    });
    errorRate.add(success ? 0 : 1);
  });

  sleep(2);
}
```

### Stress test — Encontrar o limite

```javascript
// tests/load/stress.js
export const options = {
  stages: [
    { duration: '2m', target: 100 },
    { duration: '5m', target: 100 },
    { duration: '2m', target: 200 },
    { duration: '5m', target: 200 },
    { duration: '2m', target: 300 },
    { duration: '5m', target: 300 },
    { duration: '2m', target: 400 },  // Onde vai quebrar?
    { duration: '5m', target: 400 },
    { duration: '5m', target: 0 },    // Ramp down — recupera?
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.15'],  // Mais tolerante no stress
  },
};
```

### Spike test

```javascript
// tests/load/spike.js
export const options = {
  stages: [
    { duration: '30s', target: 10 },  // Normal
    { duration: '10s', target: 500 }, // SPIKE!
    { duration: '2m', target: 500 },  // Manter spike
    { duration: '10s', target: 10 },  // Voltar ao normal
    { duration: '2m', target: 10 },   // Recuperou?
  ],
};
```

---

## 3. Artillery — Setup e Cenários

```yaml
# tests/load/artillery-load.yml
config:
  target: "http://localhost:3000"
  phases:
    - duration: 120
      arrivalRate: 10
      name: "Warm up"
    - duration: 300
      arrivalRate: 50
      name: "Sustained load"
    - duration: 120
      arrivalRate: 0
      name: "Ramp down"
  defaults:
    headers:
      Content-Type: "application/json"
  ensure:
    p95: 1000
    maxErrorRate: 5

scenarios:
  - name: "Browse and purchase"
    weight: 70  # 70% dos virtual users
    flow:
      - post:
          url: "/api/v1/auth/login"
          json:
            email: "loadtest@test.com"
            password: "Test@123"
          capture:
            - json: "$.data.accessToken"
              as: "token"
      - get:
          url: "/api/v1/products?limit=20"
          headers:
            Authorization: "Bearer {{ token }}"
      - think: 2
      - post:
          url: "/api/v1/orders"
          headers:
            Authorization: "Bearer {{ token }}"
          json:
            items:
              - productId: "prod-001"
                quantity: 1

  - name: "Browse only"
    weight: 30  # 30% só navegam
    flow:
      - get:
          url: "/api/v1/products?limit=20"
      - think: 3
      - get:
          url: "/api/v1/products?limit=20&page=2"
```

---

## 4. O Que Medir

```
Métricas essenciais:

Latência:
├── p50 (mediana) — experiência típica
├── p95 — experiência dos 5% mais lentos
├── p99 — experiência do worst case
└── max — outlier (pode indicar GC pause, cold start)

Throughput:
├── Requests/segundo (rps) — capacidade do sistema
├── Erros/segundo — taxa de falha absoluta
└── Error rate (%) — % de requests que falharam

Recursos:
├── CPU usage (%) — do servidor/container
├── Memory usage — crescendo? (leak!)
├── DB connections — pool esgotado?
├── Event loop lag (Node.js) — bloqueando?
└── Disk I/O — log pesado? swap?
```

---

## 5. Cenários Comuns

| Cenário | Virtual Users | O que estressar |
|---------|--------------|----------------|
| Listagem paginada | 200 VUs | DB queries, serialização |
| Busca com texto | 100 VUs | Full-text search, índices |
| Upload de arquivo | 50 VUs | I/O, memória, storage |
| Webhook burst | 500 rps | Queue, processamento async |
| Login simultâneo | 200 VUs | bcrypt CPU, JWT sign |
| Relatório pesado | 20 VUs | Aggregation, timeout |

---

## 6. Thresholds e SLOs

### Definir SLOs primeiro

```
SLO (Service Level Objective):
├── Disponibilidade: 99.9% (43 min/mês de downtime)
├── Latência: p95 < 500ms para GET, p95 < 1000ms para POST
├── Error rate: < 0.1% para endpoints críticos
└── Throughput: Suportar 1000 rps no pico

Threshold no k6 = validar SLO automaticamente:
thresholds: {
  'http_req_duration{endpoint:GET}': ['p(95)<500'],
  'http_req_duration{endpoint:POST}': ['p(95)<1000'],
  'http_req_failed': ['rate<0.001'],
}
```

---

## 7. Load Test no CI/CD

```yaml
# .github/workflows/load-test.yml
name: Load Tests
on:
  schedule:
    - cron: '0 6 * * 1' # Segunda-feira 6h UTC
  workflow_dispatch: # Manual trigger

jobs:
  load-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Start app
        run: docker compose -f docker-compose.test.yml up -d
      - run: sleep 15 # Esperar app iniciar

      - name: Install k6
        run: |
          sudo gpg -k
          sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
            --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys ...
          echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" \
            | sudo tee /etc/apt/sources.list.d/k6.list
          sudo apt-get update && sudo apt-get install k6

      - name: Run smoke test
        run: k6 run tests/load/smoke.js --env BASE_URL=http://localhost:3000

      - name: Run load test
        run: k6 run tests/load/api-load.js --env BASE_URL=http://localhost:3000

      - name: Cleanup
        if: always()
        run: docker compose -f docker-compose.test.yml down
```

---

## 8. Diagnóstico de Gargalos

```
Latência alta (p95 > SLO):
├── DB query lenta? → EXPLAIN ANALYZE + índices
├── N+1 queries? → Eager loading
├── CPU-bound? (bcrypt, JSON parse) → Cache, worker threads
├── Serialização pesada? → SELECT apenas campos necessários
├── Connection pool esgotado? → Aumentar pool, connection queuing
└── Cold start? (lambda, container) → Warm-up

Error rate alta (> SLO):
├── 429 Rate Limited? → Aumentar limites ou otimizar client
├── 500 Internal Error? → Logs! Stack trace, memory, DB
├── 502/503/504? → Upstream (DB, Redis, API) caiu
├── Connection refused? → Max connections, file descriptors
└── Timeout? → Aumentar timeout ou otimizar query

Memory crescendo (soak test):
├── Event listeners acumulando?
├── Cache sem eviction?
├── Closures segurando referências?
├── Buffer/stream não drenado?
└── Global arrays/maps crescendo infinitamente?
```
