# Page Templates — Layouts de Páginas Completas

## Índice
1. Anatomia de Página
2. Landing Page (SaaS / Produto)
3. Landing Page (Institucional / Portfolio)
4. Pricing Page
5. About / Sobre
6. Blog / Article
7. Login / Auth
8. Dashboard Shell
9. Regras de Responsividade

---

## 1. Anatomia de Página

Toda página segue esta sequência fundamental. Cada bloco é uma Section do UI Kit.

```
┌─ Navbar ──────────────────────────────────────────┐
│  [Logo]        [Links]         [CTA Login/Signup] │
├───────────────────────────────────────────────────┤
│                                                   │
│  HERO — A promessa principal                      │
│  (50-70% do viewport, above the fold)             │
│                                                   │
├───────────────────────────────────────────────────┤
│  SOCIAL PROOF — Logos de clientes ou métricas     │
│  (strip sutil: "Confiado por +500 empresas")      │
├───────────────────────────────────────────────────┤
│                                                   │
│  FEATURES — Proposta de valor detalhada           │
│  (Grid 3 colunas com ícones + texto)              │
│                                                   │
├───────────────────────────────────────────────────┤
│                                                   │
│  HOW IT WORKS — Processo em 3 passos              │
│  (1 → 2 → 3 com numeração ou ícones)             │
│                                                   │
├───────────────────────────────────────────────────┤
│                                                   │
│  TESTIMONIALS — Prova social qualitativa          │
│  (Grid de TestimonialCards ou carrossel)           │
│                                                   │
├───────────────────────────────────────────────────┤
│                                                   │
│  PRICING — Planos (se aplicável)                  │
│  (3 PricingCards, meio highlighted)               │
│                                                   │
├───────────────────────────────────────────────────┤
│                                                   │
│  FAQ — Perguntas frequentes (Accordion)           │
│                                                   │
├───────────────────────────────────────────────────┤
│                                                   │
│  CTA FINAL — Último empurrão para conversão       │
│  (Full-width, cor primária, botão branco)         │
│                                                   │
├───────────────────────────────────────────────────┤
│  FOOTER                                           │
│  [Logo] [Produto] [Empresa] [Recursos] [Legal]   │
│  [Social] [Copyright]                             │
└───────────────────────────────────────────────────┘
```

### Regras de Sequência

1. **Hero SEMPRE primeiro** — acima do fold, a mensagem principal
2. **Social Proof logo abaixo** — validação imediata
3. **Features antes de Pricing** — mostrar valor antes do preço
4. **Testimonials como ponte** — entre features e pricing
5. **CTA Final antes do footer** — última chance de conversão
6. **Alternar fundos** — white/subtle para criar ritmo visual

---

## 2. Landing Page — SaaS / Produto

### Estrutura completa

```jsx
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* 1. Navbar */}
      <Navbar
        brand="ProductName"
        links={[
          { label: 'Recursos', href: '#features' },
          { label: 'Preços', href: '#pricing' },
          { label: 'Sobre', href: '#about' },
        ]}
        cta={<>
          <Button variant="ghost" size="sm">Entrar</Button>
          <Button variant="primary" size="sm">Começar grátis</Button>
        </>}
      />

      {/* 2. Hero */}
      <HeroGradient
        title={<>Simplifique seu <span className="text-blue-600">fluxo de trabalho</span></>}
        subtitle="A plataforma que transforma caos em produtividade. Integre, automatize e escale sem dor de cabeça."
        cta={<>
          <Button variant="primary" size="lg" icon={ArrowRight} iconRight>Experimentar grátis</Button>
          <Button variant="outline" size="lg" icon={Play}>Ver demo</Button>
        </>}
      />

      {/* 3. Logo Strip (Social Proof) */}
      <Section className="py-12 border-y border-gray-100">
        <p className="text-center text-sm text-gray-400 uppercase tracking-wider mb-8">
          Confiado por empresas que constroem o futuro
        </p>
        <div className="flex flex-wrap justify-center items-center gap-12 opacity-40 grayscale">
          {/* Logos SVG ou placeholder */}
        </div>
      </Section>

      {/* 4. Features Grid */}
      <Section tag="Recursos" title="Tudo o que você precisa" subtitle="...">
        <Grid cols={3}>
          <Card icon={Zap} title="Velocidade" text="..." />
          <Card icon={Shield} title="Segurança" text="..." />
          <Card icon={BarChart3} title="Análises" text="..." />
        </Grid>
      </Section>

      {/* 5. Feature Showcase (alternada) */}
      <Section subtle>
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <Badge variant="primary">Novo</Badge>
            <h3 className="text-3xl font-bold mt-4 mb-4">Feature destaque</h3>
            <p className="text-gray-600 mb-6 leading-relaxed">Descrição...</p>
            <ul className="space-y-3">
              <li className="flex items-center gap-3 text-sm text-gray-700">
                <Check size={16} className="text-green-500" /> Benefício 1
              </li>
            </ul>
          </div>
          <div className="rounded-2xl bg-white shadow-xl p-2">
            {/* Screenshot/mockup */}
          </div>
        </div>
      </Section>

      {/* 6. Metrics/Stats */}
      <Section>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
          <Stat value="10K+" label="Usuários ativos" />
          <Stat value="99.9" suffix="%" label="Uptime" />
          <Stat value="4.8" label="Avaliação média" />
          <Stat value="50M+" label="Tarefas concluídas" />
        </div>
      </Section>

      {/* 7. Testimonials */}
      <Section subtle tag="Depoimentos" title="O que nossos clientes dizem">
        <Grid cols={3}>
          <TestimonialCard ... />
        </Grid>
      </Section>

      {/* 8. Pricing */}
      <Section tag="Preços" title="Planos para cada necessidade" id="pricing">
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <PricingCard name="Starter" price="R$0" ... />
          <PricingCard name="Pro" price="R$49" highlighted ... />
          <PricingCard name="Enterprise" price="Custom" ... />
        </div>
      </Section>

      {/* 9. FAQ */}
      <Section subtle tag="FAQ" title="Perguntas frequentes">
        <div className="max-w-2xl mx-auto">
          {/* Accordion items */}
        </div>
      </Section>

      {/* 10. CTA Final */}
      <section className="bg-gray-900 py-24">
        <Container>
          <div className="text-center">
            <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">
              Pronto para começar?
            </h2>
            <p className="text-gray-400 text-lg mb-8 max-w-xl mx-auto">
              Junte-se a milhares de equipes que já transformaram sua produtividade.
            </p>
            <Button variant="primary" size="lg">Criar conta gratuitamente</Button>
          </div>
        </Container>
      </section>

      {/* 11. Footer */}
      <Footer brand="ProductName" columns={[...]} />
    </div>
  );
}
```

---

## 3. Landing Page — Institucional / Portfolio

Foco em storytelling visual. Mais espaço branco, menos CTAs.

### Diferenças do template SaaS:
- Hero com imagem/vídeo grande (HeroSplit)
- Seção "Sobre" com narrativa + foto equipe
- Grid de projetos / cases
- Seção de valores ou missão
- Contato / formulário ao invés de pricing

```
Hero (HeroSplit com foto grande)
→ Missão / Propósito (texto grande, espaçado)
→ Portfolio Grid (cards com imagens full-bleed)
→ Valores / Diferenciais (3 colunas com ícones)
→ Equipe (grid de avatares + nome + cargo)
→ Contato (formulário + info de contato)
→ Footer
```

---

## 4. Pricing Page

Layout dedicado a planos e comparação.

```
Navbar
→ Hero simples ("Planos simples e transparentes")
→ Toggle mensal/anual
→ 3 PricingCards lado a lado
→ Feature comparison table (full-width)
→ FAQ específico sobre preços
→ CTA "Ainda tem dúvidas? Fale conosco"
→ Footer
```

### Feature Comparison Table

```jsx
const ComparisonTable = ({ features, plans }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-gray-200">
          <th className="text-left py-4 px-4 text-gray-500 font-medium">Recurso</th>
          {plans.map(p => (
            <th key={p} className="text-center py-4 px-4 font-semibold text-gray-900">{p}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {features.map(f => (
          <tr key={f.name} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
            <td className="py-3.5 px-4 text-gray-700">{f.name}</td>
            {f.values.map((v, i) => (
              <td key={i} className="text-center py-3.5 px-4">
                {typeof v === 'boolean'
                  ? v ? <Check size={16} className="text-green-500 mx-auto" /> : <span className="text-gray-300">—</span>
                  : <span className="text-gray-900 font-medium">{v}</span>}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
```

---

## 5. Login / Auth Page

Layout split: formulário de um lado, visual/branding do outro.

```jsx
const AuthPage = ({ mode = 'login' }) => (
  <div className="min-h-screen grid lg:grid-cols-2">
    {/* Lado esquerdo — Formulário */}
    <div className="flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-gray-900 mb-2" style={{ fontFamily: 'var(--font-display)' }}>
          {mode === 'login' ? 'Bem-vindo de volta' : 'Criar sua conta'}
        </h1>
        <p className="text-gray-500 mb-8 text-sm">
          {mode === 'login' ? 'Entre com seus dados para acessar.' : 'Preencha seus dados para começar.'}
        </p>

        <div className="space-y-4">
          {mode === 'signup' && <Input label="Nome completo" placeholder="João Silva" />}
          <Input label="Email" type="email" placeholder="joao@email.com" />
          <Input label="Senha" type="password" placeholder="••••••••" />
        </div>

        <Button variant="primary" size="lg" className="w-full mt-6">
          {mode === 'login' ? 'Entrar' : 'Criar conta'}
        </Button>

        <p className="text-center text-sm text-gray-500 mt-6">
          {mode === 'login' ? 'Não tem conta? ' : 'Já tem conta? '}
          <a className="text-blue-600 font-medium hover:underline">
            {mode === 'login' ? 'Criar agora' : 'Fazer login'}
          </a>
        </p>
      </div>
    </div>

    {/* Lado direito — Visual/Brand */}
    <div className="hidden lg:flex items-center justify-center bg-gradient-to-br from-blue-600 to-blue-800 p-12">
      <div className="text-white text-center max-w-md">
        <h2 className="text-3xl font-bold mb-4">Produtividade sem limites</h2>
        <p className="text-blue-200 leading-relaxed">
          Junte-se a milhares de equipes que já transformaram sua forma de trabalhar.
        </p>
      </div>
    </div>
  </div>
);
```

---

## 6. Dashboard Shell

Estrutura de aplicação com sidebar e content area.

```jsx
const DashboardShell = ({ sidebar, topbar, children }) => (
  <div className="min-h-screen bg-gray-50 flex">
    {/* Sidebar */}
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
      <div className="h-16 flex items-center px-6 border-b border-gray-100">
        <span className="text-lg font-bold text-gray-900">Brand</span>
      </div>
      <nav className="flex-1 py-4 px-3 space-y-1">
        {sidebar}
      </nav>
    </aside>

    {/* Main content */}
    <div className="flex-1 flex flex-col">
      {/* Topbar */}
      <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8">
        {topbar}
      </header>

      {/* Content */}
      <main className="flex-1 p-8">
        {children}
      </main>
    </div>
  </div>
);

{/* Sidebar nav item */}
const SidebarItem = ({ icon: Icon, label, active }) => (
  <a className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
    ${active
      ? 'bg-blue-50 text-blue-700'
      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}>
    <Icon size={18} strokeWidth={1.5} />
    {label}
  </a>
);
```

---

## 9. Regras de Responsividade

### Breakpoints

| Breakpoint | Tailwind | Uso |
|------------|----------|-----|
| <640px | base | Mobile (1 coluna, stacked) |
| ≥640px | `sm:` | Mobile grande / tablet portrait |
| ≥768px | `md:` | Tablet landscape (2 colunas) |
| ≥1024px | `lg:` | Desktop (layout completo) |
| ≥1280px | `xl:` | Wide desktop |

### Escala Tipográfica Responsiva

| Elemento | Mobile | Tablet | Desktop |
|----------|--------|--------|---------|
| Hero h1 | text-3xl (30px) | text-4xl (36px) | text-6xl (60px) |
| Section h2 | text-2xl (24px) | text-3xl (30px) | text-4xl (36px) |
| Card h3 | text-lg (18px) | text-lg | text-lg |
| Body | text-sm (14px) | text-base (16px) | text-base |
| Small / helper | text-xs (12px) | text-xs | text-sm (14px) |

### Padrões de Colapso

```
Desktop (3 colunas)    →  Tablet (2 colunas)    →  Mobile (1 coluna)
┌───┬───┬───┐          ┌───┬───┐                 ┌───┐
│ 1 │ 2 │ 3 │          │ 1 │ 2 │                 │ 1 │
└───┴───┴───┘          ├───┼───┤                 ├───┤
                       │ 3 │   │                 │ 2 │
                       └───┴───┘                 ├───┤
                                                 │ 3 │
                                                 └───┘

Hero Split (lado a lado) → Mobile (empilhado, imagem abaixo)
Navbar (inline)          → Mobile (hamburger + drawer)
Pricing (3 cards)        → Mobile (scroll horizontal ou empilhado)
Footer (4 colunas)       → Mobile (2 colunas, logo full-width)
```

### Espaçamentos Responsivos

| Token | Mobile | Desktop |
|-------|--------|---------|
| Section padding-y | py-16 (64px) | py-24 (96px) |
| Section padding-x | px-5 (20px) | px-20 (80px) |
| Grid gap | gap-4 (16px) | gap-6-8 (24-32px) |
| Card padding | p-5 (20px) | p-6 (24px) |
| Stack gap | space-y-3 | space-y-4 |
