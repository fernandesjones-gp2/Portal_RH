# Problem Discovery — Encontrar o Problema Que Vale Resolver

## Índice
1. O Framework do Problema
2. Problem Statement
3. 5 Whys — Chegar na Raiz
4. Pesquisa de Usuário
5. Entrevista de Problema
6. Sinais de Que o Problema é Real
7. Sinais de Que o Problema é Fraco

---

## 1. O Framework do Problema

Antes de qualquer feature, canvas ou roadmap, responder:

```
┌──────────────────────────────────────────────────────┐
│  QUEM tem o problema?                                │
│  → Não "todo mundo". Nome, profissão, contexto.      │
│                                                      │
│  QUAL é o problema?                                  │
│  → 1 frase, sem jargão, sem mencionar solução.       │
│                                                      │
│  QUANDO acontece?                                    │
│  → Qual contexto, situação, trigger dispara a dor?   │
│                                                      │
│  COMO resolvem hoje?                                 │
│  → Alternativas existentes, workarounds, Excel, etc. │
│                                                      │
│  POR QUE as alternativas são ruins?                  │
│  → O gap que nenhuma alternativa preenche.           │
│                                                      │
│  QUANTO custa não resolver?                          │
│  → Tempo perdido, dinheiro, frustração, risco.       │
└──────────────────────────────────────────────────────┘
```

### Problema vs Solução — Separar SEMPRE

```
❌ Problema disfarçado de solução:
"Preciso de um app para gerenciar tarefas"
"Preciso de uma plataforma de marketplace"
"Preciso de um chatbot com IA"

✅ Problema real:
"Perco 2h/dia procurando informações espalhadas em email, Slack e planilhas"
"Artesãos locais não conseguem vender online sem pagar 30% de comissão"
"Time de suporte responde as mesmas 50 perguntas 200x por mês"
```

---

## 2. Problem Statement

### Template

```
[PERSONA] precisa de uma forma de [NECESSIDADE/JOB]
porque [MOTIVO/CONTEXTO],
mas atualmente [ALTERNATIVA ATUAL / DOR].
```

### Exemplos

```
Freelancers de design precisam de uma forma de cobrar clientes
porque lidam com 5-10 projetos simultâneos com prazos diferentes,
mas atualmente controlam tudo em planilhas e perdem em média
R$2.000/mês por faturas esquecidas.

Gerentes de restaurante precisam de uma forma de prever demanda
porque desperdiçam 15-20% dos insumos por falta de planejamento,
mas atualmente decidem as compras baseado em intuição.

Mães de crianças de 3-6 anos precisam de atividades educativas
porque querem limitar tempo de tela sem recorrer a "faça você mesmo",
mas atualmente gastam 30min/dia procurando conteúdo em Pinterest
e YouTube sem saber se é adequado para a idade.
```

---

## 3. 5 Whys — Chegar na Raiz

```
Problema aparente: "Clientes cancelam depois de 30 dias"

Por que cancelam?
→ Não usam o produto depois da primeira semana.

Por que não usam?
→ Não entendem como configurar o dashboard.

Por que não entendem?
→ O onboarding mostra features, não resolve o problema deles.

Por que o onboarding é assim?
→ Foi desenhado pelo time técnico, não pelo produto.

Por que o time técnico desenhou?
→ Não tinha PM quando lançamos. O onboarding nunca foi prioridade.

RAIZ: O problema não é "churn alto" — é "onboarding que não
conecta o usuário ao valor do produto nos primeiros 5 minutos".
```

### Como aplicar

```
1. Começar com o sintoma (o que o usuário reporta / o número ruim)
2. Perguntar "por que?" sem aceitar a primeira resposta
3. Repetir 5 vezes (pode ser 3 ou 7 — o número não é mágico)
4. A cada resposta, buscar EVIDÊNCIA (dados, entrevistas, logs)
5. Parar quando chegar em algo ACIONÁVEL

Regra: Se a resposta é "porque é assim" ou "porque sempre foi",
cavou fundo o suficiente. A raiz geralmente é uma decisão (ou
falta de decisão) do passado.
```

---

## 4. Pesquisa de Usuário

### Métodos por fase

| Fase | Método | Quando | Esforço |
|------|--------|--------|---------|
| Discovery | Entrevista de problema | Não sabe se o problema existe | 5-10 entrevistas |
| Discovery | Shadowing/observação | Quer ver o problema acontecendo | Acompanhar 3-5 pessoas |
| Discovery | Análise de comunidades | Quer validação assíncrona | Reddit, fóruns, reviews |
| Validação | Entrevista de solução | Tem protótipo/mockup | 5-10 entrevistas |
| Validação | Landing page | Quer medir interesse real | 1-2 semanas |
| Validação | Fake door test | Quer medir intenção de compra | 1 semana |
| Pós-launch | NPS / CSAT | Produto no ar, quer feedback | Contínuo |
| Pós-launch | Análise de comportamento | Produto no ar, quer padrões | Analytics contínuo |

### Onde encontrar pessoas para entrevistar

```
├── Comunidades online (Reddit, Facebook Groups, Discord)
├── LinkedIn (buscar por cargo/função)
├── Clientes de concorrentes (reviews na App Store, G2, Capterra)
├── Network pessoal (perigoso: viés de confirmação)
├── Fóruns especializados (Stack Overflow, Quora, fóruns de nicho)
├── Twitter/X (buscar por reclamações do problema)
└── Ferramentas: UserTesting, Respondent.io, UserInterviews
```

---

## 5. Entrevista de Problema

### Script base (30 minutos)

```
AQUECIMENTO (5 min)
"Me conta um pouco sobre seu dia-a-dia como [cargo/atividade]"
"Quais ferramentas você mais usa no trabalho?"

EXPLORAÇÃO DO PROBLEMA (15 min)
"Quando foi a última vez que você [situação do problema]?"
"Me conta o que aconteceu, passo a passo"
"O que foi mais frustrante nessa experiência?"
"Quanto tempo/dinheiro isso custou?"
"Com que frequência isso acontece?"

ALTERNATIVAS ATUAIS (5 min)
"Como você resolve isso hoje?"
"Já tentou outras soluções? O que deu certo e errado?"
"Se pudesse mudar uma coisa nesse processo, o que seria?"

PRIORIDADE (5 min)
"De 1 a 10, quanto esse problema te incomoda?"
"Você já pagou por alguma ferramenta para resolver isso?"
"Se existisse algo que resolvesse, quanto pagaria por mês?"
```

### O que NÃO fazer na entrevista

```
❌ Descrever sua solução e perguntar se gostam
   (The Mom Test: todo mundo diz que é legal)

❌ Perguntar "você usaria um app que...?"
   (hipotético ≠ real — as pessoas mentem sem querer)

❌ Perguntar "quanto pagaria?"
   (ninguém sabe. Observar COMPORTAMENTO, não intenção)

❌ Fazer perguntas fechadas (sim/não)
   (não geram insights)

❌ Entrevistar amigos e família
   (viés de confirmação garantido)

✅ Perguntar sobre o PASSADO, não o futuro
✅ Perguntar sobre COMPORTAMENTO, não opinião
✅ Deixar a pessoa falar 80% do tempo
✅ Anotar surpresas, não confirmações
✅ "Me conta mais sobre isso" é a melhor pergunta
```

---

## 6. Sinais de Que o Problema é Real

```
Sinais FORTES (vale construir):
├── Pessoas já gastam dinheiro tentando resolver (workarounds pagos)
├── Já tentaram múltiplas alternativas e nenhuma resolve bem
├── O problema causa perda financeira mensurável
├── Frequência alta (diário ou semanal)
├── Frustração emocional visível na entrevista
├── Perguntam "quando fica pronto?" sem você ter vendido nada
└── Oferecem pagar antecipado / entrar em beta

Sinais MODERADOS (investigar mais):
├── Reconhecem o problema mas não buscaram solução ativamente
├── Problema é real mas infrequente (1x por mês)
├── Alternativa atual é "ok" mas não excelente
└── Interessados mas não dispostos a trocar o que usam hoje
```

---

## 7. Sinais de Que o Problema é Fraco

```
Red flags (repensar antes de construir):
├── "Legal, mas não é algo que me incomoda muito"
├── "Eu resolvo com uma planilha e funciona ok"
├── "Nunca pensei nisso como problema"
├── Ninguém gasta tempo ou dinheiro tentando resolver
├── Problema existe mas frequência é muito baixa (1x por ano)
├── Só encontra o problema em nicho extremamente pequeno
├── Todas as entrevistas vão para direções diferentes
│   (cada pessoa tem um problema diferente = não há padrão)
└── Você é o único que tem esse problema
    (cuidado com "eu acho que todo mundo também...")
```
