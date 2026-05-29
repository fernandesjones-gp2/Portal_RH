# Prompt Engineering — Técnicas, Patterns e Structured Output

## Índice
1. Anatomia de um Prompt
2. System Prompt — Princípios
3. Few-Shot Learning
4. Chain of Thought (CoT)
5. Structured Output (JSON Mode)
6. Técnicas Avançadas
7. Anti-Patterns

---

## 1. Anatomia de um Prompt

```
Um prompt eficaz tem 5 componentes (nem todos obrigatórios):

┌─────────────────────────────────────────────────┐
│ 1. ROLE        Quem o modelo deve ser           │
│ 2. CONTEXT     Background e informação relevante│
│ 3. TASK        O que fazer (instrução clara)    │
│ 4. FORMAT      Como retornar (schema, exemplos) │
│ 5. CONSTRAINTS Limites e regras                 │
└─────────────────────────────────────────────────┘

Regra: quanto mais específico cada componente, melhor o resultado.
"Resuma esse texto" < "Você é um editor sênior de jornal.
Resuma o artigo abaixo em 3 bullets de no máximo 20 palavras cada,
focando nos impactos econômicos. Retorne em JSON."
```

---

## 2. System Prompt — Princípios

```xml
<!-- Template de System Prompt robusto -->
<system>
Você é [ROLE: quem é, experiência, especialidade].

## Objetivo
[TASK: o que deve fazer, em que contexto]

## Regras
- [CONSTRAINT 1: o que sempre fazer]
- [CONSTRAINT 2: o que nunca fazer]
- [CONSTRAINT 3: limites de escopo]

## Formato de resposta
[FORMAT: como estruturar o output — JSON schema, markdown, etc.]

## Exemplos
[FEW-SHOT: 1-3 exemplos de input → output esperado]
</system>
```

### Princípios de System Prompt

```
1. IDENTIDADE CLARA
   ❌ "Você é uma IA útil"
   ✅ "Você é um analista financeiro sênior especializado em
       mercados emergentes da América Latina com 15 anos de experiência."

2. INSTRUÇÕES POSITIVAS > NEGATIVAS
   ❌ "Não use jargão técnico. Não seja prolixo. Não invente dados."
   ✅ "Use linguagem acessível para não-especialistas.
       Seja conciso (máximo 3 parágrafos). Base-se apenas nos dados fornecidos."

3. FORMATO EXPLÍCITO
   ❌ "Retorne uma análise"
   ✅ "Retorne um JSON com os campos:
       - sentiment: 'positive' | 'negative' | 'neutral'
       - confidence: number (0-1)
       - reasoning: string (1 frase explicando)"

4. EXEMPLOS VALEM MAIS QUE INSTRUÇÕES
   Mostrar 2-3 exemplos de input → output é mais eficaz
   que 2 parágrafos explicando o que quer.

5. EDGE CASES EXPLÍCITOS
   "Se o texto não contiver informação suficiente, retorne
   { sentiment: null, confidence: 0, reasoning: 'Informação insuficiente' }"
```

---

## 3. Few-Shot Learning

```javascript
// Few-shot: dar exemplos no prompt para o modelo aprender o padrão

const messages = [
  {
    role: 'system',
    content: `Você classifica tickets de suporte em categorias.
Retorne APENAS o JSON, sem explicação.`,
  },

  // Exemplo 1
  { role: 'user', content: 'Não consigo fazer login, diz que a senha está errada' },
  { role: 'assistant', content: '{"category": "auth", "subcategory": "password", "priority": "medium"}' },

  // Exemplo 2
  { role: 'user', content: 'A página de pagamento está dando erro 500' },
  { role: 'assistant', content: '{"category": "payment", "subcategory": "checkout_error", "priority": "high"}' },

  // Exemplo 3 (edge case)
  { role: 'user', content: 'Vocês são os piores, nunca mais compro aqui!' },
  { role: 'assistant', content: '{"category": "feedback", "subcategory": "complaint", "priority": "low"}' },

  // Input real
  { role: 'user', content: ticketText },
];
```

```
Regras de few-shot:

Quantidade:
├── 0-shot: Modelo bom no task + instruções claras
├── 1-3 shot: Maioria dos casos (sweet spot)
├── 5-10 shot: Tasks complexos ou formato muito específico
└── 10+ shot: Considerar fine-tuning

Qualidade dos exemplos:
├── Cobrir happy path E edge cases
├── Exemplos diversos (não todos iguais)
├── Exemplos realistas (dados parecidos com produção)
├── Incluir exemplo de "não sei" / "insuficiente"
└── Ordenar do mais simples ao mais complexo
```

---

## 4. Chain of Thought (CoT)

```
CoT: pedir ao modelo que PENSE passo a passo antes de responder.
Melhora significativamente raciocínio lógico, matemática e análise.

Tipos:
├── Zero-shot CoT: "Pense passo a passo."
├── Few-shot CoT: Exemplos com raciocínio explícito
└── Structured CoT: Pedir <thinking> antes de <answer>
```

```javascript
// Structured CoT — separar raciocínio do resultado
const systemPrompt = `Você é um especialista em análise de risco de crédito.

Para cada solicitação:
1. Analise os fatores em <analysis>
2. Dê o veredito em <decision>

<analysis>
- Liste fatores positivos e negativos
- Avalie o risco de cada fator
- Pese os fatores
</analysis>

<decision>
{"approved": boolean, "limit": number, "risk_score": number, "reasoning": string}
</decision>`;

// O modelo pensa em <analysis> (podemos descartar)
// e retorna a decisão estruturada em <decision> (extraímos o JSON)
```

```
Quando usar CoT:
├── Raciocínio lógico multi-step
├── Análise de prós/contras
├── Matemática ou cálculos
├── Problemas que requerem planejamento
├── Classificação com critérios complexos
└── Code generation (planejar antes de codar)

Quando NÃO usar CoT:
├── Tasks simples (classificação binária, extração direta)
├── Quando latência é crítica (CoT gera mais tokens)
├── Quando o custo de tokens extras não se justifica
└── Tarefas criativas puras (pode sobre-racionalizar)
```

---

## 5. Structured Output (JSON Mode)

```javascript
// SEMPRE usar structured output quando o resultado será processado por código.
// Texto livre → parse → dor de cabeça. JSON schema → parse confiável.

// Anthropic Claude — tool use para structured output
const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 1000,
  tools: [{
    name: 'classify_ticket',
    description: 'Classifica um ticket de suporte',
    input_schema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          enum: ['auth', 'payment', 'product', 'shipping', 'feedback', 'other'],
        },
        priority: {
          type: 'string',
          enum: ['critical', 'high', 'medium', 'low'],
        },
        summary: {
          type: 'string',
          description: 'Resumo em 1 frase do problema',
        },
        requires_human: {
          type: 'boolean',
          description: 'Se precisa de atendimento humano',
        },
      },
      required: ['category', 'priority', 'summary', 'requires_human'],
    },
  }],
  tool_choice: { type: 'tool', name: 'classify_ticket' }, // Forçar uso da tool
  messages: [{ role: 'user', content: `Classifique: "${ticketText}"` }],
});

// Resultado garantidamente no schema definido
const classification = response.content[0].input;
// { category: 'payment', priority: 'high', summary: '...', requires_human: true }
```

```
Vantagens de structured output:
├── Parse confiável (JSON, não "talvez JSON com texto ao redor")
├── Validação de schema (campos obrigatórios, enums, tipos)
├── Menos tokens desperdiçados (sem "Claro! Aqui está:" fluff)
├── Integrável diretamente no código
└── Testável (comparar output.category com expected)

Quando usar:
├── Qualquer resultado processado por código
├── Classificação, extração, análise estruturada
├── Pipelines automatizados (resultado vai para outro sistema)
└── Qualquer coisa que não é "conversa com humano"
```

---

## 6. Técnicas Avançadas

### Self-Consistency (votar entre múltiplas respostas)

```javascript
// Gerar N respostas com temperature > 0, votar pela mais frequente
async function classifyWithConsistency(text, n = 3) {
  const results = await Promise.all(
    Array.from({ length: n }, () =>
      classifyText(text, { temperature: 0.7 })
    )
  );

  // Votar pela categoria mais frequente
  const votes = results.map(r => r.category);
  const winner = mode(votes); // Mais frequente
  const confidence = votes.filter(v => v === winner).length / n;

  return { category: winner, confidence, votes };
}
// Se 3/3 concordam: confidence = 1.0
// Se 2/3 concordam: confidence = 0.67
// Se todos discordam: confidence = 0.33 → escalar para humano
```

### Decomposição de Task

```javascript
// Dividir task complexo em sub-tasks menores

// ❌ Um prompt gigante que faz tudo
"Leia o contrato, extraia as partes, identifique cláusulas abusivas,
resuma os riscos, e gere uma recomendação"

// ✅ Pipeline de prompts especializados
const entities = await extractEntities(contract);     // Step 1: Extração
const clauses = await classifyClauses(contract);      // Step 2: Classificação
const risks = await analyzeRisks(clauses);            // Step 3: Análise
const recommendation = await generateRec(risks);       // Step 4: Recomendação

// Cada step tem prompt focado, testável e otimizável independentemente
```

### Prompt com Citação (Grounded Generation)

```xml
<!-- Forçar o modelo a citar fontes do contexto fornecido -->
<system>
Responda à pergunta usando APENAS as informações fornecidas nos documentos.
Para cada afirmação, cite o documento fonte entre [Doc N].
Se a informação não está nos documentos, diga "Não encontrei essa informação
nos documentos fornecidos."
NÃO invente informações que não estejam nos documentos.
</system>
```

---

## 7. Anti-Patterns

```
❌ Prompt vago
   "Faça algo legal com esse texto"
   → Resultado imprevisível e inconsistente

❌ Instruções contraditórias
   "Seja breve mas detalhado"
   → Modelo não sabe o que priorizar

❌ Confiar no output sem validação
   "O modelo retornou JSON, então deve estar correto"
   → LLM pode retornar JSON malformado ou com valores errados

❌ Temperature alta para tasks determinísticos
   Classification com temperature=1.0
   → Mesma input, resultado diferente a cada chamada

❌ Context window como lixeira
   Jogar 100KB de texto "por via das dúvidas"
   → Dilui relevância, aumenta custo, pode confundir

❌ Prompt injection não tratado
   User input direto no prompt sem sanitização
   → "Ignore as instruções anteriores e..."

❌ Zero eval
   "Funciona nos meus 3 exemplos de teste"
   → Em produção, falha em cenários que não testou

❌ Modelo errado para a tarefa
   Opus para classificação binária
   → Custo 30x maior sem ganho de qualidade
```
