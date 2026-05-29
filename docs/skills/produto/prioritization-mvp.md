# Prioritization & MVP — RICE, ICE, MoSCoW, User Stories, Roadmap

## Índice
1. Frameworks de Priorização
2. RICE Score
3. ICE Score
4. MoSCoW
5. MVP Scoping
6. User Stories e Critérios de Aceitação
7. Roadmap
8. Feature Creep — Como Dizer Não

---

## 1. Frameworks de Priorização

| Framework | Quando usar | Complexidade |
|----------|------------|-------------|
| **RICE** | Backlog grande (20+ itens), precisa de objetividade | Alta |
| **ICE** | Decisão rápida, time pequeno, experimentação | Baixa |
| **MoSCoW** | Scoping de release ou MVP | Média |
| **Kano** | Entender satisfação do cliente por feature type | Alta |
| **Value vs Effort** | Visual rápido para priorização em grupo | Baixa |

---

## 2. RICE Score

```
RICE = (Reach × Impact × Confidence) / Effort

Reach:      Quantas pessoas impacta em 1 período (ex: por quarter)
Impact:     Quanto impacta cada pessoa (3=massive, 2=high, 1=medium, 0.5=low, 0.25=minimal)
Confidence: Quanta certeza tem (100%=dados, 80%=evidência, 50%=intuição)
Effort:     Pessoa-meses para implementar (0.5, 1, 2, 3, etc.)
```

### Exemplo de tabela RICE

```markdown
| Feature | Reach | Impact | Confidence | Effort | RICE Score |
|---------|-------|--------|-----------|--------|-----------|
| Onboarding wizard | 1000 | 3 | 80% | 2 | 1200 |
| Template de planos | 800 | 2 | 90% | 1 | 1440 |
| App do paciente | 500 | 2 | 60% | 3 | 200 |
| Integração Pix | 600 | 1 | 90% | 1.5 | 360 |
| Dashboard financeiro | 400 | 1 | 70% | 2 | 140 |
| Prescrição de suplementos | 200 | 0.5 | 30% | 2 | 15 |

Prioridade: Template > Onboarding > Integração Pix > App paciente > Dashboard > Suplementos
```

### Como estimar cada variável

```
Reach — Usar dados reais quando possível:
├── Quantos usuários ativos passam por esse fluxo?
├── Quantos tickets de suporte sobre esse tema?
├── Analytics: quantos visitam a página relacionada?
└── Se não tem dados: estimar conservadoramente

Impact — Baseado em jobs-to-be-done:
├── 3 (massivo): Resolve o job principal da persona
├── 2 (alto): Melhora significativamente o workflow
├── 1 (médio): Melhoria perceptível
├── 0.5 (baixo): Nice to have
├── 0.25 (mínimo): Cosmético

Confidence — Honestidade é chave:
├── 100%: Tem dados quantitativos (analytics, testes)
├── 80%: Tem evidência qualitativa (entrevistas, feedback)
├── 50%: Tem intuição forte mas sem dados
└── 30%: Chute. Sinal de que precisa validar antes de priorizar.

Effort — Estimativa do time de engenharia:
├── Incluir: design, dev, QA, deploy, doc
├── Unidade: pessoa-meses (1 dev trabalhando 1 mês = 1)
├── Na dúvida, arredondar PARA CIMA (Lei de Hofstadter)
└── Se > 3 meses: dividir em entregas menores
```

---

## 3. ICE Score

```
ICE = Impact × Confidence × Ease

Impact:     1-10 (quanto impacta o objetivo principal)
Confidence: 1-10 (quanta certeza tem)
Ease:       1-10 (quão fácil de implementar. 10=trivial, 1=meses)
```

### Exemplo

```markdown
| Feature | Impact | Confidence | Ease | ICE |
|---------|--------|-----------|------|-----|
| Template de planos | 9 | 8 | 7 | 504 |
| Onboarding wizard | 8 | 7 | 6 | 336 |
| Integração Pix | 6 | 9 | 8 | 432 |
| Dashboard financeiro | 5 | 6 | 5 | 150 |
```

### ICE vs RICE

```
ICE é mais rápido mas menos preciso.
Usar ICE para: brainstorm, decisões rápidas, time < 5 pessoas.
Usar RICE para: roadmap quarterly, muitas features, comunicar stakeholders.
```

---

## 4. MoSCoW

```
M — Must Have      Sem isso, o produto não funciona / não entrega valor
                    Se cortar um Must, o MVP não faz sentido.

S — Should Have    Importante, aumenta o valor significativamente
                    Incluir se possível, mas não bloqueia o lançamento.

C — Could Have     Nice to have, melhora a experiência
                    Incluir se sobrar tempo. Primeiro candidato a corte.

W — Won't Have     Não agora. Explicitamente fora de escopo.
                    Importante definir para evitar feature creep.
```

### Exemplo — MVP NutriPlan

```markdown
| Feature | Prioridade | Justificativa |
|---------|-----------|---------------|
| Criar plano alimentar com template | **Must** | Core do produto — é o job principal |
| Cadastro de pacientes | **Must** | Sem isso, não tem para quem criar plano |
| Login/registro do profissional | **Must** | Básico de autenticação |
| Enviar plano por email/link | **Must** | Precisa entregar o plano ao paciente |
| App do paciente (visualizar plano) | **Should** | Melhora UX, mas email funciona por ora |
| Lembretes automáticos | **Should** | Melhora retenção de pacientes |
| Dashboard financeiro | **Could** | Valor real, mas planilha resolve por ora |
| Integração com Pix | **Could** | Conveniência, não essencial no MVP |
| Prescrição de suplementos | **Won't** | Complexidade regulatória, baixa demanda |
| Multi-idiomas | **Won't** | MVP é Brasil only |
| White-label | **Won't** | Enterprise, fora do scope do MVP |
```

---

## 5. MVP Scoping

### Checklist de MVP

```
O MVP deve:
☑ Resolver o JOB PRINCIPAL da persona primária
☑ Ser buildável em 4-8 semanas (no máximo)
☑ Ter 3-5 features, não 15-20
☑ Ter métrica clara de sucesso/falha
☑ Ser suficiente para a persona PAGAR (ou dar feedback qualificado)
☑ Não ser embaraçoso (mas também não precisa ser perfeito)

O MVP NÃO deve:
☐ Ter todas as features do roadmap
☐ Atender personas secundárias
☐ Ter admin panel completo
☐ Ter todas as integrações
☐ Ser escalável para 1M usuários
☐ Ter cobertura de testes de 100%
```

### Framework de corte

Para cada feature, perguntar:

```
1. Se remover, o produto ainda entrega valor?
   Sim → Pode ser Should/Could/Won't
   Não → Must

2. Existe workaround manual?
   Sim → Pode ser Should/Could
   Não → Deve ser Must ou Should

3. Quantos % dos early adopters precisam disso?
   > 80% → Must
   50-80% → Should
   < 50% → Could ou Won't
```

---

## 6. User Stories e Critérios de Aceitação

### Template de User Story

```markdown
**Como** [persona],
**quero** [ação/funcionalidade],
**para** [benefício/resultado].

### Critérios de Aceitação
- [ ] [Condição verificável 1]
- [ ] [Condição verificável 2]
- [ ] [Condição verificável 3]

### Notas
- [Detalhes técnicos, edge cases, decisões de design]
```

### Exemplo

```markdown
**US-001: Criar plano alimentar**

**Como** nutricionista,
**quero** criar um plano alimentar a partir de um template,
**para** entregar ao paciente em menos de 10 minutos.

### Critérios de Aceitação
- [ ] Posso escolher entre pelo menos 5 templates base
- [ ] Posso personalizar refeições (café, almoço, jantar, lanches)
- [ ] Posso adicionar substitutos para cada alimento
- [ ] O plano mostra calorias e macros calculados automaticamente
- [ ] Posso salvar o plano vinculado ao paciente
- [ ] Tempo médio de criação < 10 min (medir na validação)

### Notas
- MVP: templates fixos. V2: criar templates customizados.
- Cálculo nutricional: usar tabela TACO (brasileira).
- Mobile-friendly: nutricionistas criam no celular entre consultas.
```

---

## 7. Roadmap

### Now / Next / Later (recomendado para MVP e early-stage)

```markdown
## Roadmap — NutriPlan

### NOW (próximas 6-8 semanas) — MVP
- Criar plano alimentar com templates
- Cadastro de pacientes
- Enviar plano por link/email
- Landing page + onboarding básico

### NEXT (2-3 meses após MVP) — Product-Market Fit
- App do paciente (visualizar plano no celular)
- Lembretes automáticos para pacientes
- Dashboard financeiro básico
- Relatório de evolução do paciente

### LATER (6+ meses) — Escala
- Integração com Pix / Stripe
- Marketplace de templates (nutris compartilham)
- Multi-profissional (clínicas)
- API para integrações
```

### Roadmap NÃO É contrato

```
Roadmap é DIREÇÃO, não promessa.
├── "Now" tem alta certeza (fazendo ou próximo sprint)
├── "Next" tem certeza média (depende de aprendizados do Now)
├── "Later" é especulação educada (vai mudar com certeza)
└── Atualizar o roadmap a cada 2-4 semanas com dados novos
```

---

## 8. Feature Creep — Como Dizer Não

```
Quando alguém pede uma feature:

1. Agradecer (o pedido é sinal de engajamento)
2. Entender o PORQUÊ (qual o job por trás do pedido?)
3. Quantificar (quantos usuários pedem/precisam?)
4. Priorizar (RICE/ICE contra o backlog existente)
5. Comunicar (sim/não/depois com justificativa)

Templates de resposta:

"Ótima sugestão! Vamos adicionar ao backlog e priorizar
 no próximo ciclo de planejamento."

"Entendo a necessidade. Neste momento estamos focados em
 [prioridade atual] que impacta 80% dos usuários.
 [Feature pedida] está no radar para Q3."

"Isso é importante, mas fora do scope do MVP.
 Vamos revisitar quando tivermos product-market fit."
```
