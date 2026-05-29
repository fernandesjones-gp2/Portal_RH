# Design Tokens — Sistema de Variáveis Visuais

## Índice
1. Core Tokens (Primitivos)
2. Semantic Tokens (Contextuais)
3. Component Tokens (Específicos)
4. Tailwind Mapping
5. Dark Mode
6. Template CSS Completo

---

## Filosofia

Design Tokens são a **única fonte de verdade** para valores visuais. Nenhum valor
hardcoded é permitido. Quando alguém diz "muda a cor primária", basta alterar UM token
e todo o sistema atualiza.

Hierarquia: `Primitivos → Semânticos → Componentes`

---

## 1. Core Tokens (Primitivos)

Valores puros sem contexto. São a paleta bruta.

### Cores

```css
:root {
  /* === PRIMITIVOS DE COR === */

  /* Neutros — Escala cinza (base para texto, borders, backgrounds) */
  --gray-50:  #F9FAFB;
  --gray-100: #F3F4F6;
  --gray-200: #E5E7EB;
  --gray-300: #D1D5DB;
  --gray-400: #9CA3AF;
  --gray-500: #6B7280;
  --gray-600: #4B5563;
  --gray-700: #374151;
  --gray-800: #1F2937;
  --gray-900: #111827;
  --gray-950: #030712;

  /* Branco e preto puros */
  --white:    #FFFFFF;
  --black:    #000000;

  /* Azul (Primário default) */
  --blue-50:  #EFF6FF;
  --blue-100: #DBEAFE;
  --blue-200: #BFDBFE;
  --blue-300: #93C5FD;
  --blue-400: #60A5FA;
  --blue-500: #3B82F6;
  --blue-600: #2563EB;
  --blue-700: #1D4ED8;
  --blue-800: #1E40AF;
  --blue-900: #1E3A8A;

  /* Verde (Sucesso / Secundário default) */
  --green-50:  #F0FDF4;
  --green-100: #DCFCE7;
  --green-200: #BBF7D0;
  --green-500: #22C55E;
  --green-600: #16A34A;
  --green-700: #15803D;

  /* Vermelho (Erro / Perigo) */
  --red-50:  #FEF2F2;
  --red-100: #FEE2E2;
  --red-500: #EF4444;
  --red-600: #DC2626;
  --red-700: #B91C1C;

  /* Amarelo (Aviso) */
  --yellow-50:  #FEFCE8;
  --yellow-100: #FEF9C3;
  --yellow-500: #EAB308;
  --yellow-600: #CA8A04;

  /* Violet (Accent alternativo) */
  --violet-50:  #F5F3FF;
  --violet-500: #8B5CF6;
  --violet-600: #7C3AED;
}
```

### Tipografia

```css
:root {
  /* === PRIMITIVOS TIPOGRÁFICOS === */

  /* Font Families */
  --font-display: 'DM Sans', system-ui, sans-serif;
  --font-body:    'Inter', system-ui, sans-serif;
  --font-mono:    'JetBrains Mono', 'Fira Code', monospace;

  /* Font Sizes — Escala modular (ratio 1.25) */
  --text-xs:    0.75rem;    /* 12px */
  --text-sm:    0.875rem;   /* 14px */
  --text-base:  1rem;       /* 16px */
  --text-lg:    1.125rem;   /* 18px */
  --text-xl:    1.25rem;    /* 20px */
  --text-2xl:   1.5rem;     /* 24px */
  --text-3xl:   1.875rem;   /* 30px */
  --text-4xl:   2.25rem;    /* 36px */
  --text-5xl:   3rem;       /* 48px */
  --text-6xl:   3.75rem;    /* 60px */
  --text-7xl:   4.5rem;     /* 72px */

  /* Font Weights */
  --font-regular:  400;
  --font-medium:   500;
  --font-semibold: 600;
  --font-bold:     700;

  /* Line Heights */
  --leading-none:    1;
  --leading-tight:   1.25;
  --leading-snug:    1.375;
  --leading-normal:  1.5;
  --leading-relaxed: 1.625;
  --leading-loose:   2;

  /* Letter Spacing */
  --tracking-tighter: -0.05em;
  --tracking-tight:   -0.025em;
  --tracking-normal:  0em;
  --tracking-wide:    0.025em;
  --tracking-wider:   0.05em;
  --tracking-widest:  0.1em;
}
```

### Espaçamento

```css
:root {
  /* === PRIMITIVOS DE ESPAÇAMENTO === */
  /* Escala de 4px (0.25rem) */
  --space-0:    0;
  --space-0.5:  0.125rem;  /* 2px  */
  --space-1:    0.25rem;   /* 4px  */
  --space-1.5:  0.375rem;  /* 6px  */
  --space-2:    0.5rem;    /* 8px  */
  --space-2.5:  0.625rem;  /* 10px */
  --space-3:    0.75rem;   /* 12px */
  --space-4:    1rem;      /* 16px */
  --space-5:    1.25rem;   /* 20px */
  --space-6:    1.5rem;    /* 24px */
  --space-8:    2rem;      /* 32px */
  --space-10:   2.5rem;    /* 40px */
  --space-12:   3rem;      /* 48px */
  --space-16:   4rem;      /* 64px */
  --space-20:   5rem;      /* 80px */
  --space-24:   6rem;      /* 96px */
  --space-32:   8rem;      /* 128px */
}
```

### Bordas e Sombras

```css
:root {
  /* === BORDER RADIUS === */
  --radius-none: 0;
  --radius-sm:   0.25rem;   /* 4px — tags, badges */
  --radius-md:   0.375rem;  /* 6px — inputs pequenos */
  --radius-lg:   0.5rem;    /* 8px — botões, inputs */
  --radius-xl:   0.75rem;   /* 12px — cards */
  --radius-2xl:  1rem;      /* 16px — modais, containers */
  --radius-3xl:  1.5rem;    /* 24px — hero cards */
  --radius-full: 9999px;    /* Pill shape */

  /* === SOMBRAS === */
  /* Sombras sutis — a marca registrada do clean design */
  --shadow-xs:  0 1px 2px 0 rgba(0, 0, 0, 0.03);
  --shadow-sm:  0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05);
  --shadow-md:  0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05);
  --shadow-lg:  0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -4px rgba(0, 0, 0, 0.05);
  --shadow-xl:  0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
  --shadow-2xl: 0 25px 50px -12px rgba(0, 0, 0, 0.1);

  /* Sombras coloridas (para botões CTA hover) */
  --shadow-primary: 0 4px 14px 0 rgba(37, 99, 235, 0.25);
  --shadow-success: 0 4px 14px 0 rgba(16, 185, 129, 0.25);

  /* === BORDER === */
  --border-width: 1px;
  --border-color: var(--gray-200);
}
```

### Transições

```css
:root {
  /* === TRANSIÇÕES === */
  --duration-fast:   150ms;
  --duration-normal: 300ms;
  --duration-slow:   500ms;
  --duration-slower: 700ms;

  --ease-default:  cubic-bezier(0.4, 0, 0.2, 1);
  --ease-in:       cubic-bezier(0.4, 0, 1, 1);
  --ease-out:      cubic-bezier(0, 0, 0.2, 1);
  --ease-in-out:   cubic-bezier(0.4, 0, 0.2, 1);
  --ease-bounce:   cubic-bezier(0.34, 1.56, 0.64, 1);
  --ease-spring:   cubic-bezier(0.175, 0.885, 0.32, 1.275);

  /* Transição padrão — usar em tudo */
  --transition-colors:   color var(--duration-normal) var(--ease-default),
                         background-color var(--duration-normal) var(--ease-default),
                         border-color var(--duration-normal) var(--ease-default);
  --transition-shadow:   box-shadow var(--duration-normal) var(--ease-default);
  --transition-transform: transform var(--duration-normal) var(--ease-default);
  --transition-all:      all var(--duration-normal) var(--ease-default);
}
```

---

## 2. Semantic Tokens (Contextuais)

Tokens com significado. Referenciam os primitivos.

```css
:root {
  /* === CORES SEMÂNTICAS === */

  /* Primária (CTA, links, destaques) */
  --color-primary:       var(--blue-600);
  --color-primary-hover: var(--blue-700);
  --color-primary-light: var(--blue-50);
  --color-primary-text:  var(--white);

  /* Secundária */
  --color-secondary:       var(--green-600);
  --color-secondary-hover: var(--green-700);
  --color-secondary-light: var(--green-50);

  /* Backgrounds */
  --color-bg-page:      var(--gray-50);     /* Background da página */
  --color-bg-surface:   var(--white);        /* Cards, modais, etc */
  --color-bg-elevated:  var(--white);        /* Navbar, floating elements */
  --color-bg-subtle:    var(--gray-100);     /* Seções alternadas */
  --color-bg-muted:     var(--gray-200);     /* Disabled backgrounds */

  /* Texto */
  --color-text-primary:   var(--gray-900);   /* Títulos, texto principal */
  --color-text-secondary: var(--gray-600);   /* Subtítulos, labels */
  --color-text-tertiary:  var(--gray-400);   /* Placeholders, hints */
  --color-text-inverse:   var(--white);      /* Texto sobre fundo escuro */
  --color-text-link:      var(--color-primary);

  /* Borders */
  --color-border:         var(--gray-200);
  --color-border-hover:   var(--gray-300);
  --color-border-focus:   var(--color-primary);

  /* Status */
  --color-success:     var(--green-600);
  --color-success-bg:  var(--green-50);
  --color-warning:     var(--yellow-600);
  --color-warning-bg:  var(--yellow-50);
  --color-error:       var(--red-600);
  --color-error-bg:    var(--red-50);
  --color-info:        var(--blue-600);
  --color-info-bg:     var(--blue-50);

  /* === TIPOGRAFIA SEMÂNTICA === */
  --font-heading: var(--font-display);
  --font-text:    var(--font-body);
  --font-code:    var(--font-mono);

  /* === LAYOUT === */
  --container-max:   1200px;
  --container-sm:    640px;
  --container-md:    768px;
  --container-lg:    1024px;
  --container-xl:    1280px;

  --section-padding-y: var(--space-24);  /* Padding vertical de seções */
  --section-padding-x: var(--space-6);   /* Padding lateral mobile */

  --navbar-height: 4rem;  /* 64px */
  --navbar-blur:   saturate(180%) blur(20px);
}
```

---

## 3. Component Tokens (Específicos)

Tokens usados por componentes individuais do UI Kit.

```css
:root {
  /* === BOTÃO === */
  --btn-height-sm:    2rem;
  --btn-height-md:    2.5rem;
  --btn-height-lg:    3rem;
  --btn-padding-x-sm: var(--space-3);
  --btn-padding-x-md: var(--space-5);
  --btn-padding-x-lg: var(--space-8);
  --btn-radius:       var(--radius-lg);
  --btn-font-size:    var(--text-sm);
  --btn-font-weight:  var(--font-medium);

  /* === INPUT === */
  --input-height:     2.75rem;
  --input-padding-x:  var(--space-4);
  --input-radius:     var(--radius-lg);
  --input-border:     var(--color-border);
  --input-focus-ring: 0 0 0 3px rgba(37, 99, 235, 0.15);

  /* === CARD === */
  --card-radius:      var(--radius-xl);
  --card-padding:     var(--space-6);
  --card-shadow:      var(--shadow-sm);
  --card-shadow-hover: var(--shadow-lg);
  --card-border:      1px solid var(--color-border);

  /* === NAVBAR === */
  --navbar-bg:        rgba(255, 255, 255, 0.8);
  --navbar-border:    1px solid var(--color-border);
  --navbar-shadow:    var(--shadow-xs);

  /* === MODAL === */
  --modal-radius:     var(--radius-2xl);
  --modal-padding:    var(--space-8);
  --modal-shadow:     var(--shadow-2xl);
  --modal-overlay:    rgba(0, 0, 0, 0.4);
  --modal-max-width:  32rem;

  /* === BADGE === */
  --badge-radius:     var(--radius-full);
  --badge-padding-x:  var(--space-2.5);
  --badge-padding-y:  var(--space-0.5);
  --badge-font-size:  var(--text-xs);
  --badge-font-weight: var(--font-medium);

  /* === AVATAR === */
  --avatar-size-sm:   2rem;
  --avatar-size-md:   2.5rem;
  --avatar-size-lg:   3rem;
  --avatar-size-xl:   4rem;
}
```

---

## 4. Tailwind Mapping

Quando usando React com Tailwind, estes são os mapeamentos:

| Token | Tailwind Class |
|-------|---------------|
| `--color-primary` | `text-blue-600`, `bg-blue-600` |
| `--color-bg-page` | `bg-gray-50` |
| `--color-bg-surface` | `bg-white` |
| `--color-text-primary` | `text-gray-900` |
| `--color-text-secondary` | `text-gray-600` |
| `--color-border` | `border-gray-200` |
| `--shadow-sm` | `shadow-sm` |
| `--shadow-lg` | `shadow-lg` |
| `--radius-lg` | `rounded-lg` |
| `--radius-xl` | `rounded-xl` |
| `--space-4` | `p-4`, `m-4`, `gap-4` |
| `--space-6` | `p-6`, `m-6`, `gap-6` |

Para customizar tokens no Tailwind via CSS variables:

```jsx
{/* No JSX, usar CSS variables inline quando o Tailwind não cobre */}
<div style={{ fontFamily: 'var(--font-display)' }} className="...">
```

---

## 5. Dark Mode

Quando solicitado, sobrescrever tokens semânticos:

```css
@media (prefers-color-scheme: dark) {
  :root {
    --color-bg-page:      #0F172A;
    --color-bg-surface:   #1E293B;
    --color-bg-elevated:  #334155;
    --color-bg-subtle:    #1E293B;

    --color-text-primary:   #F1F5F9;
    --color-text-secondary: #94A3B8;
    --color-text-tertiary:  #64748B;

    --color-border:       #334155;
    --color-border-hover: #475569;

    --navbar-bg: rgba(15, 23, 42, 0.8);

    /* Sombras mais intensas no dark */
    --shadow-sm: 0 1px 3px 0 rgba(0, 0, 0, 0.2);
    --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.3);
    --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
  }
}
```

---

## 6. Template CSS Completo (Copy-Paste Ready)

```css
/* ===================================================
   DESIGN TOKENS — [NOME DO PROJETO]
   Gerado pela skill clean-webdesigner
   =================================================== */

@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap');

:root {
  /* Cores Primárias */
  --color-primary: #2563EB;
  --color-primary-hover: #1D4ED8;
  --color-primary-light: #EFF6FF;
  --color-primary-text: #FFFFFF;
  --color-secondary: #10B981;
  --color-secondary-hover: #059669;
  --color-secondary-light: #F0FDF4;

  /* Backgrounds */
  --color-bg-page: #FAFAFA;
  --color-bg-surface: #FFFFFF;
  --color-bg-subtle: #F3F4F6;

  /* Texto */
  --color-text-primary: #111827;
  --color-text-secondary: #6B7280;
  --color-text-tertiary: #9CA3AF;

  /* Borders & Shadows */
  --color-border: #E5E7EB;
  --shadow-sm: 0 1px 3px 0 rgba(0,0,0,0.05), 0 1px 2px -1px rgba(0,0,0,0.05);
  --shadow-md: 0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -2px rgba(0,0,0,0.05);
  --shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.05), 0 4px 6px -4px rgba(0,0,0,0.05);

  /* Tipografia */
  --font-display: 'DM Sans', system-ui, sans-serif;
  --font-body: 'Inter', system-ui, sans-serif;

  /* Espaçamento & Sizing */
  --radius-lg: 0.5rem;
  --radius-xl: 0.75rem;
  --radius-2xl: 1rem;
  --container-max: 1200px;
  --navbar-height: 4rem;

  /* Transições */
  --transition: all 300ms cubic-bezier(0.4, 0, 0.2, 1);
}

/* === RESET & BASE === */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; -webkit-font-smoothing: antialiased; }
body {
  font-family: var(--font-body);
  color: var(--color-text-primary);
  background: var(--color-bg-page);
  line-height: 1.6;
}
h1, h2, h3, h4, h5, h6 { font-family: var(--font-display); line-height: 1.2; }
a { color: var(--color-primary); text-decoration: none; }
img { max-width: 100%; height: auto; display: block; }
```
