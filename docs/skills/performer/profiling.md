# Profiling — CPU, Memory, Flame Graphs, Event Loop

## Índice
1. CPU Profiling
2. Flame Graphs — Como Ler
3. Memory Profiling
4. Event Loop (Node.js)
5. Profiling em Produção
6. Ferramentas por Ecossistema

---

## 1. CPU Profiling

```
CPU profiling responde: "ONDE o processador gasta tempo?"

Tipos:
├── Sampling profiler — Interrompe a cada Nms e registra o call stack
│   Prós: Baixo overhead (~2-5%), seguro para produção
│   Contras: Pode perder funções muito rápidas
│
└── Instrumentation profiler — Mede cada chamada de função
    Prós: 100% preciso
    Contras: Alto overhead (10-50%), distorce os resultados
    Usar apenas em dev/staging

Regra: Sampling para encontrar o problema, instrumentation para medir com precisão.
```

### Node.js — CPU Profile

```bash
# Opção 1: --prof (V8 built-in, sampling)
node --prof src/server.js
# Gerar carga: k6 run load-test.js
# Ctrl+C
node --prof-process isolate-*.log > profile.txt
# Procurar por [Summary] → ticks por categoria
# Procurar por [Bottom up (heavy) profile] → funções mais caras

# Opção 2: --cpu-prof (gera .cpuprofile para Chrome DevTools)
node --cpu-prof --cpu-prof-dir=./profiles src/server.js
# Abrir .cpuprofile no Chrome DevTools → Performance → Load

# Opção 3: clinic.js (diagnóstico automatizado)
npx clinic doctor -- node src/server.js
# → Gera relatório com diagnóstico (event loop? GC? I/O?)

npx clinic flame -- node src/server.js
# → Gera flame graph interativo

# Opção 4: 0x (flame graph direto)
npx 0x src/server.js
# Gerar carga → Ctrl+C → Abre flame graph no browser
```

### Python — CPU Profile

```python
# cProfile (built-in)
import cProfile
import pstats

profiler = cProfile.Profile()
profiler.enable()
# ... código a medir ...
profiler.disable()

stats = pstats.Stats(profiler)
stats.sort_stats('cumulative')
stats.print_stats(20)  # Top 20 funções

# Ou por CLI:
# python -m cProfile -s cumulative app.py

# py-spy (sampling, pode attachar a processo rodando)
# pip install py-spy
# py-spy top --pid 12345            # Top de funções (live)
# py-spy record -o profile.svg -- python app.py  # Flame graph
```

---

## 2. Flame Graphs — Como Ler

```
Anatomia de um flame graph:

         ┌──────────────────────────────────────────────────────────┐
         │               bcrypt.hashSync (38%)                      │ ← LARGO = muito CPU
         ├─────────────────────┬────────────────────────────────────┤
         │ userService.create  │    JSON.stringify (12%)            │
         │     (42%)           │    ┌──────────────────────────────┐│
         │                     │    │ orderSerializer.toJSON (10%)  ││
         ├─────────────────────┴────┴──────────────────────────────┤│
         │              requestHandler                              ││
         └──────────────────────────────────────────────────────────┘│

Regras de leitura:
├── Eixo X = proporção do tempo de CPU (NÃO é timeline cronológica)
├── Eixo Y = profundidade do call stack (de baixo para cima)
├── Largura da barra = tempo gasto naquela função + suas children
├── Cor geralmente não importa (exceto em diff flame graphs)
│
├── PROCURAR: barras LARGAS no TOPO → funções que consomem CPU diretamente
├── PROCURAR: "plateaus" (platôs largos) → gargalo nessa função
├── IGNORAR: barras largas na BASE (são o entry point, não o gargalo)
└── CLICAR: para zoom em sub-árvore específica

Diagnósticos comuns:
├── Barra larga de "GC" → memory pressure, alocação excessiva
├── Barra larga de bcrypt/crypto → CPU-bound por design (ok?)
├── Barra larga de JSON.parse/stringify → payload grande
├── Barra larga de RegExp → regex complexa/catastrophic backtracking
├── Muitas barras finas "anonymous" → closures ou callbacks excessivos
└── Barra larga de "idle" → I/O wait (bom! CPU não é o gargalo)
```

### Differential Flame Graph

```bash
# Comparar ANTES e DEPOIS da otimização
# Vermelho = ficou mais lento, azul = ficou mais rápido

# Com 0x:
npx 0x --collect-only src/server.js  # Baseline
# Gerar carga → Ctrl+C

# Aplicar otimização...

npx 0x --collect-only src/server.js  # Otimizado
# Gerar carga → Ctrl+C

# Gerar diff
npx 0x --diff baseline.0x/ optimized.0x/
```

---

## 3. Memory Profiling

### Heap Snapshot (Node.js)

```javascript
// Tirar snapshot programaticamente
const v8 = require('v8');

// Snapshot 1: baseline
v8.writeHeapSnapshot('/tmp/heap-before.heapsnapshot');

// ... executar cenário de teste ...

// Snapshot 2: depois
v8.writeHeapSnapshot('/tmp/heap-after.heapsnapshot');

// Abrir no Chrome DevTools → Memory → Load
// Comparison view: objetos novos entre snapshot 1 e 2
// Ordenar por "Alloc. Size" → maiores alocações

// Endpoint para debug (PROTEGER com auth!)
app.get('/debug/memory', adminAuth, (req, res) => {
  const mem = process.memoryUsage();
  res.json({
    rss: `${(mem.rss / 1024 / 1024).toFixed(1)}MB`,
    heapUsed: `${(mem.heapUsed / 1024 / 1024).toFixed(1)}MB`,
    heapTotal: `${(mem.heapTotal / 1024 / 1024).toFixed(1)}MB`,
    external: `${(mem.external / 1024 / 1024).toFixed(1)}MB`,
    arrayBuffers: `${(mem.arrayBuffers / 1024 / 1024).toFixed(1)}MB`,
  });
});
```

### GC Monitoring

```bash
# Logar atividade do GC
node --trace-gc src/server.js
# Output: [12345:0x...] 42 ms: Scavenge 12.3 (15.0) -> 10.1 (15.0) MB, 1.2 ms

# Se GC roda muito frequentemente (>10% do tempo) → memory pressure
# Se GC pauses são longos (>100ms) → heap muito grande, considerar limitar

# Flags úteis:
node --max-old-space-size=512 src/server.js  # Limitar heap a 512MB
node --expose-gc src/server.js               # global.gc() disponível para forçar GC
```

---

## 4. Event Loop (Node.js)

```
O event loop é o coração do Node.js.
Se o event loop está BLOQUEADO, NADA funciona.

Monitorar event loop lag:
├── Saudável: < 10ms
├── Preocupante: 10-50ms (JS síncrono pesado)
├── Crítico: > 100ms (bloqueio severo, requests acumulando)
└── Catastrófico: > 1000ms (sistema efetivamente parado)
```

```javascript
// Monitorar event loop lag
const THRESHOLD = 50; // ms

let lastCheck = Date.now();
setInterval(() => {
  const now = Date.now();
  const lag = now - lastCheck - 1000; // Esperava 1000ms, quanto atrasou?
  if (lag > THRESHOLD) {
    logger.warn('Event loop lag detected', { lagMs: lag });
  }
  lastCheck = now;
}, 1000);

// Com monitorEventLoopDelay (Node.js built-in, mais preciso)
const { monitorEventLoopDelay } = require('perf_hooks');
const histogram = monitorEventLoopDelay({ resolution: 20 });
histogram.enable();

setInterval(() => {
  logger.info('Event loop stats', {
    min: (histogram.min / 1e6).toFixed(1),    // nanoseconds → ms
    max: (histogram.max / 1e6).toFixed(1),
    mean: (histogram.mean / 1e6).toFixed(1),
    p99: (histogram.percentile(99) / 1e6).toFixed(1),
  });
  histogram.reset();
}, 60000); // A cada minuto
```

### O Que Bloqueia o Event Loop

```
CPU-bound síncrono:
├── JSON.parse/stringify de payload enorme (>1MB)
├── crypto.pbkdf2Sync, bcrypt.hashSync (usar versão async!)
├── RegExp com backtracking exponencial (ReDoS)
├── Loops grandes sobre arrays enormes
├── Serialização/desserialização pesada
└── Compressão síncrona (zlib.deflateSync)

Soluções:
├── Usar versão ASYNC de toda operação I/O e crypto
├── worker_threads para CPU-bound pesado
├── Chunking: processar em batches com setImmediate() entre eles
├── Stream: processar dados incrementalmente (não tudo na memória)
└── Offload: mover trabalho pesado para queue/worker externo
```

```javascript
// ❌ Bloqueia event loop
const result = JSON.parse(hugeString); // 10MB string → event loop trava

// ✅ Processar em chunks com stream
const { Transform } = require('stream');
const JSONStream = require('jsonstream2');

readableStream
  .pipe(JSONStream.parse('items.*'))
  .on('data', (item) => {
    processItem(item); // Processa um por vez
  });

// ✅ Worker thread para CPU-bound
const { Worker } = require('worker_threads');

function heavyComputation(data) {
  return new Promise((resolve, reject) => {
    const worker = new Worker('./worker.js', { workerData: data });
    worker.on('message', resolve);
    worker.on('error', reject);
  });
}
```

---

## 5. Profiling em Produção

```
Profiling em produção é NECESSÁRIO — dev não reproduz
condições reais (dados, concorrência, tráfego).

Regras:
├── Sampling APENAS (nunca instrumentation em prod)
├── Overhead < 5% (medir o overhead do profiler!)
├── Tempo limitado (profile por 30s-2min, não 24h)
├── Proteger endpoint de debug com auth forte
├── Não logar dados sensíveis no profile
└── Ter kill switch (desligar profiling remotamente)
```

```javascript
// Profiling on-demand em produção
const inspector = require('inspector');

app.post('/debug/cpu-profile', adminAuth, async (req, res) => {
  const session = new inspector.Session();
  session.connect();

  session.post('Profiler.enable');
  session.post('Profiler.start');

  // Profile por N segundos
  const duration = Math.min(req.query.seconds || 10, 30); // Max 30s
  await new Promise(r => setTimeout(r, duration * 1000));

  session.post('Profiler.stop', (err, { profile }) => {
    session.disconnect();
    // Salvar profile (não retornar ao client — pode ser grande)
    const filename = `/tmp/cpu-${Date.now()}.cpuprofile`;
    fs.writeFileSync(filename, JSON.stringify(profile));
    res.json({ filename, duration });
  });
});
```

---

## 6. Ferramentas por Ecossistema

| Ferramenta | Tipo | Overhead | Produção? |
|-----------|------|---------|-----------|
| `node --prof` | CPU sampling | ~2% | Sim (com cuidado) |
| `node --cpu-prof` | CPU sampling (Chrome format) | ~2% | Sim |
| `node --heap-prof` | Memory allocation | ~5% | Cautelosamente |
| clinic.js | Diagnóstico automatizado | ~5% | Staging |
| 0x | Flame graph | ~3% | Staging |
| autocannon | HTTP benchmarking | N/A | Staging |
| py-spy | Python sampling | <1% | Sim |
| perf (Linux) | System-wide profiling | <1% | Sim |
| Datadog APM | Distributed tracing | ~2% | Sim |
| Chrome DevTools | Frontend profiling | N/A | Dev |
