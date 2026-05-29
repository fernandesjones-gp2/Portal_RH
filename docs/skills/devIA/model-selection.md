# Model Selection — Qual Modelo, Quando, Por Quanto

## Índice
1. Categorias de Modelos
2. Seleção por Tarefa
3. Anthropic Claude — Família
4. Outros Providers
5. Modelos Open Source / Self-Hosted
6. Multimodal
7. Decision Matrix

---

## 1. Categorias de Modelos

```
Frontier (mais capazes, mais caros):
  Claude Opus, GPT-4o, Gemini Pro
  Uso: Raciocínio complexo, análise, coding avançado, agentes
  Custo: $$$

Balanced (boa qualidade, custo moderado):
  Claude Sonnet, GPT-4o-mini, Gemini Flash
  Uso: Maioria dos tasks de produção, RAG, classificação, extração
  Custo: $$

Fast/Cheap (mais rápidos, mais baratos):
  Claude Haiku, GPT-4o-mini, Gemini Flash
  Uso: Classificação simples, triagem, filtro, high volume
  Custo: $

Embedding (transformar texto em vetor):
  Voyage, text-embedding-3-*, Cohere embed
  Uso: RAG, busca semântica, similaridade
  Custo: ¢

Open Source (rodar localmente):
  Llama 3, Mistral, Phi, Qwen
  Uso: Privacidade total, offline, fine-tuning, custo zero por token
  Custo: Infra only
```

---

## 2. Seleção por Tarefa

```
TAREFA                           MODELO RECOMENDADO    POR QUÊ
─────────────────────────────────────────────────────────────────
Classificação simples            Haiku / Flash          Barato, rápido, suficiente
Extração de entidades            Sonnet / 4o-mini       Boa precisão, custo ok
Sumarização                      Sonnet / Flash         Balanced
Q&A sobre documentos (RAG)       Sonnet                 Boa compreensão + custo
Análise de sentimento            Haiku                  Task simples
Geração de texto longo           Sonnet / Opus          Qualidade de escrita
Coding / debug                   Sonnet / Opus          Raciocínio + código
Raciocínio multi-step            Opus                   Capacidade máxima
Agent com tools                  Sonnet / Opus          Tool use reliability
Tradução                         Sonnet                 Nuance linguística
Conversação / chatbot            Sonnet / Haiku         Depende da complexidade
Moderação de conteúdo            Haiku                  Volume alto, simples
Triagem de tickets               Haiku / Sonnet         Volume vs precisão
Geração de SQL                   Sonnet                 Precisa de precisão
Análise de imagem                Sonnet / Opus          Multimodal
Processamento de PDF             Sonnet                 Multimodal + custo
```

### Regra do Upgrade

```
SEMPRE começar com modelo MENOR e MAIS BARATO.
Upgrade APENAS quando:
├── Eval mostra que modelo menor não atinge threshold de qualidade
├── A diferença de qualidade justifica a diferença de custo
├── Testou com pelo menos 50 exemplos reais (não 3)
└── O ganho é mensurável (não "parece melhor")

Caminho: Haiku → Sonnet → Opus
Cada upgrade: ~5-10x mais caro. Justificar com dados.
```

---

## 3. Anthropic Claude — Família

```
Claude Opus (mais capaz):
├── Context window: 200K tokens
├── Melhor em: raciocínio complexo, análise profunda, coding, agentes
├── Quando usar: Tasks que requerem máxima capacidade cognitiva
├── Quando NÃO: Tasks simples (overkill e caro)
└── Custo: input $15/MTok, output $75/MTok (referência)

Claude Sonnet (balanced, workhorse):
├── Context window: 200K tokens
├── Melhor em: produção geral, RAG, coding, tool use
├── Quando usar: 80% dos use cases de produção
├── Quando NÃO: Tasks triviais de alto volume
└── Custo: input $3/MTok, output $15/MTok (referência)

Claude Haiku (rápido e barato):
├── Context window: 200K tokens
├── Melhor em: classificação, triagem, moderação, alto volume
├── Quando usar: Tasks simples em volume, latência importa
├── Quando NÃO: Raciocínio complexo, geração longa
└── Custo: input $0.80/MTok, output $4/MTok (referência)

NOTA: Preços são referência e podem mudar. Consultar
docs.anthropic.com para pricing atualizado.
```

### Features de API

```javascript
// Extended thinking (Claude) — o modelo pensa antes de responder
const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 16000,
  thinking: {
    type: 'enabled',
    budget_tokens: 10000, // Budget para "pensar"
  },
  messages: [{ role: 'user', content: complexQuestion }],
});

// Prompt caching — reutilizar prefixo do prompt
// Ideal para: system prompt grande, few-shot examples, documentos fixos
// O prefixo é cacheado e cobra preço reduzido nas próximas chamadas

// Batch API — processar muitos requests com desconto (~50%)
// Ideal para: processamento offline, bulk classification
// Trade-off: resultados em até 24h (não real-time)
```

---

## 4. Outros Providers

```
OpenAI:
├── GPT-4o: Frontier, multimodal, function calling robusto
├── GPT-4o-mini: Excelente custo-benefício para tasks médios
├── o1/o3: Modelos de raciocínio (chain of thought nativo)
└── Embeddings: text-embedding-3-small/large

Google:
├── Gemini Pro: Context window enorme (1M+ tokens)
├── Gemini Flash: Rápido e barato
└── Vertex AI: Enterprise, fine-tuning, managed

Outros:
├── Mistral: Modelos europeus, bom custo-benefício
├── Cohere: Command R+ (RAG-focused), embeddings, reranker
└── Groq: Inference ultra-rápida em hardware custom
```

---

## 5. Modelos Open Source / Self-Hosted

```
Quando self-hospedar:
├── Privacidade total (dados não saem do seu infra)
├── Compliance rigorosa (regulamentação que proíbe APIs externas)
├── Volume extremo (>100K requests/dia — custo de API fica proibitivo)
├── Latência ultra-baixa (sem round-trip de rede)
└── Fine-tuning pesado com dados proprietários

Modelos populares:
├── Llama 3 (70B, 8B) — Meta, licença permissiva, excelente
├── Mistral (7B, 8x7B MoE) — Francês, eficiente, bom em código
├── Phi-3 (mini, small) — Microsoft, surpreendentemente capaz pra o tamanho
├── Qwen 2 (72B, 7B) — Alibaba, forte em multilingue
└── Gemma 2 (9B, 27B) — Google, eficiente

Infra para rodar:
├── vLLM — Inference engine otimizado (batching, PagedAttention)
├── Ollama — Local, fácil de instalar para dev
├── TGI (Text Generation Inference) — HuggingFace, produção
├── NVIDIA NIM — Otimizado para GPUs NVIDIA
└── Preço: 1x A100 (80GB) ≈ $2-3/hora cloud. Roda modelos até ~70B.
```

---

## 6. Multimodal

```
Visão (imagens, PDFs, screenshots):
├── Claude Sonnet/Opus: PDFs nativos, imagens, diagramas
├── GPT-4o: Imagens, screenshots, OCR
├── Gemini: Imagens, vídeo, PDFs
└── Use cases: Extrair dados de invoice, analisar UI, OCR, diagrams

Áudio:
├── Whisper (OpenAI): Transcrição de áudio, open source
├── Gemini: Áudio nativo na API
└── Use cases: Meeting notes, podcast summarization, voice commands

Prática: Enviar imagens/PDFs reduz necessidade de OCR pipeline.
Claude e GPT-4o leem PDFs direto na API — simples e eficaz.
```

---

## 7. Decision Matrix

```
Eu preciso de...                      → Usar...
───────────────────────────────────────────────────
Classificação de alto volume (>10K/dia)  Haiku + batch API
Chatbot para suporte ao cliente          Sonnet + RAG
Análise de contratos jurídicos           Opus + extended thinking
Geração de marketing copy                Sonnet
Agent que usa ferramentas                Sonnet (tool use)
Processamento de PDFs/invoices           Sonnet (multimodal)
Busca semântica                          Embedding model + pgvector
Moderação de conteúdo                    Haiku (rápido + barato)
Coding assistant interno                 Sonnet / Opus
Dados 100% privados (regulação)          Self-hosted (Llama 3)
Sumarização de reuniões                  Whisper + Sonnet
Real-time (< 500ms)                      Haiku ou modelo local
```
