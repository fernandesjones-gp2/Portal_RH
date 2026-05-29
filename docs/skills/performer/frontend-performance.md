# Frontend Performance — Core Web Vitals, Bundle, Rendering

## Índice
1. Core Web Vitals — O Que, Como Medir, Como Otimizar
2. Bundle Size — Análise e Otimização
3. Code Splitting e Lazy Loading
4. Imagens — O Maior Quick Win
5. Rendering Performance (React)
6. SSR, SSG, ISR — Quando Usar
7. Performance Budget no CI

---

## 1. Core Web Vitals

```
LCP (Largest Contentful Paint) — "Quando o conteúdo principal apareceu?"
  Good: < 2.5s | Needs Improvement: 2.5-4s | Poor: > 4s
  O que afeta: Imagens hero, fonts, CSS blocking, TTFB lento
  O que medir: Maior imagem ou bloco de texto no viewport

INP (Interaction to Next Paint) — "Quão rápido responde ao clique?"
  Good: < 200ms | Needs Improvement: 200-500ms | Poor: > 500ms
  O que afeta: JS pesado no main thread, hydration lenta
  Substitui FID desde março 2024

CLS (Cumulative Layout Shift) — "A página pula?"
  Good: < 0.1 | Needs Improvement: 0.1-0.25 | Poor: > 0.25
  O que afeta: Imagens sem dimensão, fonts swap, ads injetados
```

### Como medir

```javascript
// RUM (Real User Monitoring) com web-vitals
import { onLCP, onINP, onCLS } from 'web-vitals';

function sendToAnalytics(metric) {
  fetch('/api/vitals', {
    method: 'POST',
    body: JSON.stringify({
      name: metric.name,
      value: metric.value,
      rating: metric.rating, // 'good' | 'needs-improvement' | 'poor'
      navigationType: metric.navigationType,
    }),
    keepalive: true,
  });
}

onLCP(sendToAnalytics);
onINP(sendToAnalytics);
onCLS(sendToAnalytics);
```

### Otimização LCP

```
Diagnóstico → Fix:

TTFB alto (> 800ms)?
├── CDN para assets estáticos
├── Edge rendering (Vercel Edge, Cloudflare Workers)
├── Cache de páginas (SSG ou ISR)
└── Otimizar server response (backend performance)

Recurso LCP demora para carregar?
├── Imagem hero: preload + fetchpriority="high"
│   <link rel="preload" as="image" href="/hero.webp" fetchpriority="high">
├── Font: preload + font-display: swap
│   <link rel="preload" as="font" href="/font.woff2" crossorigin>
└── CSS: inline critical CSS, defer o resto

Recurso LCP bloqueado por JS?
├── defer/async em scripts não-críticos
├── Code splitting (não carregar toda a app de uma vez)
└── Mover analytics/tracking para after load
```

### Otimização CLS

```html
<!-- ✅ Sempre definir dimensões em imagens -->
<img src="hero.webp" width="800" height="400" alt="..." />

<!-- ✅ Aspect ratio com CSS -->
<div style="aspect-ratio: 16/9;">
  <img src="hero.webp" style="width: 100%; height: auto;" />
</div>

<!-- ✅ Font display swap (previne flash de texto invisível) -->
@font-face {
  font-family: 'Custom';
  src: url('/font.woff2') format('woff2');
  font-display: swap;
}

<!-- ✅ Skeleton loader para conteúdo dinâmico -->
<!-- Em vez de nada → conteúdo (layout shift), mostrar skeleton → conteúdo (sem shift) -->
```

---

## 2. Bundle Size — Análise e Otimização

### Medir

```bash
# Webpack
npx webpack-bundle-analyzer dist/stats.json
# Gera treemap visual de cada módulo no bundle

# Vite
npx vite-bundle-visualizer
# Ou: ANALYZE=true vite build

# Next.js
ANALYZE=true next build
# Requer @next/bundle-analyzer configurado

# Verificar size de qualquer pacote npm ANTES de instalar
npx bundlephobia <package-name>
# Ou: https://bundlephobia.com
```

### Budgets

```
Bundle Budget por tipo de app:

E-commerce / Marketing:
├── Total JS: < 150KB gzipped (mobile importa MUITO)
├── Total CSS: < 30KB gzipped
├── Rota inicial: < 100KB JS gzipped
└── Cada rota adicional: < 50KB JS gzipped

SaaS / Dashboard:
├── Total JS: < 300KB gzipped (mais tolerante)
├── Total CSS: < 50KB gzipped
├── Rota inicial: < 150KB JS gzipped
└── Cada rota adicional: < 80KB JS gzipped

Referência: Cada 100KB de JS ≈ 300-500ms de parse em mobile mid-range.
```

### Otimizações

```javascript
// 1. Tree shaking — importar apenas o que usa
// ❌ Importa TODA a lib
import _ from 'lodash'; // 71KB gzipped!
_.get(obj, 'path');

// ✅ Import específico (tree-shakeable)
import get from 'lodash/get'; // 1KB

// ❌ Importa TODOS os ícones
import { icons } from 'lucide-react'; // 200KB

// ✅ Import específico
import { Search, Menu } from 'lucide-react'; // 2KB

// 2. Dynamic import para features opcionais
// ❌ Sempre carrega o editor de markdown
import { MarkdownEditor } from './MarkdownEditor'; // 150KB

// ✅ Carrega sob demanda
const MarkdownEditor = lazy(() => import('./MarkdownEditor'));
// Só baixa quando o componente renderiza

// 3. Substituir libs pesadas por alternativas leves
// moment.js (300KB) → date-fns (tree-shakeable) ou dayjs (2KB)
// lodash (71KB) → lodash-es (tree-shakeable) ou funções nativas
// axios (13KB) → fetch nativo (0KB)
// chart.js (200KB) → lightweight chart lib se precisa de poucos charts
```

---

## 3. Code Splitting e Lazy Loading

```javascript
// React — Route-based splitting (o MAIS impactante)
import { lazy, Suspense } from 'react';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Settings = lazy(() => import('./pages/Settings'));
const Reports = lazy(() => import('./pages/Reports'));

function App() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/reports" element={<Reports />} />
      </Routes>
    </Suspense>
  );
}

// Next.js — Dynamic import
import dynamic from 'next/dynamic';

const HeavyChart = dynamic(() => import('@/components/HeavyChart'), {
  loading: () => <ChartSkeleton />,
  ssr: false, // Não precisa renderizar no server
});

// Component-level splitting (features opcionais)
const AdminPanel = lazy(() => import('./AdminPanel'));
// Só carrega se user é admin e abre o painel
{isAdmin && showPanel && (
  <Suspense fallback={<Spinner />}>
    <AdminPanel />
  </Suspense>
)}
```

---

## 4. Imagens — O Maior Quick Win

```html
<!-- Budget: maior imagem < 200KB. Hero image < 150KB. -->

<!-- ✅ Formato moderno + fallback -->
<picture>
  <source srcset="/hero.avif" type="image/avif" />
  <source srcset="/hero.webp" type="image/webp" />
  <img src="/hero.jpg" alt="..." width="1200" height="600"
       loading="eager" fetchpriority="high" decoding="async" />
</picture>

<!-- ✅ Responsive images (srcset) -->
<img
  srcset="hero-400.webp 400w, hero-800.webp 800w, hero-1200.webp 1200w"
  sizes="(max-width: 600px) 400px, (max-width: 1000px) 800px, 1200px"
  src="hero-800.webp"
  alt="..."
  loading="lazy"
  decoding="async"
/>

<!-- Regras:
  - Above the fold: loading="eager" + fetchpriority="high"
  - Below the fold: loading="lazy"
  - Sempre: width + height (previne CLS)
  - Formato: AVIF > WebP > JPEG (quality 75-85)
  - Não servir 2000px para tela de 400px (srcset!)
-->
```

```
Compressão de imagem:
├── AVIF: ~50% menor que JPEG (suporte 92%+ browsers)
├── WebP: ~30% menor que JPEG (suporte 97%+ browsers)
├── JPEG: quality 75-85 é sweet spot (indistinguível de 100)
├── PNG: apenas quando precisa de transparência (considerar WebP)
└── SVG: para ícones e ilustrações vetoriais (inline quando < 2KB)
```

---

## 5. Rendering Performance (React)

### Detectar re-renders

```javascript
// React DevTools → Profiler → Record → Interagir → Analisar
// Componentes amarelos/vermelhos = re-renderizaram
// Verificar: PRECISA re-renderizar? Se os props não mudaram, não.

// React DevTools → Settings → Highlight updates → check
// Mostra visualmente quais componentes re-renderizam em tempo real
```

### Otimizar re-renders

```javascript
// 1. React.memo — Só re-renderiza se props mudaram
const ProductCard = React.memo(({ product, onAddToCart }) => {
  return (
    <div>
      <h3>{product.name}</h3>
      <button onClick={() => onAddToCart(product.id)}>Add</button>
    </div>
  );
});

// 2. useMemo — Memoizar cálculos caros
function OrderSummary({ items }) {
  const total = useMemo(() =>
    items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [items] // Recalcula APENAS se items mudar
  );
  return <span>Total: {formatCurrency(total)}</span>;
}

// 3. useCallback — Estabilizar referência de funções
function ProductList({ products }) {
  const handleAddToCart = useCallback((productId) => {
    cartService.add(productId);
  }, []); // Mesma referência entre renders

  return products.map(p =>
    <ProductCard key={p.id} product={p} onAddToCart={handleAddToCart} />
  );
}

// 4. Virtualização para listas longas (1000+ itens)
import { FixedSizeList } from 'react-window';

function LongList({ items }) {
  return (
    <FixedSizeList height={600} itemCount={items.length} itemSize={50}>
      {({ index, style }) => (
        <div style={style}>{items[index].name}</div>
      )}
    </FixedSizeList>
  );
}
// Renderiza apenas ~15 itens visíveis, não todos os 1000
```

### Quando NÃO otimizar

```
React.memo/useMemo/useCallback NÃO são grátis.
Têm custo de memória e comparação.

NÃO usar quando:
├── Componente é simples e re-render é barato (< 1ms)
├── Props mudam quase toda vez (memo compara e rerenderiza anyway)
├── Componente não tem filhos pesados
└── Não há evidência de performance problem (premature optimization)

USAR quando:
├── Componente renderiza lista grande de filhos
├── Cálculo é O(n) ou pior e n é grande
├── Componente consome context que muda frequentemente
├── Profiler mostra re-renders desnecessários > 5ms
└── Componente faz fetch/effect e re-render triggera refetch
```

---

## 6. SSR, SSG, ISR — Quando Usar

| Estratégia | Quando | Exemplo | TTFB | Fresh data? |
|-----------|--------|---------|------|-------------|
| **SSG** (Static) | Conteúdo muda raramente | Blog, docs, landing | ~50ms (CDN) | Build time |
| **ISR** (Incremental) | Conteúdo muda periodicamente | Produtos, perfis | ~50ms (CDN) | revalidate: N |
| **SSR** (Server) | Conteúdo personalizado | Dashboard, feed | ~200ms+ | Sempre fresh |
| **CSR** (Client) | Altamente interativo | Editor, dashboard complexo | ~100ms + JS | Client fetch |

```
Regra prática:
├── É público e muda pouco? → SSG (blog, docs, marketing)
├── É público e muda diariamente? → ISR (e-commerce, listings)
├── É personalizado por user? → SSR (dashboard, feed, cart)
├── É muito interativo pós-load? → CSR (editor, canvas, games)
└── Híbrido é ok: SSR shell + CSR para interatividade
```

---

## 7. Performance Budget no CI

```javascript
// lighthouserc.js — Lighthouse CI
module.exports = {
  ci: {
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.85 }],
        'first-contentful-paint': ['warn', { maxNumericValue: 2000 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        'total-byte-weight': ['warn', { maxNumericValue: 500000 }], // 500KB
      },
    },
  },
};
```

```javascript
// bundlesize.config.js — Bundle size check
module.exports = {
  files: [
    { path: 'dist/js/*.js', maxSize: '200 kB', compression: 'gzip' },
    { path: 'dist/css/*.css', maxSize: '30 kB', compression: 'gzip' },
    { path: 'dist/js/vendor*.js', maxSize: '120 kB', compression: 'gzip' },
  ],
};
```

```yaml
# .github/workflows/perf.yml
- name: Bundle size check
  run: npx bundlesize
  env:
    BUNDLESIZE_GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    # Comenta na PR se bundle exceder budget
```
