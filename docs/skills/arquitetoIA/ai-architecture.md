# AI Architecture — Patterns, Agents, Tool Use, Orchestration

## Índice
1. Patterns de Integração com LLM
2. Tool Use / Function Calling
3. MCP (Model Context Protocol)
4. Agents — Quando e Como
5. Orchestration Patterns
6. Streaming e UX
7. Error Handling e Fallbacks

---

## 1. Patterns de Integração com LLM

### Single Call (Prompt → Response)

```javascript
// O mais simples. Suficiente para 60% dos use cases.
async function classifyTicket(text) {
  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 200,
    tools: [classifyTool],
    tool_choice: { type: 'tool', name: 'classify' },
    messages: [{ role: 'user', content: `Classifique: "${text}"` }],
  });
  return response.content[0].input;
}

// Quando usar: classificação, extração, geração simples, tradução
// Latência: 0.5-3s | Custo: $ | Complexidade: Baixa
```

### Chain (Prompt1 → LLM → Prompt2 → LLM)

```javascript
// Decompor task complexo em steps. Cada step usa resultado do anterior.
async function analyzeContract(contractText) {
  // Step 1: Extrair cláusulas
  const clauses = await extractClauses(contractText);

  // Step 2: Classificar risco de cada cláusula
  const risks = await Promise.all(
    clauses.map(clause => classifyRisk(clause))
  );

  // Step 3: Gerar recomendação baseada nos riscos
  const recommendation = await generateRecommendation(risks);

  return { clauses, risks, recommendation };
}

// Quando usar: análise multi-etapa, processamento de documentos
// Latência: 3-15s | Custo: $$ | Complexidade: Média
```

### Router (classificar → direcionar para prompt especializado)

```javascript
// Um modelo barato classifica, depois direciona para o prompt certo.
async function handleQuery(query) {
  // Step 1: Haiku classifica a intenção (barato, rápido)
  const intent = await classifyIntent(query); // 'billing', 'technical', 'general'

  // Step 2: Prompt especializado por intenção
  switch (intent.category) {
    case 'billing':
      return handleBilling(query, billingSystemPrompt);
    case 'technical':
      return handleTechnical(query, technicalSystemPrompt, { rag: true });
    case 'general':
      return handleGeneral(query, generalSystemPrompt);
    default:
      return handleFallback(query);
  }
}

// Quando usar: chatbot com múltiplos domínios, support
// Vantagem: cada domínio tem prompt otimizado + context relevante
```

### Map-Reduce (processar partes, depois agregar)

```javascript
// Para documentos que excedem o context window, ou para paralelizar.
async function summarizeLargeDocument(chunks) {
  // Map: sumarizar cada chunk em paralelo
  const summaries = await Promise.all(
    chunks.map(chunk => summarizeChunk(chunk))
  );

  // Reduce: sumarizar os sumários
  const finalSummary = await summarizeAll(summaries.join('\n\n'));

  return finalSummary;
}

// Quando usar: documentos > context window, processamento em lote
```

---

## 2. Tool Use / Function Calling

```javascript
// O LLM decide QUANDO e QUAL ferramenta usar baseado no contexto.

const tools = [
  {
    name: 'search_products',
    description: 'Busca produtos no catálogo por nome, categoria ou preço',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Termo de busca' },
        category: { type: 'string', enum: ['electronics', 'clothing', 'home'] },
        max_price: { type: 'number', description: 'Preço máximo em centavos' },
      },
      required: ['query'],
    },
  },
  {
    name: 'check_order_status',
    description: 'Verifica o status de um pedido pelo ID',
    input_schema: {
      type: 'object',
      properties: {
        order_id: { type: 'string', description: 'ID do pedido (ex: ORD-123)' },
      },
      required: ['order_id'],
    },
  },
];

// Loop de tool use
async function chat(userMessage, conversationHistory) {
  const messages = [...conversationHistory, { role: 'user', content: userMessage }];

  let response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    tools,
    messages,
  });

  // Loop até não ter mais tool calls
  while (response.stop_reason === 'tool_use') {
    const toolUse = response.content.find(c => c.type === 'tool_use');

    // Executar a ferramenta
    const toolResult = await executeTool(toolUse.name, toolUse.input);

    // Enviar resultado de volta
    messages.push({ role: 'assistant', content: response.content });
    messages.push({
      role: 'user',
      content: [{ type: 'tool_result', tool_use_id: toolUse.id, content: JSON.stringify(toolResult) }],
    });

    response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      tools,
      messages,
    });
  }

  return response.content[0].text;
}
```

```
Boas práticas de tool use:
├── Descriptions claras: o modelo decide baseado na description
├── Schema estrito: required fields, enums quando possível
├── Validar input da tool: o modelo pode enviar input inválido
├── Timeout na execução: tool pode travar
├── Limit de loops: máximo 5-10 tool calls por conversa
├── Log de tool calls: para debug e auditoria
└── Ferramentas read-only quando possível (minimizar side effects)
```

---

## 3. MCP (Model Context Protocol)

```
MCP = protocolo padrão para LLMs se conectarem a ferramentas e dados.
Em vez de cada app implementar tool use custom, MCP padroniza a interface.

Client (LLM app) ←→ MCP Server (ferramenta/dados)

Vantagens:
├── Padrão aberto: qualquer LLM, qualquer ferramenta
├── Discovery: LLM descobre quais ferramentas estão disponíveis
├── Composability: combinar múltiplos MCP servers
└── Segurança: controle de acesso por server

Arquitetura:
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│  Aplicação  │────→│  MCP Client  │────→│  MCP Server  │
│  (Chat, IDE │     │  (no LLM app)│     │ (Google Drive,│
│   Agent)    │     │              │     │  Slack, DB,   │
│             │     │              │────→│  GitHub...)   │
└─────────────┘     └──────────────┘     └──────────────┘
```

---

## 4. Agents — Quando e Como

```
Agent = LLM que opera em LOOP: percebe, raciocina, age, observa resultado.
Diferente de chain (sequência fixa), agent DECIDE o próximo passo.

Quando usar agents:
├── Tarefa aberta que requer planejamento (pesquisa, análise exploratória)
├── Múltiplas tools que precisam ser combinadas dinamicamente
├── Quando a sequência de passos depende dos resultados intermediários
└── Coding: escrever, testar, corrigir, iterar

Quando NÃO usar agents:
├── Tarefa com sequência fixa (chain é suficiente, mais confiável)
├── Latência é crítica (agents são lentos — múltiplas chamadas)
├── Budget apertado (muitas chamadas = muitos tokens)
└── Quando determinismo é necessário (agents são imprevisíveis)

Riscos de agents:
├── Loop infinito (agent fica preso tentando sem progresso)
├── Custo descontrolado (cada loop = $ de tokens)
├── Ações irreversíveis (agent executa DELETE em produção)
├── Hallucination propagada (erro inicial amplifica nos steps)
└── Difícil de debugar (caminho diferente a cada execução)

Mitigações:
├── Max iterations (parar após N loops)
├── Budget de tokens (parar se exceder)
├── Approval gate para ações destrutivas
├── Logging detalhado de cada step
├── Sandbox para execução de código
└── Human-in-the-loop para decisões críticas
```

---

## 5. Orchestration Patterns

### Parallel Fan-Out

```javascript
// Processar múltiplos aspectos em paralelo, depois agregar
async function analyzeProduct(product) {
  const [sentiment, features, competitors] = await Promise.all([
    analyzeSentiment(product.reviews),        // LLM call 1
    extractFeatures(product.description),      // LLM call 2
    findCompetitors(product.name),             // LLM call 3
  ]);

  return { sentiment, features, competitors };
}
// 3 calls em paralelo = tempo do mais lento, não soma dos 3
```

### Evaluate-Route

```javascript
// LLM avalia a qualidade e decide se precisa de retry/escalação
async function generateWithQA(prompt) {
  const draft = await generate(prompt, { model: 'claude-sonnet-4-20250514' });

  // QA: outro modelo (ou mesmo) avalia a qualidade
  const qa = await evaluate(draft, {
    criteria: ['accuracy', 'completeness', 'tone'],
  });

  if (qa.score < 0.7) {
    // Retry com feedback
    return generate(prompt + `\n\nFeedback da avaliação: ${qa.feedback}`, {
      model: 'claude-sonnet-4-20250514', // Ou upgrade para Opus
    });
  }

  return draft;
}
```

---

## 6. Streaming e UX

```javascript
// Streaming: mostrar tokens conforme são gerados (não esperar tudo)
// ESSENCIAL para UX — user vê resposta sendo "digitada"

const stream = await anthropic.messages.stream({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 1024,
  messages: [{ role: 'user', content: question }],
});

// Server-Sent Events para o frontend
app.get('/api/chat', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const stream = await anthropic.messages.stream({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [{ role: 'user', content: req.query.q }],
  });

  for await (const event of stream) {
    if (event.type === 'content_block_delta') {
      res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`);
    }
  }
  res.write('data: [DONE]\n\n');
  res.end();
});
```

---

## 7. Error Handling e Fallbacks

```javascript
// LLM APIs FALHAM. Rate limits, timeouts, overload. SEMPRE ter fallback.

async function llmCall(prompt, options = {}) {
  const { retries = 3, fallbackModel = 'claude-haiku-4-5-20251001' } = options;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await anthropic.messages.create({
        model: options.model || 'claude-sonnet-4-20250514',
        max_tokens: options.maxTokens || 1024,
        messages: [{ role: 'user', content: prompt }],
      });
      return response;
    } catch (error) {
      if (error.status === 429) {
        // Rate limited: esperar com exponential backoff
        await sleep(Math.pow(2, attempt) * 1000);
        continue;
      }
      if (error.status === 529 || error.status === 500) {
        // Overloaded ou erro interno: retry
        await sleep(attempt * 2000);
        continue;
      }
      throw error; // Erro inesperado
    }
  }

  // Fallback: modelo menor / provider diferente
  logger.warn('Primary model failed, using fallback', { model: fallbackModel });
  return anthropic.messages.create({
    model: fallbackModel,
    max_tokens: options.maxTokens || 1024,
    messages: [{ role: 'user', content: prompt }],
  });
}

// Fallback de graceful degradation
// Se LLM está fora do ar: retornar resposta template/cached
// "Desculpe, estou com dificuldades no momento. Um agente humano
//  vai entrar em contato em até 2 horas."
```
