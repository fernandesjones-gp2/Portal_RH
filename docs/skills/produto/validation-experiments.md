# Validation & Experiments — Testar Hipóteses Antes de Construir

## Índice
1. Hipóteses a Validar
2. Mapa de Experimentos
3. Landing Page Test
4. Fake Door Test
5. Concierge MVP
6. Wizard of Oz
7. Pré-Venda
8. Design de Experimento

---

## 1. Hipóteses a Validar

Todo produto tem 3 hipóteses centrais. Validar NA ORDEM:

```
Hipótese 1 — PROBLEMA (validar primeiro)
  "O problema X existe para a persona Y com frequência Z"
  Método: Entrevistas de problema (5-10 pessoas)
  Critério: ≥ 7/10 confirmam a dor e buscaram alternativas

Hipótese 2 — SOLUÇÃO (validar segundo)
  "A solução A resolve o problema X melhor que as alternativas"
  Método: Protótipo, concierge, wizard of oz
  Critério: ≥ 5/10 usam e reportam valor

Hipótese 3 — MODELO (validar terceiro)
  "A persona Y pagaria R$Z/mês pela solução A"
  Método: Pré-venda, landing page com pricing, fake door
  Critério: ≥ 3% de conversão ou ≥ 5 pré-vendas

Ordem importa! Não adianta validar se pagam (H3) sem saber
se o problema existe (H1). Construir solução (H2) sem validar
problema (H1) é o erro #1 de startups.
```

---

## 2. Mapa de Experimentos

| Experimento | Valida | Tempo | Custo | Fidelidade |
|------------|--------|-------|-------|------------|
| Entrevista de problema | H1 (problema) | 1-2 semanas | Grátis | Qualitativa |
| Análise de comunidades | H1 (problema) | 2-3 dias | Grátis | Qualitativa |
| Landing page | H2+H3 (interesse) | 1 semana | R$500 ads | Quantitativa |
| Fake door test | H3 (intenção de compra) | 1 semana | R$200 ads | Quantitativa |
| Concierge MVP | H2 (solução funciona) | 2-4 semanas | Tempo | Qualitativa |
| Wizard of Oz | H2 (UX funciona) | 2-4 semanas | Tempo | Qualitativa |
| Pré-venda | H3 (pagamento real) | 1-2 semanas | Grátis | $ real |
| Protótipo clicável | H2 (UX faz sentido) | 1 semana | Grátis (Figma) | Qualitativa |
| Beta fechado | H2+H3 (tudo junto) | 4-8 semanas | Custo dev | Quantitativa |

### Regra de ouro

```
Validar com o MENOR INVESTIMENTO possível:

Conversa > Protótipo > Landing page > Concierge > Código

Se pode validar com 10 conversas de 30 min, não construa nada.
Se pode validar com uma landing page, não escreva código.
Se pode validar com trabalho manual (concierge), não automatize.
```

---

## 3. Landing Page Test

### O que é

Página simples que descreve o produto (antes de existir) e mede
interesse real via sign-up, waitlist ou clique em "comprar".

### Estrutura da landing page

```
1. HEADLINE — Proposta de valor em 1 frase
   "Monte planos alimentares em 10 minutos, não 2 horas"

2. SUB-HEADLINE — Para quem e o que faz
   "Ferramenta para nutricionistas que querem mais tempo
    para pacientes e menos tempo em planilhas"

3. HERO — Screenshot ou mockup do produto (pode ser fake)

4. BENEFÍCIOS — 3-4 bullets com ícones
   ✨ Templates de planos prontos
   📱 App para o paciente acompanhar
   💰 Controle financeiro integrado
   ⚡ Setup em 5 minutos

5. PROVA SOCIAL (se tiver)
   "200+ nutricionistas na lista de espera"
   Logos, depoimentos (de beta testers)

6. CTA — Call to Action
   "Entrar na lista de espera" (email)
   ou "Começar free trial" (se tem MVP)
   ou "Reservar por R$29/mês" (pré-venda — validação mais forte)

7. FAQ — Objeções comuns
```

### Métricas para avaliar

```
Tráfego → Conversão de CTA:

Nível de interesse:
├── > 10% sign-up rate = FORTE (muito interesse)
├── 5-10% = BOM (vale investigar mais)
├── 2-5% = FRACO (mensagem ou público errado)
└── < 2% = PROBLEMA (ideia, copy ou audiência)

Referência por canal:
├── Ads pagos: 3-5% é bom
├── Tráfego orgânico: 5-10% é bom
├── Email direto: 10-20% é bom
└── Indicação: 15-30% é bom
```

---

## 4. Fake Door Test

### O que é

Adicionar um botão/feature no produto (ou landing page) que PARECE
funcionar, mas ao clicar, mostra "em breve" e pede para votar/registrar interesse.

```
Cenário: Quer saber se nutricionistas querem feature de prescrição
de suplementos antes de construir.

Implementação:
1. Adicionar botão "Prescrever Suplementos" no dashboard
2. Ao clicar: modal "🚀 Em breve! Essa feature está em desenvolvimento.
   Quer ser avisado quando lançar?" [Email] [Sim, me avise]
3. Medir: % de cliques e % de sign-ups

Critério de sucesso:
├── > 15% clicaram no botão = demanda forte, priorizar
├── 5-15% = interesse moderado, investigar mais
└── < 5% = baixa demanda, não priorizar
```

---

## 5. Concierge MVP

### O que é

Entregar o valor do produto MANUALMENTE, sem código, para validar
se a solução resolve o problema.

```
Exemplo — NutriPlan:

Ao invés de construir o app:
1. Encontrar 5 nutricionistas beta
2. Pedir que enviem os dados do paciente por formulário Google
3. MANUALMENTE criar o plano alimentar usando Canva + template bonito
4. Enviar o plano por email/WhatsApp
5. Perguntar: "Isso resolveu? Pagaria R$49/mês por isso?"

Custo: 5-10 horas de trabalho manual
Resultado: Validação real de que a solução entrega valor
Bônus: Aprende exatamente o workflow ideal para depois automatizar
```

### Quando usar

```
✅ Quando o produto é um serviço (trabalho pode ser manual)
✅ Quando quer entender o workflow antes de automatizar
✅ Quando tem tempo mas não tem dev/budget
✅ Para validar se o output é valioso antes de escalar

❌ Quando o valor é na automação em si (ex: real-time alertas)
❌ Quando precisa de escala para funcionar (marketplace 2 lados)
❌ Quando o custo manual é proibitivo
```

---

## 6. Wizard of Oz

### O que é

O usuário acha que está usando tecnologia, mas por trás tem um
humano fazendo o trabalho.

```
Exemplo:
Frontend: Chatbot bonito que "usa IA" para sugerir dietas
Backend: Humano lendo as mensagens e respondendo manualmente

O usuário testa a EXPERIÊNCIA completa.
Você valida se a UX faz sentido e se o output é valioso.
Só depois automatiza com IA/algoritmo.

Famoso: Zappos vendeu sapatos online sem ter estoque.
Comprava em lojas locais e enviava quando alguém comprava no site.
Validou a demanda antes de montar supply chain.
```

---

## 7. Pré-Venda

### O que é

Pedir dinheiro ANTES de construir. A validação mais forte possível.

```
Métodos:
├── Crowdfunding (Kickstarter, Catarse) — para produtos físicos/criativos
├── "Funder's deal" — desconto para quem pagar antes do lançamento
├── Assinatura beta — "R$29/mês nos primeiros 3 meses, R$49 depois"
└── Depósito reembolsável — "Reserve por R$10, devolvemos se não gostar"

Critério de sucesso:
├── 10+ pré-vendas de desconhecidos = sinal forte
├── 3-5 pré-vendas = sinal moderado (investigar mais)
└── 0 pré-vendas = pivot ou reformular proposta

Importante: dinheiro > email > like > "legal!"
  Alguém que PAGA validou mais que 100 que disseram "eu usaria".
```

---

## 8. Design de Experimento

### Template

```markdown
## Experimento: [Nome]

**Hipótese:** Acreditamos que [X] porque [evidência].

**Experimento:** Vamos [ação] para [N pessoas] durante [período].

**Métrica de sucesso:** [Métrica] ≥ [threshold].

**Critério de decisão:**
- Se ≥ threshold → [próximo passo — avançar]
- Se < threshold → [próximo passo — pivotar ou investigar]

**Custo:** [tempo + dinheiro]

**Resultado:** [preencher depois]
**Aprendizado:** [preencher depois]
```

### Exemplo

```markdown
## Experimento: Landing Page NutriPlan

**Hipótese:** Nutricionistas autônomas se interessam por uma ferramenta
que monta planos alimentares em 10 min, porque 7/10 entrevistadas
reclamaram do tempo gasto em planilhas.

**Experimento:** Landing page com CTA "Entrar na lista de espera"
+ R$500 em Instagram Ads segmentado para nutricionistas 25-35 anos
em SP e BH, durante 2 semanas.

**Métrica de sucesso:** Taxa de sign-up ≥ 5% (≥ 50 sign-ups em 1.000 visitas).

**Critério de decisão:**
- Se ≥ 5% → Avançar para Concierge MVP com os sign-ups
- Se 2-5% → Testar variações de copy/headline
- Se < 2% → Reavaliar proposta de valor e público

**Custo:** R$500 + 8h de trabalho (landing page + análise)
```
