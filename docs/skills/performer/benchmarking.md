# Benchmarking — Rigor Estatístico, Ferramentas e CI/CD

## Índice
1. Benchmarking Correto vs Errado
2. Rigor Estatístico
3. Ferramentas de Benchmark
4. RUM vs Synthetic
5. Performance Budgets
6. Performance Regression no CI/CD
7. Relatório de Performance

---

## 1. Benchmarking Correto vs Errado

```
Erros fatais em benchmarking:

❌ Rodar 1 vez e concluir ("Mediu 150ms, está bom")
   → 1 medição = ruído. Precisa de N medições + estatística.

❌ Comparar com sistema idle vs sob carga
   → Ambiente precisa ser IDÊNTICO entre before e after.

❌ Medir na sua máquina e extrapolar para produção
   → Hardware, rede, dados, concorrência são DIFERENTES.

❌ Medir tempo total sem breakdown por camada
   → Otimizar DB quando o gargalo é serialização.

❌ Olhar apenas média (mean)
   → p50 = 50ms mas p99 = 5000ms. Média esconde a miséria dos 1%.

❌ Benchmark com dados fake/poucos dados
   → Produção tem 1M rows, dev tem 100. Completamente diferente.

❌ Otimizar e não medir o DEPOIS
   → "Acho que melhorou" não é evidência.
```

```
Benchmarking correto:

1. Ambiente controlado (mesma máquina, mesma carga, mesmos dados)
2. Warmup: descartar as primeiras N iterações (JIT, cache cold)
3. Mínimo 30 iterações (para significância estatística)
4. Reportar: p50, p95, p99, min, max, stddev
5. Comparar antes/depois no MESMO ambiente
6. Verificar significância (não é só ruído?)
7. Reproduzível: qualquer pessoa roda e obtém resultado similar
```

---

## 2. Rigor Estatístico

```
Métricas essenciais:

p50 (mediana)    — Experiência "típica" do user
p95              — 1 em 20 requests é pelo menos tão lento
p99              — 1 em 100 requests é pelo menos tão lento
mean (média)     — Útil para custo total, ruim para user experience
stddev           — Variabilidade. Alta = inconsistente.
min              — Melhor caso (geralmente irrelevante)
max              — Pior caso (pode indicar GC pause, cold start)
```

```javascript
// Calcular percentis corretamente
function calculatePercentiles(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;

  return {
    p50: sorted[Math.floor(n * 0.50)],
    p95: sorted[Math.floor(n * 0.95)],
    p99: sorted[Math.floor(n * 0.99)],
    mean: values.reduce((a, b) => a + b, 0) / n,
    stddev: Math.sqrt(values.reduce((sum, v) =>
      sum + Math.pow(v - (values.reduce((a, b) => a + b, 0) / n), 2), 0) / n),
    min: sorted[0],
    max: sorted[n - 1],
    samples: n,
  };
}

// Determinar se a diferença é significativa
function isSignificant(before, after) {
  // Regra prática: diferença > 2 × stddev do before
  const threshold = before.mean + 2 * before.stddev;
  if (after.p95 > threshold) return { significant: true, regression: true };
  if (after.p95 < before.p95 * 0.9) return { significant: true, improvement: true };
  return { significant: false };
}
```

### Variância e Warm-up

```javascript
// Benchmark com warmup e estatística
async function benchmark(fn, { warmup = 10, iterations = 100, label = 'bench' } = {}) {
  // Warmup (descartar — JIT compilation, cache warmup)
  for (let i = 0; i < warmup; i++) {
    await fn();
  }

  // Medições reais
  const times = [];
  for (let i = 0; i < iterations; i++) {
    const start = process.hrtime.bigint();
    await fn();
    const end = process.hrtime.bigint();
    times.push(Number(end - start) / 1e6); // ms
  }

  const stats = calculatePercentiles(times);
  console.log(`[${label}]`, {
    p50: `${stats.p50.toFixed(2)}ms`,
    p95: `${stats.p95.toFixed(2)}ms`,
    p99: `${stats.p99.toFixed(2)}ms`,
    mean: `${stats.mean.toFixed(2)}ms`,
    stddev: `${stats.stddev.toFixed(2)}ms`,
    samples: stats.samples,
  });

  return stats;
}
```

---

## 3. Ferramentas de Benchmark

### autocannon (HTTP benchmarking, Node.js)

```bash
# Básico: 10 conexões, 10 segundos
npx autocannon -c 10 -d 10 http://localhost:3000/api/products

# Com headers e body
npx autocannon -c 50 -d 30 \
  -H "Authorization=Bearer eyJ..." \
  -m POST \
  -b '{"items":[{"productId":"p1","quantity":1}]}' \
  -i "application/json" \
  http://localhost:3000/api/orders

# Output:
# Stat    2.5%  50%   97.5%  99%    Avg     Stdev
# Latency 12ms  45ms  189ms  250ms  52ms    38ms
# Req/Sec 180   220   280    300    225     28
```

### k6 (load testing com métricas)

```javascript
// benchmarks/api-benchmark.js
import http from 'k6/http';
import { check } from 'k6';
import { Trend } from 'k6/metrics';

const listLatency = new Trend('list_products_duration');

export const options = {
  scenarios: {
    constant: {
      executor: 'constant-vus',
      vus: 10,
      duration: '60s',
    },
  },
  thresholds: {
    list_products_duration: ['p(95)<200'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const res = http.get('http://localhost:3000/api/products?limit=20');
  listLatency.add(res.timings.duration);
  check(res, { 'status 200': (r) => r.status === 200 });
}
```

### Lighthouse CI

```bash
# Instalar
npm i -g @lhci/cli

# Rodar
lhci autorun --collect.url=http://localhost:3000 --assert.preset=lighthouse:recommended

# Configurar budgets
# lighthouserc.js (ver frontend-performance.md)
```

---

## 4. RUM vs Synthetic

```
RUM (Real User Monitoring):
  Dados de users REAIS, browsers reais, redes reais.
  Prós: Reflete experiência real, diversidade de condições.
  Contras: Requer tráfego, variância alta, difícil comparar.
  Ferramentas: web-vitals, Datadog RUM, Sentry Performance.

Synthetic (Lab):
  Lighthouse, WebPageTest, autocannon em ambiente controlado.
  Prós: Reproduzível, comparável, sem tráfego necessário.
  Contras: Não reflete condições reais (rede, device).
  Ferramentas: Lighthouse CI, WebPageTest, k6.

Quando usar cada:

RUM: Monitorar produção. Detectar regressão em users reais.
     Dashboard de Core Web Vitals. Alertas de degradação.

Synthetic: CI/CD gates. Comparar before/after de PR.
           Detectar regressão antes de ir para produção.

Melhor: AMBOS. Synthetic no CI + RUM em produção.
```

---

## 5. Performance Budgets

```
Como definir budgets:

1. Medir baseline atual
2. Definir target baseado em:
   ├── Core Web Vitals thresholds ("good")
   ├── Competidores (se possível)
   ├── Negócio (ex: "cada 100ms de latência = 1% de conversão")
   └── Constraint técnico (mobile 4G, 300ms RTT)
3. Budget = target + margem de 10-20%
4. Implementar no CI (fail build se exceder)
5. Revisar trimestralmente
```

```
Budget Template:

| Metric | Budget | Current | Status |
|--------|--------|---------|--------|
| LCP | < 2.5s | 1.8s | ✅ |
| INP | < 200ms | 150ms | ✅ |
| CLS | < 0.1 | 0.05 | ✅ |
| JS total (gz) | < 200KB | 185KB | ⚠️ |
| CSS total (gz) | < 50KB | 32KB | ✅ |
| API p95 (GET) | < 500ms | 320ms | ✅ |
| API p95 (POST) | < 1000ms | 750ms | ✅ |
| Slowest query | < 500ms | 380ms | ✅ |
| Lighthouse score | > 85 | 88 | ✅ |
```

---

## 6. Performance Regression no CI/CD

```yaml
# .github/workflows/perf-check.yml
name: Performance Check
on: [pull_request]

jobs:
  bundle-size:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npm run build
      - uses: andresz1/size-limit-action@v1
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          # Comenta na PR com diff de bundle size

  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npm run build && npm start &
      - run: npx @lhci/cli autorun
        env:
          LHCI_GITHUB_APP_TOKEN: ${{ secrets.LHCI_TOKEN }}

  api-benchmark:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env: { POSTGRES_PASSWORD: test }
        ports: ['5432:5432']
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npm run seed:benchmark
      - run: npm start &
      - run: sleep 5
      - name: Run benchmark
        run: |
          npx autocannon -c 10 -d 30 -j http://localhost:3000/api/products > bench-results.json
          # Parse results e fail se p95 > budget
          node scripts/check-benchmark.js bench-results.json
```

---

## 7. Relatório de Performance

```markdown
# Performance Report — [Feature/Sprint/Release]

## Resumo
| Metric | Before | After | Change | Budget | Status |
|--------|--------|-------|--------|--------|--------|
| LCP | 2.8s | 1.9s | -32% | < 2.5s | ✅ Fixed |
| Bundle JS | 280KB | 195KB | -30% | < 200KB | ✅ Fixed |
| API /orders p95 | 1200ms | 380ms | -68% | < 500ms | ✅ Fixed |
| Slowest query | 2.3s | 45ms | -98% | < 500ms | ✅ Fixed |

## O que foi feito
1. Code splitting de rotas (3 lazy imports) → -85KB bundle
2. Índice em orders(user_id, created_at) → query 2.3s → 45ms
3. Include ao invés de N+1 → 23 queries → 2 queries
4. Lazy loading de imagens abaixo do fold → LCP 2.8s → 1.9s

## O que medir a seguir
- RUM Core Web Vitals por 2 semanas (confirmar melhoria em prod)
- Monitorar slow query log (nenhuma nova query > 500ms)
- Bundle size trending (não exceder 200KB budget)

## Benchmark Evidence
[Attach autocannon results, Lighthouse reports, EXPLAIN ANALYZE outputs]
```
