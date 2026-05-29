# UI Kit Components — Biblioteca de Componentes

## Índice
1. Princípios do Kit
2. Layout Components
3. Navigation Components
4. Content Components
5. Form Components
6. Action Components
7. Feedback Components
8. Overlay Components
9. Hero Sections

---

## 1. Princípios do Kit

Cada componente tem:
- **Variantes**: Estilos visuais pré-definidos (primary, secondary, ghost, outline)
- **Sizes**: sm, md, lg (quando aplicável)
- **States**: default, hover, focus, active, disabled — todos automáticos, nunca configuráveis
- **Tokens**: Usa APENAS design tokens, nunca valores mágicos

### Zero Override — Props Proibidas

Componentes são opinados. O visual e o comportamento vêm do Design System global.
A página que consome o componente NÃO controla:

- Animação (sempre ativa, definida em `animation-patterns.md`)
- Sombra (definida no token do componente)
- Border radius (definido no token)
- Hover effect (definido no CSS do componente, sempre presente)
- Transição / duração (global em `design-tokens.md`)
- Cor, fonte, espaçamento (tudo vem de tokens)

**Props permitidas em componentes:**
- `variant` — Escolha entre variantes pré-definidas
- `size` — Escolha entre tamanhos pré-definidos
- `children` — Conteúdo interno
- `className` — APENAS para posicionamento (`mt-4`, `col-span-2`), nunca override visual
- Props semânticas: `title`, `text`, `icon`, `href`, `onClick`, `label`, `placeholder`
- Props de estado: `disabled`, `loading`, `active`, `open`, `error`

### Variantes Separadas, Não Props Booleanas

Se um componente precisa de comportamentos diferentes, criar variantes como
componentes distintos — não como props booleanas numa mega-componente.

```
✅ DataTable, DataTableSortable, DataTableSelectable
❌ DataTable sortable={true} selectable={true} paginated={true}
```

### Documentação Obrigatória

Todo componente criado gera uma entrada no `README.md` do projeto seguindo
o template em `references/component-docs-template.md`. Sem doc = entrega incompleta.

Padrão de nomes CSS: `.kit-[componente]--[variante]`
Padrão de nomes Tailwind/React: composição de classes utilitárias

---

## 2. Layout Components

### Container

```html
<!-- Container padrão — centralizado, max-width, padding responsivo -->
<div class="kit-container">
  <!-- conteúdo -->
</div>

<style>
.kit-container {
  width: 100%;
  max-width: var(--container-max);
  margin: 0 auto;
  padding-left: var(--space-6);
  padding-right: var(--space-6);
}
@media (min-width: 1024px) {
  .kit-container { padding-left: var(--space-20); padding-right: var(--space-20); }
}
</style>
```

**React/Tailwind:**
```jsx
const Container = ({ children, className = '' }) => (
  <div className={`w-full max-w-[1200px] mx-auto px-6 lg:px-20 ${className}`}>
    {children}
  </div>
);
```

### Section

```html
<!-- Seção de página — padding vertical generoso -->
<section class="kit-section">
  <div class="kit-container">
    <div class="kit-section__header">
      <span class="kit-section__tag">Features</span>
      <h2 class="kit-section__title">Tudo que você precisa</h2>
      <p class="kit-section__subtitle">Ferramentas poderosas para simplificar seu dia.</p>
    </div>
    <div class="kit-section__content">
      <!-- conteúdo da seção -->
    </div>
  </div>
</section>

<style>
.kit-section {
  padding: var(--space-24) 0;
}
.kit-section--subtle {
  background: var(--color-bg-subtle);
}
.kit-section__header {
  text-align: center;
  max-width: 40rem;
  margin: 0 auto var(--space-16);
}
.kit-section__tag {
  display: inline-block;
  font-family: var(--font-display);
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--color-primary);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wider);
  margin-bottom: var(--space-3);
}
.kit-section__title {
  font-size: var(--text-4xl);
  font-weight: var(--font-bold);
  color: var(--color-text-primary);
  margin-bottom: var(--space-4);
  letter-spacing: var(--tracking-tight);
}
.kit-section__subtitle {
  font-size: var(--text-lg);
  color: var(--color-text-secondary);
  line-height: var(--leading-relaxed);
}
</style>
```

**React/Tailwind:**
```jsx
const Section = ({ tag, title, subtitle, children, subtle = false, className = '' }) => (
  <section className={`py-24 ${subtle ? 'bg-gray-50' : ''} ${className}`}>
    <Container>
      {(tag || title || subtitle) && (
        <div className="text-center max-w-2xl mx-auto mb-16">
          {tag && <span className="inline-block text-sm font-semibold text-blue-600 uppercase tracking-wider mb-3">{tag}</span>}
          {title && <h2 className="text-4xl font-bold text-gray-900 tracking-tight mb-4" style={{ fontFamily: 'var(--font-display)' }}>{title}</h2>}
          {subtitle && <p className="text-lg text-gray-600 leading-relaxed">{subtitle}</p>}
        </div>
      )}
      {children}
    </Container>
  </section>
);
```

### Grid

```jsx
{/* Grid responsivo — 1 col mobile, 2 tablet, 3 desktop */}
const Grid = ({ children, cols = 3, gap = 6, className = '' }) => {
  const colsMap = {
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
  };
  return (
    <div className={`grid ${colsMap[cols]} gap-${gap} ${className}`}>
      {children}
    </div>
  );
};
```

### Divider

```jsx
const Divider = ({ className = '' }) => (
  <hr className={`border-0 border-t border-gray-200 my-8 ${className}`} />
);
```

---

## 3. Navigation Components

### Navbar

O navbar é sticky com backdrop blur e borda inferior sutil. Transparente no topo, ganha background ao scrollar.

```html
<nav class="kit-navbar" id="navbar">
  <div class="kit-container kit-navbar__inner">
    <a href="/" class="kit-navbar__logo">
      <span class="kit-navbar__logo-text">Brand</span>
    </a>
    <div class="kit-navbar__links">
      <a href="#" class="kit-navbar__link">Produto</a>
      <a href="#" class="kit-navbar__link">Preços</a>
      <a href="#" class="kit-navbar__link">Sobre</a>
    </div>
    <div class="kit-navbar__actions">
      <a href="#" class="kit-btn kit-btn--ghost kit-btn--sm">Entrar</a>
      <a href="#" class="kit-btn kit-btn--primary kit-btn--sm">Começar grátis</a>
    </div>
    <button class="kit-navbar__hamburger" aria-label="Menu">
      <span></span><span></span><span></span>
    </button>
  </div>
</nav>

<style>
.kit-navbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: var(--navbar-height);
  z-index: 50;
  background: var(--navbar-bg);
  backdrop-filter: var(--navbar-blur);
  -webkit-backdrop-filter: var(--navbar-blur);
  border-bottom: 1px solid transparent;
  transition: var(--transition);
}
.kit-navbar.scrolled {
  border-bottom-color: var(--color-border);
  box-shadow: var(--shadow-xs);
}
.kit-navbar__inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 100%;
}
.kit-navbar__logo-text {
  font-family: var(--font-display);
  font-size: var(--text-xl);
  font-weight: var(--font-bold);
  color: var(--color-text-primary);
}
.kit-navbar__links {
  display: flex;
  gap: var(--space-8);
}
.kit-navbar__link {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--color-text-secondary);
  transition: var(--transition);
  text-decoration: none;
}
.kit-navbar__link:hover { color: var(--color-text-primary); }
.kit-navbar__actions { display: flex; gap: var(--space-3); align-items: center; }
.kit-navbar__hamburger { display: none; }

@media (max-width: 768px) {
  .kit-navbar__links, .kit-navbar__actions { display: none; }
  .kit-navbar__hamburger {
    display: flex;
    flex-direction: column;
    gap: 5px;
    background: none;
    border: none;
    cursor: pointer;
    padding: var(--space-2);
  }
  .kit-navbar__hamburger span {
    width: 20px;
    height: 2px;
    background: var(--color-text-primary);
    border-radius: 2px;
    transition: var(--transition);
  }
}
</style>

<script>
// Scroll detection para navbar
window.addEventListener('scroll', () => {
  document.getElementById('navbar')
    .classList.toggle('scrolled', window.scrollY > 20);
});
</script>
```

**React/Tailwind:**
```jsx
const Navbar = ({ brand, links, cta }) => {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handler);
    return () => window.removeEventListener('scroll', handler);
  }, []);

  return (
    <nav className={`fixed top-0 inset-x-0 h-16 z-50 transition-all duration-300
      ${scrolled ? 'bg-white/80 backdrop-blur-xl border-b border-gray-200 shadow-sm'
                 : 'bg-transparent'}`}>
      <Container className="flex items-center justify-between h-full">
        <span className="text-xl font-bold text-gray-900" style={{ fontFamily: 'var(--font-display)' }}>
          {brand}
        </span>
        <div className="hidden md:flex items-center gap-8">
          {links.map(l => (
            <a key={l.label} href={l.href}
               className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
              {l.label}
            </a>
          ))}
        </div>
        <div className="hidden md:flex items-center gap-3">
          {cta}
        </div>
      </Container>
    </nav>
  );
};
```

### Footer

```jsx
const Footer = ({ brand, columns, socials }) => (
  <footer className="bg-gray-900 text-gray-400 pt-16 pb-8">
    <Container>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
        <div className="col-span-2 md:col-span-1">
          <span className="text-xl font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>
            {brand}
          </span>
          <p className="text-sm mt-3 leading-relaxed max-w-xs">
            Tornando o complexo simples desde 2024.
          </p>
        </div>
        {columns.map(col => (
          <div key={col.title}>
            <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">{col.title}</h4>
            <ul className="space-y-2.5">
              {col.links.map(link => (
                <li key={link.label}>
                  <a href={link.href} className="text-sm hover:text-white transition-colors">{link.label}</a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
        <p className="text-sm">© {new Date().getFullYear()} {brand}. Todos os direitos reservados.</p>
      </div>
    </Container>
  </footer>
);
```

### Tabs

```jsx
const Tabs = ({ items, activeIndex, onChange }) => (
  <div className="flex gap-1 p-1 bg-gray-100 rounded-lg w-fit">
    {items.map((item, i) => (
      <button key={item} onClick={() => onChange(i)}
        className={`px-4 py-2 text-sm font-medium rounded-md transition-all
          ${i === activeIndex
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-500 hover:text-gray-700'}`}>
        {item}
      </button>
    ))}
  </div>
);
```

---

## 4. Content Components

### Card

```html
<div class="kit-card">
  <div class="kit-card__icon">
    <!-- Lucide icon aqui -->
  </div>
  <h3 class="kit-card__title">Título do Card</h3>
  <p class="kit-card__text">Descrição breve do card com texto secundário.</p>
</div>

<style>
.kit-card {
  background: var(--color-bg-surface);
  border: var(--card-border);
  border-radius: var(--card-radius);
  padding: var(--card-padding);
  box-shadow: var(--card-shadow);
  transition: var(--transition);
}
.kit-card:hover {
  box-shadow: var(--card-shadow-hover);
  transform: translateY(-2px);
}
.kit-card__icon {
  width: 2.5rem;
  height: 2.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-primary-light);
  color: var(--color-primary);
  border-radius: var(--radius-lg);
  margin-bottom: var(--space-4);
}
.kit-card__title {
  font-family: var(--font-display);
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--color-text-primary);
  margin-bottom: var(--space-2);
}
.kit-card__text {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  line-height: var(--leading-relaxed);
}
</style>
```

**React/Tailwind:**
```jsx
const Card = ({ icon: Icon, title, text, className = '' }) => (
  <div className={`bg-white border border-gray-200 rounded-xl p-6 shadow-sm
    hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 ${className}`}>
    {Icon && (
      <div className="w-10 h-10 flex items-center justify-center bg-blue-50 text-blue-600 rounded-lg mb-4">
        <Icon size={20} strokeWidth={1.5} />
      </div>
    )}
    <h3 className="text-lg font-semibold text-gray-900 mb-2" style={{ fontFamily: 'var(--font-display)' }}>{title}</h3>
    <p className="text-sm text-gray-600 leading-relaxed">{text}</p>
  </div>
);
```

### Feature Card (horizontal)

```jsx
const FeatureCard = ({ icon: Icon, title, text, tag }) => (
  <div className="flex gap-4 p-5 rounded-xl hover:bg-gray-50 transition-colors duration-300">
    <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-blue-50 text-blue-600 rounded-lg">
      <Icon size={20} strokeWidth={1.5} />
    </div>
    <div>
      <div className="flex items-center gap-2 mb-1">
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        {tag && <Badge>{tag}</Badge>}
      </div>
      <p className="text-sm text-gray-600 leading-relaxed">{text}</p>
    </div>
  </div>
);
```

### Testimonial Card

```jsx
const TestimonialCard = ({ quote, name, role, avatar }) => (
  <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
    <div className="flex gap-1 mb-4">
      {[...Array(5)].map((_, i) => (
        <svg key={i} className="w-4 h-4 text-yellow-400 fill-current" viewBox="0 0 20 20">
          <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z"/>
        </svg>
      ))}
    </div>
    <p className="text-gray-700 leading-relaxed mb-4 text-sm">"{quote}"</p>
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden">
        {avatar && <img src={avatar} alt={name} className="w-full h-full object-cover" />}
      </div>
      <div>
        <p className="text-sm font-semibold text-gray-900">{name}</p>
        <p className="text-xs text-gray-500">{role}</p>
      </div>
    </div>
  </div>
);
```

### Pricing Card

```jsx
const PricingCard = ({ name, price, period, features, cta, highlighted = false }) => (
  <div className={`rounded-2xl p-8 transition-all duration-300
    ${highlighted
      ? 'bg-gray-900 text-white shadow-2xl scale-105 border-2 border-gray-800'
      : 'bg-white border border-gray-200 shadow-sm hover:shadow-lg'}`}>
    <h3 className={`text-lg font-semibold mb-2 ${highlighted ? 'text-white' : 'text-gray-900'}`}
        style={{ fontFamily: 'var(--font-display)' }}>{name}</h3>
    <div className="mb-6">
      <span className={`text-4xl font-bold ${highlighted ? 'text-white' : 'text-gray-900'}`}>{price}</span>
      <span className={`text-sm ml-1 ${highlighted ? 'text-gray-400' : 'text-gray-500'}`}>/{period}</span>
    </div>
    <ul className="space-y-3 mb-8">
      {features.map(f => (
        <li key={f} className={`flex items-center gap-2.5 text-sm ${highlighted ? 'text-gray-300' : 'text-gray-600'}`}>
          <svg className={`w-4 h-4 flex-shrink-0 ${highlighted ? 'text-green-400' : 'text-green-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
          </svg>
          {f}
        </li>
      ))}
    </ul>
    {cta}
  </div>
);
```

### Stat

```jsx
const Stat = ({ value, label, prefix = '', suffix = '' }) => (
  <div className="text-center">
    <p className="text-4xl font-bold text-gray-900 tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
      {prefix}{value}{suffix}
    </p>
    <p className="text-sm text-gray-500 mt-1">{label}</p>
  </div>
);
```

---

## 5. Form Components

### Input

```jsx
const Input = ({ label, placeholder, type = 'text', helper, error, icon: Icon, ...props }) => (
  <div>
    {label && <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>}
    <div className="relative">
      {Icon && (
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
          <Icon size={18} strokeWidth={1.5} />
        </div>
      )}
      <input
        type={type}
        placeholder={placeholder}
        className={`w-full h-11 px-4 ${Icon ? 'pl-10' : ''} rounded-lg border text-sm transition-all duration-200
          ${error
            ? 'border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-100'
            : 'border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100'}
          outline-none placeholder:text-gray-400`}
        {...props}
      />
    </div>
    {helper && !error && <p className="text-xs text-gray-500 mt-1.5">{helper}</p>}
    {error && <p className="text-xs text-red-500 mt-1.5">{error}</p>}
  </div>
);
```

### Select

```jsx
const Select = ({ label, options, placeholder, ...props }) => (
  <div>
    {label && <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>}
    <select
      className="w-full h-11 px-4 rounded-lg border border-gray-200 text-sm bg-white
        focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all
        text-gray-900 appearance-none cursor-pointer"
      {...props}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
    </select>
  </div>
);
```

### Toggle

```jsx
const Toggle = ({ checked, onChange, label }) => (
  <label className="flex items-center gap-3 cursor-pointer">
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200
        ${checked ? 'bg-blue-600' : 'bg-gray-200'}`}>
      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200
        ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
    {label && <span className="text-sm text-gray-700">{label}</span>}
  </label>
);
```

---

## 6. Action Components

### Button

O componente mais importante. SEMPRE usar este, nunca criar botões hardcoded.

```html
<!-- Variantes HTML -->
<button class="kit-btn kit-btn--primary kit-btn--md">Primary</button>
<button class="kit-btn kit-btn--secondary kit-btn--md">Secondary</button>
<button class="kit-btn kit-btn--outline kit-btn--md">Outline</button>
<button class="kit-btn kit-btn--ghost kit-btn--md">Ghost</button>

<style>
.kit-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  font-family: var(--font-body);
  font-weight: var(--font-medium);
  border-radius: var(--btn-radius);
  cursor: pointer;
  border: none;
  transition: var(--transition);
  white-space: nowrap;
  text-decoration: none;
}
/* Sizes */
.kit-btn--sm  { height: var(--btn-height-sm); padding: 0 var(--btn-padding-x-sm); font-size: var(--text-xs); }
.kit-btn--md  { height: var(--btn-height-md); padding: 0 var(--btn-padding-x-md); font-size: var(--text-sm); }
.kit-btn--lg  { height: var(--btn-height-lg); padding: 0 var(--btn-padding-x-lg); font-size: var(--text-base); }
/* Primary */
.kit-btn--primary { background: var(--color-primary); color: var(--color-primary-text); }
.kit-btn--primary:hover { background: var(--color-primary-hover); box-shadow: var(--shadow-primary); transform: translateY(-1px); }
/* Secondary */
.kit-btn--secondary { background: var(--color-bg-subtle); color: var(--color-text-primary); }
.kit-btn--secondary:hover { background: var(--color-border); }
/* Outline */
.kit-btn--outline { background: transparent; color: var(--color-text-primary); border: 1px solid var(--color-border); }
.kit-btn--outline:hover { background: var(--color-bg-subtle); border-color: var(--color-border-hover); }
/* Ghost */
.kit-btn--ghost { background: transparent; color: var(--color-text-secondary); }
.kit-btn--ghost:hover { background: var(--color-bg-subtle); color: var(--color-text-primary); }
/* Disabled */
.kit-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none !important; box-shadow: none !important; }
</style>
```

**React/Tailwind:**
```jsx
const Button = ({ children, variant = 'primary', size = 'md', icon: Icon, iconRight, className = '', ...props }) => {
  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-600/25 hover:-translate-y-px',
    secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200',
    outline: 'bg-transparent text-gray-900 border border-gray-200 hover:bg-gray-50 hover:border-gray-300',
    ghost: 'bg-transparent text-gray-600 hover:bg-gray-100 hover:text-gray-900',
  };
  const sizes = {
    sm: 'h-8 px-3 text-xs',
    md: 'h-10 px-5 text-sm',
    lg: 'h-12 px-8 text-base',
  };

  return (
    <button className={`inline-flex items-center justify-center gap-2 font-medium rounded-lg
      transition-all duration-300 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed
      ${variants[variant]} ${sizes[size]} ${className}`} {...props}>
      {Icon && !iconRight && <Icon size={size === 'sm' ? 14 : size === 'lg' ? 20 : 16} strokeWidth={1.5} />}
      {children}
      {Icon && iconRight && <Icon size={size === 'sm' ? 14 : size === 'lg' ? 20 : 16} strokeWidth={1.5} />}
    </button>
  );
};
```

---

## 7. Feedback Components

### Badge

```jsx
const Badge = ({ children, variant = 'default' }) => {
  const variants = {
    default: 'bg-gray-100 text-gray-700',
    primary: 'bg-blue-50 text-blue-700',
    success: 'bg-green-50 text-green-700',
    warning: 'bg-yellow-50 text-yellow-700',
    danger: 'bg-red-50 text-red-700',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variants[variant]}`}>
      {children}
    </span>
  );
};
```

### Alert

```jsx
const Alert = ({ title, text, variant = 'info', icon: Icon }) => {
  const variants = {
    info: 'bg-blue-50 border-blue-200 text-blue-800',
    success: 'bg-green-50 border-green-200 text-green-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    danger: 'bg-red-50 border-red-200 text-red-800',
  };
  return (
    <div className={`flex gap-3 p-4 rounded-xl border ${variants[variant]}`}>
      {Icon && <Icon size={20} strokeWidth={1.5} className="flex-shrink-0 mt-0.5" />}
      <div>
        {title && <p className="font-semibold text-sm mb-0.5">{title}</p>}
        <p className="text-sm opacity-90">{text}</p>
      </div>
    </div>
  );
};
```

### Skeleton Loader

```jsx
const Skeleton = ({ className = '' }) => (
  <div className={`animate-pulse bg-gray-200 rounded-lg ${className}`} />
);

// Uso:
// <Skeleton className="h-4 w-3/4 mb-2" />
// <Skeleton className="h-4 w-1/2" />
// <Skeleton className="h-32 w-full rounded-xl" />
```

### Empty State

```jsx
const EmptyState = ({ icon: Icon, title, text, action }) => (
  <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
    {Icon && (
      <div className="w-12 h-12 flex items-center justify-center bg-gray-100 text-gray-400 rounded-xl mb-4">
        <Icon size={24} strokeWidth={1.5} />
      </div>
    )}
    <h3 className="text-lg font-semibold text-gray-900 mb-1" style={{ fontFamily: 'var(--font-display)' }}>{title}</h3>
    <p className="text-sm text-gray-500 max-w-sm mb-6">{text}</p>
    {action}
  </div>
);
```

---

## 8. Overlay Components

### Modal

```jsx
const Modal = ({ open, onClose, title, children, footer }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[85vh] overflow-hidden animate-in">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900" style={{ fontFamily: 'var(--font-display)' }}>{title}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">✕</button>
        </div>
        <div className="p-6 overflow-y-auto">{children}</div>
        {footer && <div className="flex justify-end gap-3 p-6 border-t border-gray-100">{footer}</div>}
      </div>
    </div>
  );
};
```

---

## 9. Hero Sections

### HeroSimple (texto centralizado + CTA)

```jsx
const HeroSimple = ({ tag, title, subtitle, primaryCTA, secondaryCTA }) => (
  <section className="pt-32 pb-20 lg:pt-40 lg:pb-28">
    <Container>
      <div className="max-w-3xl mx-auto text-center">
        {tag && (
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-sm font-medium mb-6">
            {tag}
          </div>
        )}
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 tracking-tight leading-tight mb-6"
            style={{ fontFamily: 'var(--font-display)' }}>
          {title}
        </h1>
        <p className="text-lg md:text-xl text-gray-600 leading-relaxed mb-10 max-w-2xl mx-auto">
          {subtitle}
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          {primaryCTA}
          {secondaryCTA}
        </div>
      </div>
    </Container>
  </section>
);
```

### HeroSplit (texto + imagem lado a lado)

```jsx
const HeroSplit = ({ tag, title, subtitle, cta, image, imageAlt }) => (
  <section className="pt-28 pb-16 lg:pt-36 lg:pb-24">
    <Container>
      <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
        <div>
          {tag && (
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-sm font-medium mb-6">
              {tag}
            </span>
          )}
          <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 tracking-tight leading-tight mb-6"
              style={{ fontFamily: 'var(--font-display)' }}>
            {title}
          </h1>
          <p className="text-lg text-gray-600 leading-relaxed mb-8">{subtitle}</p>
          <div className="flex flex-wrap gap-4">{cta}</div>
        </div>
        <div className="relative">
          <div className="rounded-2xl overflow-hidden shadow-2xl">
            <img src={image} alt={imageAlt} className="w-full" />
          </div>
          {/* Decoração sutil */}
          <div className="absolute -z-10 -top-4 -right-4 w-full h-full rounded-2xl bg-blue-100/50" />
        </div>
      </div>
    </Container>
  </section>
);
```

### HeroGradient (fundo com gradiente sutil)

```jsx
const HeroGradient = ({ title, subtitle, cta }) => (
  <section className="relative pt-32 pb-24 overflow-hidden">
    {/* Background gradient */}
    <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-green-50/30" />
    <div className="absolute top-20 right-20 w-96 h-96 bg-blue-200/20 rounded-full blur-3xl" />
    <div className="absolute bottom-10 left-10 w-72 h-72 bg-green-200/20 rounded-full blur-3xl" />

    <Container className="relative">
      <div className="max-w-3xl mx-auto text-center">
        <h1 className="text-5xl lg:text-6xl font-bold text-gray-900 tracking-tight leading-tight mb-6"
            style={{ fontFamily: 'var(--font-display)' }}>
          {title}
        </h1>
        <p className="text-xl text-gray-600 leading-relaxed mb-10 max-w-2xl mx-auto">{subtitle}</p>
        <div className="flex justify-center gap-4">{cta}</div>
      </div>
    </Container>
  </section>
);
```
