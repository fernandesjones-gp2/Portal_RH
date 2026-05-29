# Animation Patterns — Micro-Interações Clean

## Índice
1. Filosofia de Animação
2. Keyframes Base (CSS)
3. Scroll Reveal
4. Hover States
5. Loading & Transitions
6. Navbar Animations
7. React Animation Patterns
8. Performance Rules

---

## 1. Filosofia de Animação

> "A melhor animação é aquela que você sente mas não vê."

### Regras Fundamentais

1. **Duration**: 200-400ms para micro-interações, 500-700ms para reveals
2. **Easing**: Sempre `cubic-bezier(0.4, 0, 0.2, 1)` — nunca `linear` para UI
3. **Purpose**: Toda animação responde a uma ação do usuário ou guia a atenção
4. **Subtlety**: translateY máximo de 20px, opacity de 0→1, scale de 0.95→1
5. **No Layout Shift**: Animar apenas `transform` e `opacity` (GPU-accelerated)

### O que animar:
- `opacity` — fade in/out
- `transform: translateY()` — subir suavemente
- `transform: scale()` — crescer/encolher suavemente
- `box-shadow` — elevar no hover
- `background-color` — transição de cor

### O que NUNCA animar:
- `width`, `height` (causa reflow)
- `margin`, `padding` (causa reflow)
- `top`, `left` (prefira transform)
- Propriedades que afetam o layout de outros elementos

---

## 2. Keyframes Base (CSS)

Copiar estas keyframes no `<style>` de todo projeto:

```css
/* === KEYFRAMES ESSENCIAIS === */

/* Fade in de baixo para cima (o mais usado) */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Fade in simples */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Fade in da esquerda */
@keyframes fadeInLeft {
  from {
    opacity: 0;
    transform: translateX(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

/* Fade in da direita */
@keyframes fadeInRight {
  from {
    opacity: 0;
    transform: translateX(20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

/* Scale in (para modais, popovers) */
@keyframes scaleIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

/* Slide down (para dropdowns, menus) */
@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Pulse sutil (para notificações, badges) */
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

/* Skeleton loading shimmer */
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

/* Float (para elementos decorativos) */
@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

/* === UTILITY CLASSES === */

.animate-fade-in-up {
  animation: fadeInUp 0.6s cubic-bezier(0.4, 0, 0.2, 1) both;
}
.animate-fade-in {
  animation: fadeIn 0.5s cubic-bezier(0.4, 0, 0.2, 1) both;
}
.animate-scale-in {
  animation: scaleIn 0.3s cubic-bezier(0.4, 0, 0.2, 1) both;
}
.animate-slide-down {
  animation: slideDown 0.3s cubic-bezier(0.4, 0, 0.2, 1) both;
}

/* Staggered delays — para grids e listas */
.delay-1 { animation-delay: 50ms; }
.delay-2 { animation-delay: 100ms; }
.delay-3 { animation-delay: 150ms; }
.delay-4 { animation-delay: 200ms; }
.delay-5 { animation-delay: 250ms; }
.delay-6 { animation-delay: 300ms; }
.delay-7 { animation-delay: 350ms; }
.delay-8 { animation-delay: 400ms; }
```

---

## 3. Scroll Reveal

Elementos aparecem conforme o usuário faz scroll. SUTIL — translateY máximo de 20px.

### CSS-only com Intersection Observer

```html
<style>
/* Estado inicial: invisível e abaixo */
.reveal {
  opacity: 0;
  transform: translateY(20px);
  transition: opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1),
              transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Estado revelado */
.reveal.visible {
  opacity: 1;
  transform: translateY(0);
}

/* Stagger para children */
.reveal-stagger > .reveal:nth-child(1) { transition-delay: 0ms; }
.reveal-stagger > .reveal:nth-child(2) { transition-delay: 80ms; }
.reveal-stagger > .reveal:nth-child(3) { transition-delay: 160ms; }
.reveal-stagger > .reveal:nth-child(4) { transition-delay: 240ms; }
.reveal-stagger > .reveal:nth-child(5) { transition-delay: 320ms; }
.reveal-stagger > .reveal:nth-child(6) { transition-delay: 400ms; }
</style>

<script>
// Intersection Observer — revelar elementos ao entrar no viewport
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target); // Animar apenas uma vez
    }
  });
}, {
  threshold: 0.1,      // 10% visível para ativar
  rootMargin: '0px 0px -50px 0px'  // Ativa um pouco antes de chegar
});

document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
</script>
```

### Uso em HTML

```html
<!-- Elemento individual -->
<div class="reveal">
  <h2>Título da seção</h2>
</div>

<!-- Grid com stagger -->
<div class="reveal-stagger" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem;">
  <div class="reveal">Card 1</div>
  <div class="reveal">Card 2</div>
  <div class="reveal">Card 3</div>
</div>
```

### React Hook para Scroll Reveal

```jsx
const useScrollReveal = (threshold = 0.1) => {
  const ref = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold, rootMargin: '0px 0px -50px 0px' }
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [threshold]);

  return [ref, isVisible];
};

// Uso:
const RevealSection = ({ children, delay = 0 }) => {
  const [ref, isVisible] = useScrollReveal();
  return (
    <div
      ref={ref}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
        transition: `all 0.6s cubic-bezier(0.4, 0, 0.2, 1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
};
```

---

## 4. Hover States

Todo elemento interativo DEVE ter hover state. Aqui estão os padrões:

### Botões

```css
/* Primary — glow + lift */
.kit-btn--primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 14px rgba(37, 99, 235, 0.3);
}

/* Ghost/Outline — background sutil */
.kit-btn--ghost:hover {
  background: var(--color-bg-subtle);
}
```

### Cards

```css
/* Lift + shadow increase */
.kit-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}

/* Alternativa: borda colorida */
.kit-card:hover {
  border-color: var(--color-primary);
}
```

### Links

```css
/* Underline animado */
.kit-link {
  position: relative;
  text-decoration: none;
}
.kit-link::after {
  content: '';
  position: absolute;
  bottom: -2px;
  left: 0;
  width: 0;
  height: 1.5px;
  background: currentColor;
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.kit-link:hover::after {
  width: 100%;
}
```

### Imagens

```css
/* Zoom sutil dentro de container com overflow hidden */
.kit-image-zoom {
  overflow: hidden;
  border-radius: var(--radius-xl);
}
.kit-image-zoom img {
  transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}
.kit-image-zoom:hover img {
  transform: scale(1.05);
}
```

### Nav Links

```css
/* Highlight ativo */
.kit-nav-link {
  position: relative;
  padding-bottom: 2px;
}
.kit-nav-link::after {
  content: '';
  position: absolute;
  bottom: -4px;
  left: 50%;
  width: 0;
  height: 2px;
  background: var(--color-primary);
  border-radius: 1px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  transform: translateX(-50%);
}
.kit-nav-link:hover::after,
.kit-nav-link.active::after {
  width: 100%;
}
```

---

## 5. Loading & Transitions

### Page Load Animation

Aplicar staggered fade-in nos elementos principais do hero:

```css
.hero-tag      { animation: fadeInUp 0.5s ease both; animation-delay: 0ms; }
.hero-title    { animation: fadeInUp 0.6s ease both; animation-delay: 100ms; }
.hero-subtitle { animation: fadeInUp 0.6s ease both; animation-delay: 200ms; }
.hero-cta      { animation: fadeInUp 0.6s ease both; animation-delay: 300ms; }
```

### Skeleton Loader

```css
.skeleton {
  background: linear-gradient(
    90deg,
    var(--gray-200) 25%,
    var(--gray-100) 50%,
    var(--gray-200) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: var(--radius-md);
}
```

### Page Transition (para SPAs)

```css
.page-enter {
  opacity: 0;
  transform: translateY(10px);
}
.page-enter-active {
  opacity: 1;
  transform: translateY(0);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
```

---

## 6. Navbar Animations

### Background on Scroll

```css
.navbar {
  background: transparent;
  border-bottom: 1px solid transparent;
  transition: background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
}
.navbar.scrolled {
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: saturate(180%) blur(20px);
  -webkit-backdrop-filter: saturate(180%) blur(20px);
  border-bottom-color: var(--color-border);
  box-shadow: var(--shadow-xs);
}
```

### Mobile Menu Slide

```css
.mobile-menu {
  position: fixed;
  inset: 0;
  background: white;
  transform: translateX(100%);
  transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 100;
}
.mobile-menu.open {
  transform: translateX(0);
}

/* Overlay */
.mobile-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0);
  pointer-events: none;
  transition: background 0.3s ease;
  z-index: 99;
}
.mobile-overlay.open {
  background: rgba(0, 0, 0, 0.3);
  pointer-events: auto;
}
```

### Hamburger → X Transform

```css
.hamburger span {
  display: block;
  width: 20px;
  height: 2px;
  background: var(--color-text-primary);
  border-radius: 2px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.hamburger.active span:nth-child(1) {
  transform: rotate(45deg) translate(5px, 5px);
}
.hamburger.active span:nth-child(2) {
  opacity: 0;
  transform: translateX(-10px);
}
.hamburger.active span:nth-child(3) {
  transform: rotate(-45deg) translate(5px, -5px);
}
```

---

## 7. React Animation Patterns

### Staggered Grid Animation

```jsx
const StaggeredGrid = ({ children }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    {React.Children.map(children, (child, i) => (
      <div
        style={{
          animation: 'fadeInUp 0.6s cubic-bezier(0.4, 0, 0.2, 1) both',
          animationDelay: `${i * 80}ms`,
        }}
      >
        {child}
      </div>
    ))}
  </div>
);
```

### Number Counter Animation

```jsx
const AnimatedCounter = ({ target, duration = 2000, prefix = '', suffix = '' }) => {
  const [count, setCount] = useState(0);
  const [ref, isVisible] = useScrollReveal();

  useEffect(() => {
    if (!isVisible) return;
    const start = Date.now();
    const step = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      setCount(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [isVisible, target, duration]);

  return (
    <span ref={ref} className="tabular-nums">
      {prefix}{count.toLocaleString('pt-BR')}{suffix}
    </span>
  );
};
```

---

## 8. Performance Rules

1. **Prefira CSS sobre JS** para animações. JS só quando necessário (scroll-based, counters)
2. **Use `will-change`** com moderação: apenas em elementos que de fato animam
3. **`transform` e `opacity` only** — são as únicas props que não causam reflow/repaint
4. **Evite `animation` em muitos elementos** — prefira `transition` reativa
5. **`prefers-reduced-motion`** — respeitar preferências de acessibilidade:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
  .reveal { opacity: 1; transform: none; }
}
```
