# Metrics & KPIs — North Star, AARRR, OKRs e Métricas SaaS

## Índice
1. North Star Metric
2. AARRR — Pirate Metrics
3. Métricas SaaS Essenciais
4. OKRs — Objectives & Key Results
5. Cohort Analysis
6. Dashboard de Produto
7. Quando Pivotar

---

## 1. North Star Metric

### O que é

A ÚNICA métrica que melhor captura o valor central que o produto
entrega para o cliente. Se essa métrica cresce, o produto está
saudável. Se estagna ou cai, algo está errado.

```
North Star NÃO é:
├── Receita (consequência, não causa)
├── Número de usuários (vaidade, não valor)
├── Downloads (não significa que usam)
└── Page views (não significa que entregou valor)

North Star É:
├── Algo que o USUÁRIO faz que indica que recebeu valor
├── Algo que se correlaciona com retenção e receita
├── Algo que o time inteiro pode influenciar
└── Algo mensurável e acionável
```

### Exemplos por tipo de produto

| Produto | North Star Metric | Por quê |
|---------|------------------|---------|
| Spotify | Tempo de escuta por semana | Indica valor entregue ao ouvinte |
| Airbnb | Noites reservadas | Valor para hóspede E host |
| Slack | Mensagens enviadas por equipe/semana | Indica adoção e uso real |
| Netflix | Horas assistidas / assinante / mês | Valor percebido pelo assinante |
| NutriPlan (exemplo) | Planos alimentares criados / nutri / semana | Indica que o core funciona |

### Como escolher

```
1. O que o usuário FAZ quando recebe valor?
   → Essa ação é candidata a North Star

2. Se essa métrica cresce, o negócio cresce?
   → Se não, é métrica de vaidade

3. O time pode influenciar diretamente?
   → Se não, é lagging indicator (efeito, não causa)
```

---

## 2. AARRR — Pirate Metrics

```
Funil do usuário — de desconhecido a evangelista:

1. ACQUISITION  → Como descobrem o produto?
2. ACTIVATION   → Tem uma primeira experiência de valor? (Aha moment)
3. RETENTION    → Voltam e continuam usando?
4. REVENUE      → Pagam?
5. REFERRAL     → Indicam para outros?
```

### Métricas por fase

```markdown
## ACQUISITION (Aquisição)
Como os usuários chegam?

| Métrica | Cálculo | Meta |
|---------|---------|------|
| Visitantes únicos | Analytics | Crescendo MoM |
| CAC (Custo de Aquisição) | Total marketing / novos clientes | < 1/3 do LTV |
| CAC por canal | Custo do canal / clientes do canal | Varia |
| Signup rate | Signups / visitantes | > 3-5% |

Canais a medir separadamente:
├── Orgânico (SEO, blog, social)
├── Pago (Google Ads, Instagram Ads)
├── Referral (indicação de usuários)
├── Direto (digitou URL)
└── Parcerias


## ACTIVATION (Ativação)
O usuário teve o "Aha moment"?

| Métrica | Cálculo | Meta |
|---------|---------|------|
| Aha moment rate | Users que completaram ação-chave / total signups | > 40% |
| Time to value | Tempo entre signup e primeira ação de valor | < 5 min |
| Onboarding completion | Users que completaram onboarding / total | > 60% |
| Activation rate | Users ativos na 1ª semana / signups | > 25% |

Definir o Aha Moment:
├── NutriPlan: Criar o primeiro plano alimentar
├── Slack: Enviar 2000 mensagens no time
├── Dropbox: Salvar primeiro arquivo de outro device
└── O momento em que o usuário "entende" o valor


## RETENTION (Retenção)
Os usuários voltam?

| Métrica | Cálculo | Meta SaaS |
|---------|---------|-----------|
| D1 retention | Users ativos 1 dia após signup / signups | > 40% |
| D7 retention | Users ativos 7 dias após signup / signups | > 20% |
| D30 retention | Users ativos 30 dias após signup / signups | > 10% |
| Monthly churn | Users que cancelaram no mês / total início do mês | < 5% |
| Net retention | (MRR início + expansion - churn) / MRR início | > 100% |

Retenção é a RAINHA das métricas.
Sem retenção, acquisition é balde furado.


## REVENUE (Receita)
Pagam e quanto?

| Métrica | Cálculo | Meta |
|---------|---------|------|
| MRR | Soma de assinaturas mensais | Crescendo MoM |
| ARR | MRR × 12 | — |
| ARPU | MRR / total users pagantes | Estável ou crescendo |
| LTV | ARPU × tempo médio de vida (1/churn) | > 3× CAC |
| Trial to paid | Pagantes / total que iniciou trial | > 3-5% |
| Expansion MRR | Upgrade + add-ons no mês | > Churn MRR |


## REFERRAL (Indicação)
Indicam para outros?

| Métrica | Cálculo | Meta |
|---------|---------|------|
| NPS | % promotores - % detratores | > 40 |
| Viral coefficient (K) | Convites enviados × taxa de conversão do convite | > 0.5 |
| Referral rate | Users que indicaram / total users | > 10% |
| Organic signups | Signups sem atribuição paga / total | Crescendo |
```

---

## 3. Métricas SaaS Essenciais

### Unit Economics

```
LTV (Lifetime Value):
  LTV = ARPU / Churn Rate
  Ex: R$49/mês / 5% churn = R$980

CAC (Customer Acquisition Cost):
  CAC = Total gastos em marketing e vendas / novos clientes
  Ex: R$10.000 / 50 clientes = R$200

LTV:CAC Ratio:
  LTV / CAC = R$980 / R$200 = 4.9x

  > 3x = saudável
  1-3x = precisa melhorar retenção ou reduzir CAC
  < 1x = perdendo dinheiro por cliente (insustentável)

Payback Period:
  CAC / ARPU = R$200 / R$49 = ~4 meses
  < 12 meses = bom
  > 18 meses = preocupante (cash flow problem)
```

### Quick Ratio SaaS

```
Quick Ratio = (New MRR + Expansion MRR) / (Churned MRR + Contraction MRR)

> 4 = excelente (crescimento forte)
2-4 = bom
1-2 = crescimento lento (churn quase anula crescimento)
< 1 = encolhendo
```

---

## 4. OKRs — Objectives & Key Results

### Estrutura

```
Objective: Qualitativo, inspirador, ambicioso, com prazo
Key Results: Quantitativos, mensuráveis, 2-5 por objetivo

Bom OKR: O = ambicioso + KRs = específicos e mensuráveis
Mau OKR: O = vago ("melhorar o produto") ou KR = tarefa ("lançar feature X")
```

### Exemplo para MVP

```markdown
## Q1 2025 — OKRs NutriPlan

### O1: Validar que nutricionistas adotam a ferramenta
- KR1: 100 nutricionistas se cadastram no período de trial
- KR2: 40% completam a ativação (criam 1o plano alimentar)
- KR3: 15% convertem para plano pago ao final do trial
- KR4: NPS dos pagantes ≥ 40

### O2: Provar que o produto retém usuários
- KR1: Retenção D30 ≥ 25% (users ativos 30 dias após signup)
- KR2: Churn mensal dos pagantes < 8%
- KR3: Média de 4+ planos criados por nutri por mês
- KR4: 3+ feedbacks qualitativos de "não consigo voltar para planilha"

### O3: Estabelecer canal de aquisição sustentável
- KR1: CAC via Instagram Ads < R$50
- KR2: Referral rate ≥ 10% (nutris indicam colegas)
- KR3: 30% dos signups vêm de canal orgânico
```

---

## 5. Cohort Analysis

### O que é

Agrupar usuários por data de entrada e comparar comportamento
ao longo do tempo. Revela se o produto está melhorando ou piorando.

```
         Semana 0  Semana 1  Semana 2  Semana 3  Semana 4
Coorte Jan   100%     45%       30%       22%       18%
Coorte Fev   100%     52%       38%       28%       25%
Coorte Mar   100%     58%       42%       35%       30%

Leitura: Cada coorte (grupo de users que entrou no mesmo mês)
retém melhor que a anterior? Se sim, produto está melhorando.
Coorte Mar retém melhor que Jan em todas as semanas = bom sinal.
```

---

## 6. Dashboard de Produto

### Métricas que importam no MVP

```
Dashboard Mínimo (revisar diariamente):
├── Signups hoje / esta semana
├── Ativações (completaram Aha moment) / total signups
├── DAU / WAU (Daily/Weekly Active Users)
└── NPS ou CSAT do período

Dashboard Semanal:
├── Funil AARRR completo com taxas de conversão
├── Retenção D1, D7, D30
├── Churn de pagantes
├── Top features por uso
├── Feedback qualitativo recente (quotes de users)
└── Bugs/issues reportados

Dashboard Mensal:
├── MRR + variação
├── LTV / CAC
├── Cohort analysis
├── NPS trend
├── Roadmap progress
└── Aprendizados do ciclo
```

---

## 7. Quando Pivotar

### Sinais de que precisa pivotar

```
Sinais VERMELHOS (pivotar agora):
├── Activation < 10% (ninguém entende o valor)
├── D30 retention < 5% (ninguém volta)
├── 0 conversões para pago após 100+ trials
├── NPS negativo (mais detratores que promotores)
├── Feedback consistente: "legal mas não preciso"
└── Churn > 15%/mês após 3 meses

Sinais AMARELOS (investigar):
├── Activation 10-25% (alguns entendem, maioria não)
├── D30 retention 5-15% (retém pouco)
├── Conversão para pago 1-3%
├── Crescimento depende 100% de ads pagos
└── Feedback misto (alguns amam, maioria indiferente)

Sinais VERDES (continuar iterando):
├── Activation > 30%
├── D30 retention > 15%
├── Conversão para pago > 5%
├── NPS > 30
├── Crescimento orgânico aparecendo
└── Feedback: "não consigo voltar para o antigo"
```

### Tipos de pivot

```
├── Pivot de segmento: Mesmo produto, audiência diferente
│   "Nutricionistas não adotaram, mas personal trainers sim"
│
├── Pivot de problema: Mesma audiência, problema diferente
│   "Nutricionistas não querem ferramenta de planos,
│    querem ferramenta de agendamento"
│
├── Pivot de solução: Mesmo problema, abordagem diferente
│   "App não funciona, mas serviço de templates por email sim"
│
├── Pivot de canal: Mesmo tudo, distribuição diferente
│   "Instagram Ads não converte, mas parceria com faculdades sim"
│
└── Pivot de modelo: Mesmo produto, monetização diferente
    "SaaS não funciona, mas marketplace de templates sim"
```
