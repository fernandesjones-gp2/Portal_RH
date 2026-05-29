# Discovery Playbook — Roteiro de Descoberta

## Índice
1. Mentalidade de Discovery
2. Roteiro de Perguntas por Camada
3. Técnicas de Refinamento
4. Sinais de Alerta
5. Template do Documento de Discovery

---

## 1. Mentalidade de Discovery

A discovery não é um interrogatório — é uma conversa exploratória.
O objetivo é sair com clareza suficiente para que qualquer engenheiro
do time consiga entender o problema sem perguntar mais nada.

### Regras de condução

- **Escuta ativa**: Deixar o usuário falar. Não interromper com soluções.
- **Perguntas abertas primeiro**: "Me conta sobre..." antes de "É X ou Y?"
- **Follow-up no detalhe**: Quando algo parece óbvio, perguntar "por quê?"
- **Não resolver ainda**: Fase 1 é ENTENDER, não SOLUCIONAR
- **Documentar durante**: Cada insight vai para o doc, não fica só na conversa

### Profundidade adaptativa

| Complexidade do projeto | Profundidade da discovery |
|------------------------|--------------------------|
| Script/automação simples | 5-10 min, perguntas essenciais |
| CRUD / app pequeno | 15-20 min, foco em escopo e dados |
| Sistema com regras de negócio | 30-45 min, discovery completa |
| Plataforma / SaaS | 1h+, multiple rounds, stakeholders |

---

## 2. Roteiro de Perguntas por Camada

### Camada 1 — O Problema (obrigatória)

```
🎯 O QUE
├── Qual problema esse sistema resolve?
├── O que acontece hoje sem esse sistema? (status quo)
├── Já tentou resolver de outra forma? O que não funcionou?
└── Se o sistema pudesse fazer UMA coisa bem, qual seria?

👤 PARA QUEM
├── Quem são os usuários principais? (personas)
├── Quantos usuários esperados? (ordem de grandeza: 10? 100? 10K? 1M?)
├── Qual o nível técnico dos usuários?
├── Existem diferentes tipos/papéis de usuários?
└── Alguém mais vai interagir com o sistema? (admins, operadores)

📏 POR QUE AGORA
├── O que motivou a criação desse sistema agora?
├── Tem prazo? Deadline hard ou soft?
├── Qual o custo de NÃO ter esse sistema?
└── Quem está patrocinando/decidindo?
```

### Camada 2 — O Contexto (importante)

```
🌐 ECOSSISTEMA
├── Esse sistema substitui ou complementa algo existente?
├── Precisa se integrar com outros sistemas? Quais?
│   ├── Tem APIs disponíveis? Documentação?
│   └── Quem controla esses sistemas?
├── Existem dados que precisam ser migrados?
└── Há dependências externas (APIs, serviços, fornecedores)?

🔒 RESTRIÇÕES
├── Tem regulação que afeta? (LGPD, HIPAA, PCI-DSS, SOX...)
├── Tem stack obrigatória? (empresa usa só Java, por exemplo)
├── Tem restrição de infraestrutura? (on-premise, cloud específica)
├── Tem orçamento definido para infra/serviços?
└── Tem restrição de time? (quem vai manter depois?)

📊 SUCESSO
├── Como sabe que o sistema funcionou? O que mede?
├── Quais são as métricas de sucesso? (KPIs)
├── Qual o cenário ideal daqui a 6 meses com o sistema rodando?
└── O que seria um fracasso? (anti-métricas)
```

### Camada 3 — O Comportamento (para sistemas complexos)

```
🔄 FLUXOS
├── Qual o fluxo principal do usuário? (happy path)
│   └── Passo a passo, do início ao fim
├── Quais os fluxos alternativos?
├── O que acontece quando dá errado? (error paths)
├── Existe processo de aprovação / workflow multi-etapa?
└── Tem ações que disparam outras ações? (triggers, webhooks)

💰 REGRAS DE NEGÓCIO
├── Quais as regras que o sistema precisa enforçar?
├── Tem cálculos específicos? (preços, comissões, impostos)
├── Tem estados / ciclo de vida? (pedido: criado → pago → enviado)
├── Tem permissões diferentes por tipo de usuário?
└── Tem regras que mudam com frequência? (configuráveis vs hardcoded)

📈 ESCALA E PERFORMANCE
├── Picos de uso esperados? (Black Friday, horário comercial)
├── Volume de dados? (registros por dia/mês)
├── Latência aceitável? (real-time, seconds, minutes)
├── Precisa funcionar offline?
└── Tem requisitos de disponibilidade? (99.9%? 99.99%?)
```

### Camada 4 — Visão Futura (opcional, mas valiosa)

```
🔮 EVOLUÇÃO
├── Quais features estão no radar para o futuro? (roadmap)
├── O sistema pode precisar suportar outros países/idiomas?
├── Pode precisar de app mobile no futuro?
├── Pode precisar abrir API para terceiros?
└── Qual o tamanho do time que vai manter isso?
```

---

## 3. Técnicas de Refinamento

### Técnica: "Five Whys" (Cinco Porquês)

Quando uma resposta parece superficial, aprofundar:

```
Usuário: "Preciso de um sistema de gestão de tarefas."
→ Por que? "Porque perdemos prazos."
→ Por que perdem prazos? "Porque ninguém sabe quem tá fazendo o quê."
→ Por que não sabem? "Porque cada um usa uma ferramenta diferente."
→ Por que usam ferramentas diferentes? "Porque nunca padronizamos."
→ Insight real: O problema é VISIBILIDADE e PADRONIZAÇÃO, não "gestão de tarefas".
```

### Técnica: "Day in the Life"

Pedir para o usuário descrever um dia típico usando o sistema:

```
"Imagine que o sistema já existe e está perfeito.
Me descreve como seria seu dia usando ele, do momento que abre
até o momento que fecha. O que você faz primeiro? Depois? Como termina?"
```

### Técnica: "Mágica vs Realidade"

```
"Se pudesse ter QUALQUER coisa, sem limite técnico ou de orçamento,
o que o sistema faria?"
(mapear a visão ideal)

"Agora, se tivesse que lançar em 2 semanas com 1 dev,
o que seria indispensável?"
(mapear o MVP real)
```

### Técnica: "Stakeholder Map"

```
Quem...
├── ...paga pelo sistema?
├── ...usa diariamente?
├── ...administra/configura?
├── ...precisa ver relatórios?
├── ...aprova mudanças?
└── ...é afetado indiretamente?
```

---

## 4. Sinais de Alerta na Discovery

Coisas que indicam que a discovery precisa de mais profundidade:

| Sinal | O que fazer |
|-------|-------------|
| "É simples, é só um CRUD" | Investigar regras de negócio escondidas |
| "Igual ao Uber/Airbnb mas para X" | Mapear quais features especificamente |
| "Precisa ser em tempo real" | Definir o que exatamente é "tempo real" |
| "Qualquer banco serve" | Entender padrão de acesso e volume |
| "Depois a gente vê" | Marcar como risco e documentar a indefinição |
| "Todo mundo vai usar" | Definir personas concretas |
| "O sistema faz tudo" | Delimitar escopo aggressivamente |
| Usuário não consegue explicar o fluxo | O domínio precisa de mais discovery |
| Contradições entre respostas | Alinhar antes de seguir |

---

## 5. Template do Documento de Discovery

```markdown
# 01 — Discovery

## Resumo do Projeto
> [Uma frase que qualquer pessoa entende]

## Problema
### O que acontece hoje (status quo)
[Descrever a situação atual sem o sistema]

### Qual problema resolve
[Descrever o problema central]

### Por que agora
[Motivação, urgência, contexto]

## Usuários
### Personas
| Persona | Descrição | Frequência de Uso | Nível Técnico |
|---------|-----------|-------------------|---------------|
| | | | |

### Volume esperado
- Usuários totais: [X]
- Usuários simultâneos (pico): [X]
- Crescimento esperado: [X% por mês/ano]

## Contexto Técnico
### Integrações
| Sistema | Tipo | API disponível? | Quem controla? |
|---------|------|-----------------|----------------|
| | | | |

### Restrições
- Stack: [obrigatória / flexível]
- Infra: [cloud / on-premise / híbrido]
- Regulação: [LGPD / outras / nenhuma]
- Prazo: [data ou flexível]
- Budget: [definido / flexível]

## Métricas de Sucesso
| Métrica | Meta | Como medir |
|---------|------|-----------|
| | | |

## Definição de MVP
### Indispensável (P0)
- [Feature 1]
- [Feature 2]

### Importante mas não urgente (P1)
- [Feature 3]

### Futuro (P2+)
- [Feature 4]

## Perguntas em Aberto
- [ ] [Pergunta que ficou sem resposta]
- [ ] [Item que precisa de mais investigação]

## Notas da Conversa
[Insights relevantes que surgiram durante a discovery]
```
