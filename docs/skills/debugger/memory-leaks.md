# Memory Leaks — Detectar, Diagnosticar e Corrigir

## Índice
1. Sintomas de Memory Leak
2. Como a Memória Funciona (GC)
3. Memory Leaks em Node.js
4. Memory Leaks no Browser
5. Memory Leaks em Python
6. Heap Snapshots — Como Usar
7. Patterns Comuns (e Fixes)

---

## 1. Sintomas de Memory Leak

```
Sintomas observáveis:
├── Memória cresce ao longo do tempo (horas/dias) sem cair
├── OOM Killed (process exit code 137 = SIGKILL)
├── App fica mais lenta gradualmente (GC cada vez mais pesado)
├── Restarts frequentes "resolvem" temporariamente
├── Soak test (k6 por horas) mostra memória subindo linearmente
└── Container reinicia sozinho (health check + OOM)

Como confirmar:
├── Monitorar RSS (Resident Set Size) ao longo de horas
├── Comparar: sob carga constante, a memória deveria estabilizar
├── Se sobe e NUNCA desce → leak confirmado
├── Se sobe e desce ciclicamente → GC normal, não é leak
```

```bash
# Monitorar memória de processo Node.js
node --expose-gc -e "
  setInterval(() => {
    const mem = process.memoryUsage();
    console.log({
      rss: (mem.rss / 1024 / 1024).toFixed(1) + 'MB',
      heapUsed: (mem.heapUsed / 1024 / 1024).toFixed(1) + 'MB',
      heapTotal: (mem.heapTotal / 1024 / 1024).toFixed(1) + 'MB',
    });
  }, 5000);
"
```

---

## 2. Como a Memória Funciona (GC)

```
JavaScript (V8 Garbage Collector):

Memória:
├── Stack: Primitivos, referências (gerenciado automaticamente)
├── Heap: Objetos, arrays, closures, strings (GC gerencia)
└── External: Buffers, streams (fora do heap V8)

GC libera memória de objetos que NÃO TÊM REFERÊNCIA.
Se um objeto ainda tem referência (mesmo que você "esqueceu"),
o GC NÃO pode liberar → LEAK.

Leak = referência mantida acidentalmente que impede o GC.

Causas mais comuns:
├── Event listeners acumulando (adicionados mas nunca removidos)
├── Closures capturando escopo grande (função segura referência)
├── Cache/Map/Array global crescendo infinitamente
├── Timers (setInterval) nunca cancelados
├── Promises pendentes acumulando
└── Referências circulares com finalizers
```

---

## 3. Memory Leaks em Node.js

### Leak #1: Event Listeners

```javascript
// ❌ LEAK — listener adicionado em cada request mas nunca removido
app.get('/stream', (req, res) => {
  const handler = (data) => res.write(data);
  eventEmitter.on('data', handler); // Adicionado a cada request!
  // Se o client desconecta, o handler continua no emitter
});
// Após 10.000 requests → 10.000 handlers na memória

// ✅ FIX — remover listener no cleanup
app.get('/stream', (req, res) => {
  const handler = (data) => res.write(data);
  eventEmitter.on('data', handler);

  req.on('close', () => {
    eventEmitter.removeListener('data', handler); // Limpar!
  });
});
```

### Leak #2: Cache sem limite

```javascript
// ❌ LEAK — cache cresce infinitamente
const cache = new Map();

function getCached(key) {
  if (cache.has(key)) return cache.get(key);
  const value = expensiveComputation(key);
  cache.set(key, value); // Nunca remove! Depois de 1M keys = GB de memória
  return value;
}

// ✅ FIX — LRU cache com limite
import { LRUCache } from 'lru-cache';

const cache = new LRUCache({
  max: 1000,                    // Máximo 1000 itens
  ttl: 1000 * 60 * 5,          // TTL de 5 minutos
  maxSize: 50 * 1024 * 1024,    // Máximo 50MB
  sizeCalculation: (value) => JSON.stringify(value).length,
});
```

### Leak #3: Closures segurando referência grande

```javascript
// ❌ LEAK — closure captura 'largeData' mesmo que só use 'id'
function processRequest(largeData) {
  const id = largeData.id;

  return new Promise((resolve) => {
    setTimeout(() => {
      // Closure captura TODO o escopo, incluindo largeData (10MB)
      resolve(id);
    }, 60000);
  });
  // largeData fica na memória por 60 segundos por request
}

// ✅ FIX — extrair apenas o necessário ANTES da closure
function processRequest(largeData) {
  const id = largeData.id;  // Extrair antes
  largeData = null;          // Liberar referência

  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(id); // Closure só captura 'id' (poucos bytes)
    }, 60000);
  });
}
```

### Leak #4: setInterval sem clearInterval

```javascript
// ❌ LEAK — interval nunca cancelado
class Poller {
  start() {
    setInterval(() => {
      this.poll(); // Roda para sempre, mesmo se Poller não é mais usado
    }, 5000);
  }
}

// ✅ FIX — salvar referência e limpar
class Poller {
  #intervalId = null;

  start() {
    this.#intervalId = setInterval(() => this.poll(), 5000);
  }

  stop() {
    if (this.#intervalId) {
      clearInterval(this.#intervalId);
      this.#intervalId = null;
    }
  }
}
```

---

## 4. Memory Leaks no Browser

```javascript
// Leak #1: DOM detached (removeu do DOM mas mantém referência JS)
let detachedNode;
function leak() {
  const div = document.createElement('div');
  document.body.appendChild(div);
  detachedNode = div; // Referência no JS
  document.body.removeChild(div); // Removeu do DOM
  // Mas detachedNode ainda referencia! GC não libera.
}

// Leak #2: Event listener não removido em SPA
useEffect(() => {
  const handler = () => { /* ... */ };
  window.addEventListener('resize', handler);
  // ❌ Esqueceu o cleanup! A cada mount, adiciona novo listener.
  // Se componente monta/desmonta 100x → 100 listeners.

  // ✅ FIX: return cleanup
  return () => window.removeEventListener('resize', handler);
}, []);

// Leak #3: Timer em componente sem cleanup
useEffect(() => {
  const id = setInterval(() => fetchData(), 5000);
  return () => clearInterval(id); // OBRIGATÓRIO
}, []);
```

---

## 5. Memory Leaks em Python

```python
# Leak #1: Lista/dict global crescendo
_cache = []  # Módulo-level = vive para sempre

def process(data):
    result = heavy_computation(data)
    _cache.append(result)  # Nunca limpa!
    return result

# Fix: usar maxlen ou lru_cache
from functools import lru_cache
from collections import deque

_cache = deque(maxlen=1000)  # Auto-limpa quando excede

@lru_cache(maxsize=1000)  # Cache com limite built-in
def process(data_key):
    return heavy_computation(data_key)

# Leak #2: Referência circular com __del__
class Node:
    def __init__(self):
        self.parent = None
        self.children = []

    def __del__(self):  # Com __del__, GC não consegue liberar ciclos!
        pass

# Fix: usar weakref
import weakref
class Node:
    def __init__(self):
        self._parent = None  # weakref
        self.children = []

    @property
    def parent(self):
        return self._parent() if self._parent else None

    @parent.setter
    def parent(self, value):
        self._parent = weakref.ref(value) if value else None
```

---

## 6. Heap Snapshots — Como Usar

### Node.js

```javascript
// 1. Tirar snapshot programaticamente
const v8 = require('v8');
const fs = require('fs');

function takeHeapSnapshot() {
  const filename = `/tmp/heap-${Date.now()}.heapsnapshot`;
  const snapshotStream = v8.writeHeapSnapshot(filename);
  console.log(`Heap snapshot written to ${snapshotStream}`);
}

// Endpoint para tirar snapshot em produção (proteger com auth!)
app.get('/debug/heap', adminAuth, (req, res) => {
  const filename = v8.writeHeapSnapshot();
  res.json({ filename });
});

// 2. Comparar 2 snapshots:
//    - Snapshot 1: logo após iniciar
//    - Esperar e processar N requests
//    - Snapshot 2: depois de N requests
//    - Chrome DevTools → Memory → Load snapshot
//    - Comparar: objetos que existem no 2 mas não no 1 = LEAK

// 3. No Chrome DevTools:
//    - Memory tab → Take Heap Snapshot
//    - Comparison view entre 2 snapshots
//    - Ordenar por "Alloc. Size" ou "# New"
//    - Procurar: (string), (array), (closure) com crescimento anormal
```

### Diagnóstico com --inspect

```bash
# Iniciar Node com debugger
node --inspect src/server.js

# Abrir Chrome: chrome://inspect
# → Click "inspect" no target
# → Memory tab → Take heap snapshot
# → Rodar cenário de teste
# → Take outro snapshot
# → Comparison view
```

---

## 7. Patterns Comuns (e Fixes)

| Pattern | Causa | Fix |
|---------|-------|-----|
| Event listener em loop | `.on()` em cada request sem `.removeListener()` | Sempre remover no cleanup/close |
| Cache sem eviction | `Map/Object` global sem limite | LRU cache com maxSize/TTL |
| Closure capturando escopo | Função anônima em timer/promise referencia objeto grande | Extrair dados necessários antes da closure |
| setInterval sem clear | Interval criado mas nunca cancelado | clearInterval no shutdown/cleanup |
| Streams não drenados | Readable stream criado mas nunca consumido | Sempre pipe ou destroy streams |
| Buffers acumulados | Concatenar buffers em loop sem liberar | Usar stream pipeline |
| WeakRef não usado | Referência forte para cache de objetos grandes | WeakRef/WeakMap para cache de referência |
| DB connections leaked | Pool abre conexão, erro impede retorno ao pool | try/finally para sempre retornar conexão |
