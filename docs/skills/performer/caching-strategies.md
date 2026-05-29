# Caching Strategies — Redis, CDN, HTTP, Memoization

## Índice
1. Cache Decision Framework
2. Redis Caching Patterns
3. HTTP Caching (Cache-Control)
4. CDN Caching
5. Application-Level Memoization
6. Cache Invalidation
7. Cache Stampede Prevention

---

## 1. Cache Decision Framework

```
Cachear quando:
├── Dados mudam pouco vs frequência de leitura (read-heavy)
├── Custo de computar/buscar é alto (query pesada, API lenta)
├── Tolerância a dados stale é aceitável (1 min? 1 hora?)
├── Mesmo resultado para mesmos inputs (determinístico)
└── Acessado frequentemente por múltiplos consumers

NÃO cachear quando:
├── Dados mudam a cada request (saldo em tempo real)
├── Custo de buscar é baixo (query simples com índice = 5ms)
├── Dados são únicos por user e raramente acessados
├── Requisito de dados 100% fresh (sem tolerância a stale)
└── Complexidade de invalidação > benefício do cache

Trade-off universal:
CACHE = mais velocidade + mais complexidade + dados potencialmente stale
```

```
Camadas de cache (de mais rápida a mais lenta):

1. Browser cache (Cache-Control, ETag)    0ms    Client-side
2. CDN edge cache (CloudFront, Cloudflare) 5ms    Edge
3. Application cache (in-memory, LRU)      <1ms   App process
4. Distributed cache (Redis)               1-5ms  Shared
5. Database cache (query cache, buffer)    5-20ms  DB
6. Sem cache (recomputa tudo)              50ms+  Full
```

---

## 2. Redis Caching Patterns

### Cache-Aside (Lazy Loading)

```javascript
// O pattern MAIS COMUM. App gerencia o cache manualmente.

async function getProduct(productId) {
  const cacheKey = `product:${productId}`;

  // 1. Tentar cache primeiro
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  // 2. Cache miss → buscar no banco
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { category: true },
  });

  if (!product) return null;

  // 3. Salvar no cache com TTL
  await redis.set(cacheKey, JSON.stringify(product), 'EX', 300); // 5 min

  return product;
}

// Invalidar quando produto muda
async function updateProduct(productId, data) {
  const product = await prisma.product.update({ where: { id: productId }, data });
  await redis.del(`product:${productId}`); // Invalidar cache
  return product;
}
```

### Write-Through

```javascript
// Escreve no cache E no banco simultaneamente.
// Garante que cache está sempre atualizado.

async function updateProduct(productId, data) {
  const product = await prisma.product.update({ where: { id: productId }, data });

  // Atualizar cache imediatamente (não deletar)
  await redis.set(`product:${productId}`, JSON.stringify(product), 'EX', 300);

  return product;
}
```

### Cache com Hash (múltiplos campos)

```javascript
// Para objetos com campos acessados individualmente
await redis.hset('user:123', {
  name: 'Maria',
  email: 'maria@test.com',
  role: 'admin',
  lastLogin: new Date().toISOString(),
});

// Buscar campo específico (sem desserializar tudo)
const role = await redis.hget('user:123', 'role');

// Buscar tudo
const user = await redis.hgetall('user:123');
```

### TTL Strategy

```
TTL por tipo de dado:

Dados estáticos (categorias, configs):    1 hora — 24 horas
Dados semi-estáticos (produtos, perfis):  5 min — 1 hora
Dados frequentes (listagens, feeds):      30s — 5 min
Dados de sessão (auth, cart):             15 min — 24 horas
Dados computados (relatórios, agregações): 5 min — 1 hora

Regra: TTL = "quanto tempo de dados stale o user tolera?"
```

---

## 3. HTTP Caching (Cache-Control)

```javascript
// Assets estáticos (JS, CSS, imagens com hash no nome)
app.use('/static', express.static('public', {
  maxAge: '1y',            // Cache por 1 ano
  immutable: true,         // Nunca revalidar (conteúdo muda → URL muda)
}));
// Cache-Control: public, max-age=31536000, immutable
// Funciona porque: main.a1b2c3.js → se conteúdo muda, hash muda → nova URL

// API responses (cache curto + revalidação)
app.get('/api/products', (req, res) => {
  res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
  // max-age=60: cache válido por 1 minuto
  // stale-while-revalidate=300: após 1 min, servir stale enquanto busca fresh (5 min)
  res.json(products);
});

// Dados personalizados (NÃO cachear em CDN/proxy)
app.get('/api/me', auth, (req, res) => {
  res.set('Cache-Control', 'private, no-cache');
  // private: apenas browser do user pode cachear (não CDN)
  // no-cache: sempre revalidar com servidor (ETag/If-None-Match)
  res.json(user);
});

// Dados sensíveis (NUNCA cachear)
app.get('/api/me/payment-methods', auth, (req, res) => {
  res.set('Cache-Control', 'no-store');
  // Não armazenar em nenhum cache, nunca
  res.json(paymentMethods);
});
```

### ETag (validação de cache)

```javascript
import etag from 'etag';

app.get('/api/products', (req, res) => {
  const products = await getProducts();
  const body = JSON.stringify(products);
  const tag = etag(body);

  // Se client já tem essa versão, retornar 304
  if (req.headers['if-none-match'] === tag) {
    return res.status(304).end(); // Not Modified — sem body, muito rápido
  }

  res.set('ETag', tag);
  res.set('Cache-Control', 'public, max-age=0, must-revalidate');
  res.json(products);
});
```

---

## 4. CDN Caching

```
CDN serve conteúdo do edge server mais PRÓXIMO do user.
São Paulo → edge SP (5ms) vs São Paulo → origin US-East (150ms).

O que cachear no CDN:
├── Assets estáticos (JS, CSS, fonts, imagens): Cache-Control: public, max-age=1y, immutable
├── Páginas SSG: Cache-Control: public, s-maxage=3600 (1h no CDN, revalidar)
├── API read-only pública: Cache-Control: public, s-maxage=60 (1min)
└── HTML da SPA: Cache-Control: public, max-age=0, s-maxage=600 (10min CDN, always revalidate client)

O que NÃO cachear no CDN:
├── Respostas autenticadas (Cart, profile, dashboard)
├── POST/PUT/DELETE
├── Dados em tempo real (WebSocket, SSE)
└── Dados sensíveis (Vary: Cookie é perigoso)
```

```
// s-maxage vs max-age:
// max-age: Browser cache duration
// s-maxage: CDN/proxy cache duration (overrides max-age for CDN)
Cache-Control: public, max-age=0, s-maxage=3600
// Browser: sempre revalidar. CDN: cachear por 1 hora.
```

---

## 5. Application-Level Memoization

```javascript
// In-memory LRU cache para dados quentes
import { LRUCache } from 'lru-cache';

const productCache = new LRUCache({
  max: 500,                     // Máximo 500 itens
  ttl: 5 * 60 * 1000,          // 5 minutos
  maxSize: 50 * 1024 * 1024,   // 50MB total
  sizeCalculation: (v) => JSON.stringify(v).length,
});

// LRU vs Redis:
// LRU: <0.1ms, processo-local, perde no restart, não compartilha entre instâncias
// Redis: 1-5ms, distribuído, persiste, compartilha entre instâncias
// Usar LRU para: hot path, dados acessados 100x/s, quando stale por poucos segundos é ok
// Usar Redis para: dados compartilhados, invalidação cross-instance, TTL maiores

// React — useMemo (cache entre renders)
const expensiveResult = useMemo(() => {
  return items.filter(filterFn).sort(sortFn).map(transformFn);
}, [items, filterFn, sortFn]); // Recalcula APENAS se dependências mudam
```

---

## 6. Cache Invalidation

```
"Existem apenas duas coisas difíceis em ciência da computação:
invalidação de cache e dar nomes às coisas." — Phil Karlton

Estratégias:

1. TTL (Time-To-Live) — mais simples
   Set TTL = tolerância a stale. Não precisa invalidar manualmente.
   Pro: Simples. Contra: Dados podem estar stale até TTL.

2. Event-based invalidation — quando dados mudam
   Após UPDATE/DELETE → deletar cache key.
   Pro: Cache sempre fresh. Contra: Precisa garantir que TODA mudança invalida.

3. Versioned keys — nunca invalidar, apenas criar nova key
   product:v5:123 → quando muda → product:v6:123
   Pro: Sem race condition. Contra: Lixo de keys antigas (TTL resolve).

4. Pub/Sub invalidation — multi-instance
   Instância A atualiza dados → publica "invalidate product:123"
   Instâncias B, C recebem e limpam cache local.
```

```javascript
// Event-based: invalidar ao mudar dados
class ProductService {
  async update(id, data) {
    const product = await this.repo.update(id, data);

    // Invalidar TODAS as caches que contêm este produto
    await Promise.all([
      redis.del(`product:${id}`),
      redis.del(`product-list:all`),
      redis.del(`category:${product.categoryId}:products`),
    ]);

    return product;
  }
}
```

---

## 7. Cache Stampede Prevention

```
Stampede: cache expira + 100 requests simultâneos = 100 queries ao banco
(todos veem cache miss, todos vão ao banco ao mesmo tempo)

Solução 1: Mutex lock (singleflight)
Apenas 1 request vai ao banco, os outros esperam.
```

```javascript
const locks = new Map();

async function getWithLock(key, fetchFn, ttl) {
  // Tentar cache
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached);

  // Lock: se já tem alguém buscando, esperar
  if (locks.has(key)) {
    return locks.get(key); // Retorna a mesma promise
  }

  // Este request vai buscar
  const promise = (async () => {
    try {
      const data = await fetchFn();
      await redis.set(key, JSON.stringify(data), 'EX', ttl);
      return data;
    } finally {
      locks.delete(key);
    }
  })();

  locks.set(key, promise);
  return promise;
}

// Uso
const products = await getWithLock(
  'products:featured',
  () => prisma.product.findMany({ where: { featured: true } }),
  300 // 5 min TTL
);
```

```
Solução 2: Stale-while-revalidate
Retornar dados stale imediatamente, buscar fresh em background.

Solução 3: Early expiration (probabilistic)
Renovar cache ANTES de expirar. A cada request,
probabilidade = (tempo até expirar / TTL total).
Quanto mais perto de expirar, maior chance de renovar.
```
