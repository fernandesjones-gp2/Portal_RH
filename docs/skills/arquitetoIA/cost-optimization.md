# Cost Optimization — Tokens, Caching, Batch, Fine-Tuning

## Índice
1. Token Economics
2. Prompt Caching
3. Batch API
4. Response Caching (Semantic)
5. Fine-Tuning vs Prompting vs RAG
6. Estimativa de Custo
7. Checklist de Otimização de Custo

---

## 1. Token Economics

```
O que é um token?
├── ~4 caracteres em inglês, ~3 caracteres em português
├── "Olá, como vai?" ≈ 6 tokens
├── 1 página de texto ≈ 300-500 tokens
├── 1 PDF de 10 páginas ≈ 3.000-5.000 tokens
└── Context window de 200K ≈ ~500 páginas

Custo é calculado por: Input tokens + Output tokens
Input geralmente mais barato que output (2-5x mais barato).

Onde os tokens vão:
├── System prompt: FIXO a cada chamada (pode ser grande!)
├── Few-shot examples: FIXO a cada chamada
├── User input: VARIÁVEL
├── Context (RAG): VARIÁVEL (chunks retrieved)
├── Conversation history: CRESCE a cada turno
└── Output: VARIÁVEL
```

```javascript
// Estimar tokens antes de enviar
function estimateTokens(text) {
  // Regra rápida: ~1 token por 3.5 chars em português
  return Math.ceil(text.length / 3.5);
}

// Monitorar custo real
function logCost(response, model) {
  const inputTokens = response.usage.input_tokens;
  const outputTokens = response.usage.output_tokens;

  // Preços de referência (verificar pricing atual!)
  const prices = {
    'claude-sonnet-4-20250514': { input: 3, output: 15 },  // $/MTok
    'claude-haiku-4-5-20251001': { input: 0.8, output: 4 },
  };

  const p = prices[model] || prices['claude-sonnet-4-20250514'];
  const cost = (inputTokens * p.input + outputTokens * p.output) / 1_000_000;

  logger.info('LLM cost', {
    model,
    inputTokens,
    outputTokens,
    cost: `$${cost.toFixed(6)}`,
    costPer1K: `$${(cost * 1000).toFixed(4)} per 1K calls`,
  });

  return cost;
}
```

---

## 2. Prompt Caching

```
Prompt caching: API armazena o PREFIXO do prompt.
Se múltiplas chamadas compartilham o mesmo prefixo (system prompt +
few-shot examples), o prefixo é lido do cache (90% mais barato no input).

Ideal quando:
├── System prompt grande (> 1000 tokens)
├── Few-shot examples fixos
├── Documento fixo no contexto (analisar mesmo doc várias vezes)
├── Conversação longa (histórico cresce, mas prefixo é cacheable)
└── Múltiplas perguntas sobre o mesmo contexto

Economia:
├── Sem cache: System (2000 tokens) × 1000 chamadas = 2M tokens input
├── Com cache: System (2000 tokens cache hit) × 1000 chamadas
│   = 2M tokens a ~10% do preço
├── Economia: ~90% no custo do system prompt
└── Requisito: prefixo idêntico entre chamadas
```

```javascript
// Anthropic: prompt caching com cache_control
const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 1024,
  system: [
    {
      type: 'text',
      text: longSystemPrompt, // 2000+ tokens
      cache_control: { type: 'ephemeral' }, // Marcar para cache
    },
  ],
  messages: [{ role: 'user', content: userQuestion }],
});
// Primeira chamada: cache write (preço normal)
// Chamadas seguintes: cache hit (90% desconto no input)
```

---

## 3. Batch API

```
Batch API: enviar MUITOS requests de uma vez, resultado em até 24h.
Desconto: ~50% do preço normal.

Ideal quando:
├── Processamento offline (classificar 10K tickets de ontem)
├── Bulk analysis (analisar 500 reviews de produto)
├── Data labeling (anotar dataset para fine-tuning)
├── Content generation em lote (gerar 100 descriptions)
└── Qualquer coisa que NÃO é real-time

NÃO ideal quando:
├── User está esperando a resposta (real-time)
├── Resultado influencia próximo request (chain/agent)
└── Precisa em menos de 1 hora
```

```javascript
// Anthropic Batch API
const batch = await anthropic.messages.batches.create({
  requests: tickets.map((ticket, i) => ({
    custom_id: `ticket-${ticket.id}`,
    params: {
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{ role: 'user', content: classifyPrompt(ticket.text) }],
    },
  })),
});

// Verificar status (polling)
let result;
do {
  await sleep(60000); // 1 minuto
  result = await anthropic.messages.batches.retrieve(batch.id);
} while (result.processing_status !== 'ended');

// Processar resultados
for await (const item of anthropic.messages.batches.results(batch.id)) {
  const ticketId = item.custom_id;
  const classification = item.result.message.content[0];
  await saveClassification(ticketId, classification);
}
```

---

## 4. Response Caching (Semantic)

```javascript
// Cache de respostas: se a mesma pergunta (ou similar) já foi respondida,
// retornar resposta cached ao invés de chamar LLM novamente.

// Nível 1: Exact match (simples, grátis)
const responseCache = new Map();

async function cachedLLMCall(prompt) {
  const cacheKey = crypto.createHash('sha256').update(prompt).digest('hex');

  const cached = responseCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 3600000) { // 1h TTL
    return cached.response;
  }

  const response = await llm.call(prompt);
  responseCache.set(cacheKey, { response, timestamp: Date.now() });
  return response;
}

// Nível 2: Semantic cache (perguntas similares mas não idênticas)
// "Como solicito reembolso?" ≈ "Quero pedir meu dinheiro de volta"
// Embeddar a pergunta, buscar em cache por similaridade > 0.95

async function semanticCachedCall(question) {
  const embedding = await embed(question);

  // Buscar resposta cached com similaridade alta
  const cached = await vectorCache.search(embedding, {
    threshold: 0.95, // Muito similar
    limit: 1,
  });

  if (cached.length > 0) {
    logger.info('Semantic cache hit', { similarity: cached[0].similarity });
    return cached[0].response;
  }

  // Cache miss: chamar LLM
  const response = await llm.call(question);

  // Salvar no cache semântico
  await vectorCache.upsert({
    question,
    embedding,
    response,
    timestamp: Date.now(),
  });

  return response;
}
```

---

## 5. Fine-Tuning vs Prompting vs RAG

```
Prompting (zero/few-shot):
  Custo inicial: $0
  Tempo de setup: Minutos-horas
  Flexibilidade: Máxima (mudar prompt a qualquer momento)
  Qualidade: Boa para maioria dos tasks
  Quando: SEMPRE começar aqui

RAG:
  Custo inicial: $-$$ (embedding + vector DB)
  Tempo de setup: Dias
  Flexibilidade: Alta (adicionar/remover docs a qualquer momento)
  Qualidade: Excelente para Q&A sobre dados próprios
  Quando: Modelo precisa de dados que não estão no treinamento

Fine-tuning:
  Custo inicial: $$-$$$ (treinamento + dataset)
  Tempo de setup: Semanas
  Flexibilidade: Baixa (retreinar para mudar comportamento)
  Qualidade: Potencialmente melhor em domínio específico
  Quando: APENAS se prompt + RAG não atingem qualidade necessária
         E tem 1000+ exemplos de alta qualidade

Ordem de decisão:
1. Prompting resolve? → Usar prompting ✅
2. Precisa de dados próprios? → RAG ✅
3. RAG + prompting não atinge qualidade? → Fine-tuning
4. Volume muito alto e custo proibitivo? → Fine-tune modelo menor

Fine-tuning NÃO é para:
├── Adicionar conhecimento (use RAG — é atualizável)
├── Mudar formato de output (use schema/tool use)
├── Melhorar "um pouquinho" (não vale o custo/complexidade)
└── Compensar prompt ruim (melhore o prompt primeiro)

Fine-tuning É para:
├── Estilo/tom muito específico consistentemente
├── Domínio técnico onde modelo geral falha
├── Reduzir latência (modelo menor fine-tuned ≈ modelo grande com prompt)
├── Reduzir custo em volume (modelo menor + sem few-shot)
└── Classificação com 50+ categorias muito específicas
```

---

## 6. Estimativa de Custo

```
Template de estimativa:

Cenário: Chatbot de suporte com RAG
├── Volume: 5.000 conversas/dia
├── Média: 5 turns por conversa
├── System prompt: 1.500 tokens
├── RAG context: 2.000 tokens por turn
├── User input: ~100 tokens por turn
├── Output: ~300 tokens por turn
│
├── Tokens por turn:
│   Input: 1.500 (system) + 2.000 (RAG) + 100 (user) + history = ~4.000
│   Output: ~300
│
├── Tokens por conversa (5 turns):
│   Input: 4.000 × 5 = 20.000 (com prompt cache: ~8.000 full + 12.000 cached)
│   Output: 300 × 5 = 1.500
│
├── Tokens por dia (5.000 conversas):
│   Input: ~100M tokens (com cache: ~40M full + 60M cached)
│   Output: ~7.5M tokens
│
├── Custo diário (Claude Sonnet, referência):
│   Input: 40M × $3/MTok + 60M × $0.30/MTok = $120 + $18 = $138
│   Output: 7.5M × $15/MTok = $112.50
│   Total: ~$250/dia
│
├── Custo mensal: ~$7.500
│
└── Otimizações possíveis:
    ├── Haiku para triagem (−60% custo da classificação)
    ├── Semantic cache (−20% se perguntas repetidas)
    ├── Batch para analytics offline (−50%)
    └── Reduzir RAG context (chunks menores, menos chunks)
```

---

## 7. Checklist de Otimização de Custo

```
Quick wins:
☐ Modelo menor para tasks simples (Haiku > Sonnet para classificação)
☐ Prompt caching habilitado (system prompt grande)
☐ Structured output / tool use (menos tokens de fluff)
☐ Max_tokens adequado (não 4096 se espera 200)
☐ Stop sequences configuradas (parar cedo quando possível)
☐ Response caching para perguntas frequentes

Médio esforço:
☐ Batch API para processamento offline (50% desconto)
☐ Router: Haiku classifica, Sonnet processa (não Sonnet para tudo)
☐ RAG: chunks menores e mais relevantes (menos tokens de contexto)
☐ Conversation pruning (não enviar todo histórico, sumarizar)
☐ Semantic cache para perguntas similares
☐ Monitoramento de custo por endpoint/feature

Alto esforço:
☐ Fine-tune de modelo menor para substituir modelo grande + few-shot
☐ Self-hosted para volume extremo
☐ Hybrid: modelo local para triagem, API para tasks complexos
☐ Async processing (queue + batch) ao invés de real-time

Monitoramento:
☐ Dashboard de custo por dia/semana
☐ Alerta se custo diário exceder budget
☐ Custo por feature (chatbot, classificação, RAG, etc.)
☐ Token usage por chamada (detectar prompts inflados)
☐ Cache hit rate (se baixo, investigar por quê)
```
