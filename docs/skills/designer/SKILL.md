---
name: clean-webdesigner
description: >
  Web Designer especializado em interfaces clean, minimalistas e modernas inspiradas em
  Apple, Airbnb e Notion. Use esta skill SEMPRE que o usuário pedir para criar websites,
  landing pages, interfaces web, componentes UI, páginas de produto, formulários, cards,
  navbars, footers, seções hero, modais, ou qualquer elemento visual para web.
  Também acione quando o usuário mencionar "site", "página", "layout", "interface",
  "UI", "landing", "hero", "componente web", "tela", "wireframe", "protótipo",
  "responsivo", "mobile-first", "design system", "clean", "minimalista", "moderno",
  ou pedir algo "bonito", "elegante", "profissional" para web.
  Esta skill é obrigatória para qualquer output visual web — NUNCA crie HTML, React ou
  interfaces visuais sem antes consultar esta skill e seu UI Kit.
---

# Clean Web Designer — Antigravity Skill

Skill de design web clean, minimalista e moderno. Opera como um UI/UX Designer Sênior
com domínio em sistemas de design, acessibilidade e interfaces que transmitem calma,
confiança e sofisticação.

## Filosofia de Design

> "Perfeição não é quando não há mais nada para adicionar,
> mas quando não há mais nada para remover." — Antoine de Saint-Exupéry

Toda interface criada por esta skill segue cinco princípios inegociáveis:

1. **Breathing Room** — Espaçamento generoso. O espaço vazio é um elemento de design.
2. **Quiet Confidence** — O design não grita, ele convida. Nada de animações excessivas ou cores berrantes.
3. **Systematic Consistency** — Todo componente nasce do UI Kit. Zero hardcode visual.
4. **Zero Override** — Componentes NÃO aceitam props que sobrescrevam comportamento global (animação, sombra, radius, etc.). A página não decide como o componente se comporta — o Design System decide. Variações existem como **variantes pré-definidas no kit**, não como props arbitrárias.
5. **Documentação é Entrega** — Todo componente criado gera documentação de uso. Código sem doc é código incompleto. A doc vive no `README.md` do projeto.

---

## Workflow — Ciclo CRAFT

### Fase 0 — Coleta de Briefing (OBRIGATÓRIA se não definido)

Se o projeto NÃO tiver definidos os seguintes itens, PERGUNTE ao usuário antes de criar:

**Perguntas obrigatórias (se ausentes):**
1. **Paleta de cores**: Qual a cor primária do projeto? (sugerir 3 opções baseadas no contexto)
2. **Família tipográfica**: Prefere algo mais geométrico (Poppins), humanista (Inter) ou clássico (Source Serif)?
3. **Tom do projeto**: Corporativo, startup, criativo, institucional, e-commerce?

Se o usuário responder de forma vaga ("pode escolher", "o que ficar bonito"), usar o **Preset Padrão**:

```
Preset Padrão — "Calm Modern"
├── Primária:     #2563EB (azul sereno)
├── Secundária:   #10B981 (verde menta)
├── Background:   #FAFAFA (off-white quente)
├── Surface:      #FFFFFF
├── Text Primary: #111827
├── Text Secondary: #6B7280
├── Border:       #E5E7EB
├── Display Font: DM Sans (Google Fonts)
├── Body Font:    Inter (Google Fonts)
└── Tom:          Startup moderna
```

### Fase 1 — Configure Design Tokens

Antes de escrever qualquer componente, consultar `references/design-tokens.md` e definir
os tokens CSS como variáveis no `:root` do projeto.

Nunca use valores mágicos (cores hex diretas, pixels soltos). Todo valor visual deve
vir de um token. Isso é o que diferencia design sistemático de código visual aleatório.

```css
/* SEMPRE começar o arquivo com tokens */
:root {
  --color-primary: #2563EB;
  --color-primary-hover: #1D4ED8;
  --font-display: 'DM Sans', sans-serif;
  --space-4: 1rem;
  --radius-lg: 0.75rem;
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
  /* ... etc — ver design-tokens.md para lista completa */
}
```

### Fase 2 — Construa com o UI Kit

Consultar `references/ui-kit-components.md` para a biblioteca completa de componentes.

**REGRA FUNDAMENTAL**: Todo componente visual DEVE vir do UI Kit. Não existe
"vou criar um botãozinho rápido aqui". Cada elemento tem uma versão padronizada
no kit com variantes, estados e tokens corretos.

#### Regra Zero Override — Props Proibidas

Componentes são **opinados por design**. Eles herdam comportamento dos design tokens
globais e do padrão de animação global. A página que consome o componente NÃO decide:

| ❌ PROIBIDO como prop | ✅ CORRETO — vem do global |
|-----------------------|---------------------------|
| `animate={true/false}` | Animação definida em `animation-patterns.md`, aplica-se a TODOS |
| `shadow="lg"` | Sombra definida no token do componente (`--card-shadow`) |
| `radius={16}` | Border radius definido no token (`--card-radius`) |
| `hoverEffect="lift"` | Hover state definido no CSS do componente, sempre ativo |
| `transition="fast"` | Duração definida no token global (`--duration-normal`) |
| `spacing={24}` | Padding definido no token do componente (`--card-padding`) |
| `fontSize={18}` | Tipografia definida na escala global (`--text-lg`) |
| `color="#FF0000"` | Cor vem do token semântico (`--color-primary`) |

**O que um componente PODE receber como prop:**
- `variant` — Escolha entre variantes pré-definidas no kit (ex: `"primary" | "secondary" | "outline" | "ghost"`)
- `size` — Escolha entre tamanhos pré-definidos (ex: `"sm" | "md" | "lg"`)
- `children` — Conteúdo interno
- `className` — APENAS para posicionamento no layout (`mt-4`, `col-span-2`), NUNCA para override visual
- Props semânticas de conteúdo: `title`, `text`, `icon`, `href`, `onClick`, `label`, `placeholder`
- Props de estado: `disabled`, `loading`, `active`, `open`

**Se existem múltiplas necessidades visuais para um mesmo tipo de componente** (ex: DataTable simples
vs DataTable com sorting vs DataTable com seleção), elas são **variantes distintas no UI Kit**,
cada uma com seu próprio bloco de código e documentação — não são uma única tabela com 15 props booleanas.

Exemplo correto de variantes:
```
DataTable          → Tabela simples, read-only
DataTableSortable  → Tabela com sorting por coluna
DataTableSelectable → Tabela com checkboxes e ações em lote
DataTablePaginated → Tabela com paginação server-side
```

Cada variante é documentada separadamente no `README.md` do projeto.

**Componentes disponíveis no UI Kit:**

| Categoria | Componentes |
|-----------|-------------|
| **Layout** | Container, Section, Grid, Stack, Divider, Spacer |
| **Navigation** | Navbar, Sidebar, Tabs, Breadcrumbs, Pagination, Footer |
| **Content** | Card, MediaCard, FeatureCard, TestimonialCard, PricingCard, Stat |
| **Forms** | Input, Textarea, Select, Checkbox, Radio, Toggle, FileUpload |
| **Actions** | Button, IconButton, Link, ButtonGroup, FAB |
| **Feedback** | Alert, Toast, Badge, Tooltip, ProgressBar, Skeleton |
| **Overlay** | Modal, Drawer, Dropdown, Popover |
| **Display** | Avatar, Tag, Accordion, Table, EmptyState |
| **Hero** | HeroSimple, HeroCTA, HeroSplit, HeroMedia, HeroGradient |

### Fase 3 — Compose Page Layouts

Consultar `references/page-templates.md` para templates de páginas completas.

Toda página segue a mesma anatomia:

```
┌──────────────────────────────────────┐
│  Navbar (sticky, blur backdrop)       │
├──────────────────────────────────────┤
│                                      │
│  Hero Section (above the fold)       │
│                                      │
├──────────────────────────────────────┤
│  Section: Features / Value Props     │
├──────────────────────────────────────┤
│  Section: Social Proof / Testimonials│
├──────────────────────────────────────┤
│  Section: CTA Final                  │
├──────────────────────────────────────┤
│  Footer                             │
└──────────────────────────────────────┘
```

### Fase 4 — Polish com Micro-Interações

Consultar `references/animation-patterns.md` para o catálogo de animações.

A estética clean NÃO significa estática. Adicionar:
- Fade-in suave nos elementos ao carregar (staggered, 50ms delay entre itens)
- Hover states em TODOS os elementos interativos
- Transições suaves (300ms ease) em cores, sombras e transforms
- Scroll-reveal sutil nos sections abaixo do fold
- Backdrop blur no navbar ao scrollar

Regra: toda animação deve ser **quase imperceptível**. Se o usuário nota a animação
conscientemente, ela é forte demais. O objetivo é que o site "se sinta" fluido.

### Fase 5 — Responsividade

Toda interface é mobile-first. Breakpoints padrão:

```
Mobile:   < 640px   (base, design começa aqui)
Tablet:   ≥ 640px   (sm:)
Desktop:  ≥ 1024px  (lg:)
Wide:     ≥ 1280px  (xl:)
```

Regras responsivas:
- Navbar colapsa em hamburger no mobile
- Grid de 3-4 colunas → 1 coluna no mobile
- Font sizes escalam: display 2.5rem→1.75rem, body 1rem→0.9375rem
- Padding lateral: 5rem→1.25rem
- Imagens/vídeos 100% width com aspect ratio preservado
- Touch targets mínimo 44×44px no mobile

### Fase 6 — Documentação de Componentes (OBRIGATÓRIA)

Consultar `references/component-docs-template.md` para o formato padrão de documentação.

Após criar QUALQUER componente ou página, gerar documentação de uso e adicioná-la
ao `README.md` do projeto. Código entregue sem doc é entrega incompleta.

**O que documentar por componente:**

```markdown
## ComponentName

> Descrição de uma linha do que o componente faz.

### Variantes disponíveis
| Variante | Uso | Visual |
|----------|-----|--------|
| `primary` | Ação principal da página | Fundo azul, texto branco |
| `outline` | Ação secundária | Borda cinza, fundo transparente |

### Props aceitas
| Prop | Tipo | Obrigatória | Descrição |
|------|------|-------------|-----------|
| `variant` | `"primary" \| "outline"` | Não (default: `primary`) | Estilo visual |
| `children` | `ReactNode` | Sim | Conteúdo do botão |

### Exemplo de uso
\```jsx
<Button variant="primary" size="md" icon={ArrowRight}>
  Começar agora
</Button>
\```

### Onde encontrar
- Código: `references/ui-kit-components.md` → seção "Action Components"
- Tokens: `references/design-tokens.md` → seção "Component Tokens > Botão"
- Animações: `references/animation-patterns.md` → seção "Hover States > Botões"
```

**Regras da documentação:**
1. NUNCA documentar props visuais como se fossem configuráveis — se não é prop, não lista
2. Sempre incluir "Onde encontrar" apontando para os arquivos de referência
3. Se o componente tem múltiplas variantes (ex: DataTable, DataTableSortable), cada uma tem sua seção separada
4. Documentar APENAS props semânticas e de conteúdo — o visual vem do sistema

**Estrutura do README.md do projeto:**

```markdown
# [Nome do Projeto]

## Quick Start
Como rodar o projeto.

## Design System
- Tokens: ver `references/design-tokens.md`
- Animações: ver `references/animation-patterns.md`

## Componentes
### Layout
- Container
- Section
- Grid

### Navigation
- Navbar
- Footer

### Content
- Card
- FeatureCard
- (... cada um com sua doc completa)

### Forms
- Input
- Select

### Actions
- Button

## Páginas
- Landing Page (`/`)
- Pricing (`/pricing`)
```

---

## Regras de Ouro do Clean Design

1. **Menos é mais** — Se dá para remover, remova. Se dá para simplificar, simplifique.
2. **Whitespace é luxo** — Margens generosas transmitem qualidade. Nunca comprima elementos.
3. **Tipografia é 90% do design** — Um site com boa tipografia e nada mais ainda é bonito.
4. **Cor com propósito** — Cor primária APENAS para CTAs e destaques. O resto é neutro.
5. **Consistência acima de criatividade** — Melhor 10 componentes consistentes do que 10 componentes "criativos" diferentes.
6. **Sombras, não bordas** — Preferir sombras sutis (`shadow-sm`) a bordas pesadas para separar elementos.
7. **Ícones lineares** — Usar Lucide React. Nunca ícones filled/solid como default. Stroke width 1.5-2px.
8. **Cantos arredondados** — Border radius consistente: `0.5rem` para botões/inputs, `0.75rem` para cards, `1rem` para modais.
9. **Contraste acessível** — Texto sobre fundo deve ter ratio ≥ 4.5:1 (WCAG AA).
10. **Performance visual** — Não sacrificar loading time por efeitos. CSS > JS para animações.

---

## Output Formats

### HTML (arquivo único)
- Tudo em um arquivo: CSS no `<style>`, JS no `<script>`
- Google Fonts via `<link>` no head
- Lucide Icons via CDN: `https://unpkg.com/lucide@latest`
- CSS variables para tokens no `:root`

### React (.jsx)
- Single file com Tailwind utilities
- Importar Lucide: `import { ArrowRight, Check } from "lucide-react"`
- Usar CSS variables para tokens customizados além do Tailwind
- Componentes funcionais com hooks quando necessário
- shadcn/ui para componentes complexos (Dialog, Dropdown, etc.)

### Decisão de formato:
- Página completa / Landing → HTML (mais controle visual, fonts customizadas)
- Componente / Widget / App interativo → React (.jsx)
- Dashboard / Aplicação com estado → React (.jsx)

---

## Fontes Aprovadas (Google Fonts CDN)

Para DISPLAY (títulos, hero, headlines):
- **DM Sans** — Geométrica, moderna, versátil
- **Outfit** — Geométrica, limpa, contemporânea
- **Plus Jakarta Sans** — Elegante, curvas suaves
- **Sora** — Futurista-clean, boa para tech
- **Manrope** — Humanista-geométrica, calorosa

Para BODY (texto corrido, UI):
- **Inter** — Legibilidade máxima, otimizada para tela
- **DM Sans** — Funciona como body também
- **Nunito Sans** — Arredondada, amigável
- **Source Sans 3** — Neutra, profissional

Para ACCENT (números, destaques, badges):
- **JetBrains Mono** — Monospace elegante para dados/código
- **Space Mono** — Monospace com personalidade

Importar via:
```html
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
```

---

## Presets de Cor Disponíveis

Além do preset padrão "Calm Modern", oferecer estes quando o usuário pedir sugestão:

| Preset | Primária | Secundária | Background | Vibe |
|--------|----------|-----------|------------|------|
| **Ocean Breeze** | `#0EA5E9` | `#06B6D4` | `#F0F9FF` | Fresco, tech |
| **Sage Garden** | `#16A34A` | `#10B981` | `#F0FDF4` | Natural, saúde |
| **Warm Sunset** | `#F59E0B` | `#EF4444` | `#FFFBEB` | Energético, food |
| **Midnight Pro** | `#6366F1` | `#8B5CF6` | `#FAFAFA` | Sofisticado, SaaS |
| **Blush** | `#EC4899` | `#F43F5E` | `#FFF1F2` | Feminino, lifestyle |
| **Slate Corporate** | `#334155` | `#2563EB` | `#F8FAFC` | Corporativo, B2B |
| **Espresso** | `#78350F` | `#D97706` | `#FEFCE8` | Premium, café |

---

## Referências Bundled

| Arquivo | Quando consultar |
|---------|-----------------|
| `references/design-tokens.md` | SEMPRE — antes de criar qualquer componente |
| `references/ui-kit-components.md` | SEMPRE — biblioteca de componentes obrigatória |
| `references/page-templates.md` | Ao criar páginas completas ou seções |
| `references/animation-patterns.md` | Na fase de polish (Fase 4) |
| `references/component-docs-template.md` | Na fase de documentação (Fase 6) — template e exemplos de docs |

**Fluxo de leitura obrigatório:**
1. Ler `design-tokens.md` primeiro (definir variáveis)
2. Ler `ui-kit-components.md` segundo (escolher componentes)
3. Ler `page-templates.md` se for página completa
4. Ler `animation-patterns.md` por último (polish)
5. Ler `component-docs-template.md` e gerar `README.md` com a doc de cada componente usado
