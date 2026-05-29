# Component Documentation Template — Padrão de Docs

## Índice
1. Filosofia da Documentação
2. Regras de Props
3. Template por Componente
4. Template de README.md do Projeto
5. Exemplos Completos de Docs

---

## 1. Filosofia da Documentação

> "Se o dev precisa ler o código fonte para saber como usar,
> a documentação falhou."

Toda documentação de componente responde 4 perguntas:
1. **O que é?** — Uma frase descritiva
2. **Quais variantes existem?** — Tabela com opções pré-definidas
3. **O que posso passar?** — Tabela de props (APENAS as permitidas)
4. **Como uso?** — Exemplo de código mínimo + onde encontrar mais detalhes

A doc NÃO explica:
- Como o componente funciona internamente
- Como customizar o visual (não é customizável — é do Design System)
- Como alterar animações, cores, sombras ou espaçamentos (global)

---

## 2. Regras de Props — O que Documentar vs O que Não Documentar

### ✅ Props que DEVEM ser documentadas

São props que o consumidor precisa saber para usar o componente:

| Tipo | Exemplos | Por que documentar |
|------|----------|-------------------|
| **Variante** | `variant="primary"` | Escolha visual pré-definida |
| **Tamanho** | `size="md"` | Escolha dimensional pré-definida |
| **Conteúdo** | `title`, `text`, `label`, `placeholder` | Texto do componente |
| **Dados** | `items`, `data`, `options`, `columns` | Dados que alimentam o componente |
| **Composição** | `children`, `icon`, `cta`, `footer` | Slots de conteúdo |
| **Navegação** | `href`, `to`, `onClick` | Ação ao interagir |
| **Estado** | `disabled`, `loading`, `active`, `open`, `error` | Estado semântico |
| **Identificação** | `id`, `name`, `ariaLabel` | Acessibilidade e forms |

### ❌ Props que NUNCA devem existir (e portanto nunca documentar)

São props que pertencem ao Design System global, não ao componente individual:

| Proibida | Por que é proibida | Onde vive de verdade |
|----------|-------------------|---------------------|
| `animate` | Animação é global | `animation-patterns.md` |
| `shadow` | Sombra é do token do componente | `design-tokens.md` → Component Tokens |
| `radius` | Border radius é do token | `design-tokens.md` → `--card-radius` |
| `hoverEffect` | Hover é definido no CSS do componente | `animation-patterns.md` → Hover States |
| `transition` | Duração é global | `design-tokens.md` → Transições |
| `color` | Cor vem do token semântico | `design-tokens.md` → Cores Semânticas |
| `fontSize` | Tipografia é da escala global | `design-tokens.md` → Tipografia |
| `spacing` / `padding` | Espaçamento é do token | `design-tokens.md` → Component Tokens |
| `borderColor` | Borda é do token | `design-tokens.md` → `--color-border` |
| `fontFamily` | Fonte é global | `design-tokens.md` → `--font-display` |

**Se alguém pedir "quero esse card sem animação"**: a resposta é que todos os cards
animam da mesma forma porque isso é decisão do Design System. Para alterar, muda-se
o `animation-patterns.md` e afeta TODOS os cards. Nunca um card individual.

---

## 3. Template por Componente

Usar este template EXATAMENTE para cada componente no README:

````markdown
---

## NomeDoComponente

> Descrição em uma frase do que o componente faz e quando usar.

### Variantes

| Variante | Quando usar | Aparência |
|----------|-------------|-----------|
| `variante-a` | Caso de uso A | Descrição visual breve |
| `variante-b` | Caso de uso B | Descrição visual breve |

### Tamanhos (se aplicável)

| Size | Uso típico | Altura |
|------|-----------|--------|
| `sm` | Inline, toolbars | 32px |
| `md` | Padrão | 40px |
| `lg` | Hero, CTAs prominentes | 48px |

### Props

| Prop | Tipo | Default | Obrigatória | Descrição |
|------|------|---------|-------------|-----------|
| `variant` | `"a" \| "b"` | `"a"` | Não | Estilo visual |
| `size` | `"sm" \| "md" \| "lg"` | `"md"` | Não | Tamanho |
| `children` | `ReactNode` | — | Sim | Conteúdo |

### Uso

```jsx
<NomeDoComponente variant="a" size="md">
  Conteúdo aqui
</NomeDoComponente>
```

### Referências

| O que | Onde |
|-------|------|
| Código do componente | `ui-kit-components.md` → seção X |
| Design tokens usados | `design-tokens.md` → seção Y |
| Animações aplicadas | `animation-patterns.md` → seção Z |

---
````

### Para componentes com múltiplas variantes separadas

Quando um componente tem variações que são componentes distintos (não apenas uma prop),
documentar CADA UM como componente independente:

````markdown
---

## DataTable

> Tabela de dados simples e read-only para exibir informações tabulares.

### Props

| Prop | Tipo | Obrigatória | Descrição |
|------|------|-------------|-----------|
| `columns` | `Column[]` | Sim | Definição das colunas |
| `data` | `Row[]` | Sim | Dados a exibir |

### Uso

```jsx
<DataTable
  columns={[
    { key: 'name', label: 'Nome' },
    { key: 'email', label: 'Email' },
  ]}
  data={users}
/>
```

### Referências

| O que | Onde |
|-------|------|
| Código | `ui-kit-components.md` → Display Components |
| Tokens | `design-tokens.md` → Component Tokens |

---

## DataTableSortable

> Tabela de dados com ordenação por coluna. Estende DataTable com sorting embutido.

### Props

| Prop | Tipo | Obrigatória | Descrição |
|------|------|-------------|-----------|
| `columns` | `SortableColumn[]` | Sim | Colunas com flag `sortable` |
| `data` | `Row[]` | Sim | Dados a exibir |
| `defaultSort` | `{ key: string, dir: 'asc' \| 'desc' }` | Não | Ordenação inicial |

### Uso

```jsx
<DataTableSortable
  columns={[
    { key: 'name', label: 'Nome', sortable: true },
    { key: 'email', label: 'Email', sortable: true },
    { key: 'role', label: 'Cargo', sortable: false },
  ]}
  data={users}
  defaultSort={{ key: 'name', dir: 'asc' }}
/>
```

---

## DataTableSelectable

> Tabela com checkboxes para seleção em lote e barra de ações.

### Props

| Prop | Tipo | Obrigatória | Descrição |
|------|------|-------------|-----------|
| `columns` | `Column[]` | Sim | Definição das colunas |
| `data` | `Row[]` | Sim | Dados a exibir |
| `onSelectionChange` | `(ids: string[]) => void` | Sim | Callback de seleção |
| `actions` | `Action[]` | Não | Ações em lote (deletar, exportar...) |

---
````

---

## 4. Template de README.md do Projeto

Este é o esqueleto do README que acompanha todo projeto criado por esta skill.
Gerar automaticamente e preencher com os componentes usados.

````markdown
# [Nome do Projeto]

> Descrição breve do projeto.

## Quick Start

```bash
# Como rodar (se aplicável)
npm install
npm run dev
```

## Design System

Este projeto segue o sistema de design **Clean Web Designer**.
Toda a identidade visual é controlada por tokens globais — componentes
individuais não aceitam customização visual via props.

### Onde encontrar cada coisa

| Preciso de... | Onde está |
|---------------|----------|
| Cores, fontes, espaçamentos | `references/design-tokens.md` |
| Catálogo de componentes | `references/ui-kit-components.md` |
| Padrões de animação | `references/animation-patterns.md` |
| Templates de página | `references/page-templates.md` |

### Como alterar o visual globalmente

Para mudar a aparência de TODOS os componentes de uma vez:

| Quero mudar... | Alterar no `design-tokens.md` |
|----------------|-------------------------------|
| Cor primária | `--color-primary` no `:root` |
| Fonte de títulos | `--font-display` no `:root` |
| Arredondamento dos cards | `--card-radius` em Component Tokens |
| Intensidade das sombras | `--shadow-sm`, `--shadow-md` etc. |
| Velocidade de animações | `--duration-normal` em Transições |

**Nunca altere o visual editando componentes individuais.**
Altere os tokens e todo o sistema reflete automaticamente.

---

## Componentes Usados

### Layout

#### Container
> Wrapper centralizado com max-width e padding responsivo.
(... doc completa seguindo o template ...)

#### Section
> Bloco de seção de página com padding generoso e header opcional.
(...)

### Navigation

#### Navbar
> Barra de navegação fixa com backdrop blur, responsiva com hamburger menu.
(...)

### Content

#### Card
> Card genérico para conteúdo com ícone, título e texto.

**Variantes:** Padrão (border + shadow), Hover lift.
**Props:**
| Prop | Tipo | Descrição |
|------|------|-----------|
| `icon` | `LucideIcon` | Ícone do header |
| `title` | `string` | Título do card |
| `text` | `string` | Descrição |

**Uso:**
```jsx
<Card icon={Zap} title="Velocidade" text="Processamento em tempo real." />
```

(... repetir para cada componente usado no projeto ...)

### Actions

#### Button
> Botão de ação com 4 variantes visuais e 3 tamanhos.
(...)

---

## Páginas

| Página | Rota | Componentes |
|--------|------|-------------|
| Landing | `/` | Navbar, HeroGradient, Section, Card, Stat, Footer |
| Pricing | `/pricing` | Navbar, PricingCard, ComparisonTable, FAQ, Footer |
| Login | `/login` | Input, Button |

---

## Convenções

- **Zero hardcode visual**: Toda cor, fonte, sombra e espaçamento vem de design tokens
- **Zero override por instância**: Componentes não aceitam props de aparência
- **Mobile-first**: Toda responsividade parte do mobile
- **Animações globais**: Micro-interações são do sistema, não do componente

````

---

## 5. Exemplos Completos de Docs

### Exemplo: Button

```markdown
---

## Button

> Botão de ação. Componente mais usado do kit. 4 variantes visuais, 3 tamanhos.

### Variantes

| Variante | Quando usar | Aparência |
|----------|-------------|-----------|
| `primary` | CTA principal, ação mais importante da tela | Fundo primário, texto branco, glow no hover |
| `secondary` | Ação complementar, menos destaque | Fundo cinza claro, texto escuro |
| `outline` | Ação alternativa, visual leve | Borda cinza, fundo transparente |
| `ghost` | Ações de menor prioridade, toolbars, menus | Sem fundo, texto cinza, fundo sutil no hover |

### Tamanhos

| Size | Uso típico | Altura |
|------|-----------|--------|
| `sm` | Toolbars, inline, nav actions | 32px |
| `md` | Formulários, cards, ações gerais | 40px |
| `lg` | Hero CTAs, ações de destaque | 48px |

### Props

| Prop | Tipo | Default | Obrigatória | Descrição |
|------|------|---------|-------------|-----------|
| `variant` | `"primary" \| "secondary" \| "outline" \| "ghost"` | `"primary"` | Não | Estilo visual |
| `size` | `"sm" \| "md" \| "lg"` | `"md"` | Não | Tamanho |
| `children` | `ReactNode` | — | Sim | Texto/conteúdo do botão |
| `icon` | `LucideIcon` | — | Não | Ícone (à esquerda por default) |
| `iconRight` | `boolean` | `false` | Não | Posiciona ícone à direita |
| `disabled` | `boolean` | `false` | Não | Desabilita interação |
| `onClick` | `() => void` | — | Não | Handler de clique |

### Uso

```jsx
// CTA principal
<Button variant="primary" size="lg" icon={ArrowRight} iconRight>
  Começar agora
</Button>

// Ação secundária
<Button variant="outline" size="md">
  Saiba mais
</Button>

// Botão desabilitado
<Button variant="primary" disabled>
  Processando...
</Button>
```

### Comportamento automático (do Design System)
- **Hover**: lift de 1px + glow (primary) ou background sutil (outros)
- **Focus**: ring de 3px azul (acessibilidade)
- **Disabled**: opacity 50%, cursor not-allowed
- **Transition**: 300ms ease em tudo

### Referências

| O que | Onde |
|-------|------|
| Código fonte | `ui-kit-components.md` → Action Components → Button |
| Tokens (altura, padding, radius) | `design-tokens.md` → Component Tokens → Botão |
| Animação de hover | `animation-patterns.md` → Hover States → Botões |
```

---

### Exemplo: Card vs FeatureCard vs PricingCard

Quando existem componentes relacionados mas distintos, documentar separadamente
e incluir uma nota de "Quando usar qual":

```markdown
### Cards — Quando usar qual?

| Componente | Quando usar |
|------------|-------------|
| `Card` | Conteúdo genérico: feature, benefício, info. Ícone + título + texto. |
| `FeatureCard` | Feature com layout horizontal (ícone à esquerda, texto à direita). Ideal para listas de funcionalidades. |
| `TestimonialCard` | Depoimento: quote + avatar + nome + cargo. Estrelas opcionais. |
| `PricingCard` | Plano de preço: nome + preço + features + CTA. Variante highlighted para destaque. |
| `MediaCard` | Card com imagem/vídeo no topo. Ideal para blog posts, portfolio, produtos. |

Cada um tem sua documentação abaixo ↓
```

---

## Checklist de Entrega

Antes de finalizar qualquer projeto, verificar:

- [ ] Todos os componentes usados estão documentados no README
- [ ] Cada doc tem: descrição, variantes, props, exemplo de uso, referências
- [ ] Nenhuma prop visual/comportamental foi documentada (animação, sombra, cor...)
- [ ] O README tem seção "Design System" com link para os arquivos de referência
- [ ] O README tem seção "Convenções" reforçando zero-override
- [ ] Se há componentes com variantes separadas (DataTable*), cada um tem doc própria
- [ ] A seção "Páginas" lista as rotas e quais componentes cada uma usa
