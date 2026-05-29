# RAG Pipelines — Retrieval-Augmented Generation

## Índice
1. O Que É RAG e Quando Usar
2. Arquitetura de RAG
3. Chunking — Como Dividir Documentos
4. Embeddings — Vetorização Semântica
5. Vector Databases
6. Retrieval e Reranking
7. Evaluation de RAG
8. Patterns Avançados

---

## 1. O Que É RAG e Quando Usar

```
RAG = Buscar informação relevante → Injetar no prompt → LLM gera resposta

Sem RAG: "O que diz a política de reembolso?" → LLM inventa (hallucination)
Com RAG: Busca docs relevantes → "Baseado nestes docs, responda:" → Resposta precisa

Quando usar RAG:
├── Q&A sobre documentação própria (knowledge base, docs, políticas)
├── Chatbot sobre dados internos (manuais, processos, FAQs)
├── Busca semântica ("me explica aquela regra sobre...")
├── Análise de documentos (contratos, relatórios, artigos)
└── Qualquer caso onde o LLM precisa de SEUS dados para responder

Quando NÃO usar RAG:
├── Dados estruturados → SQL/API direta é melhor
├── Dados pequenos (< 10 páginas) → Coloca tudo no prompt
├── Tasks que não precisam de dados externos (classificação, geração criativa)
├── Dados que mudam a cada segundo → RAG não é real-time
└── Pergunta genérica de conhecimento → Modelo já sabe
```

---

## 2. Arquitetura de RAG

```
Ingestion (offline — preparar dados):
┌─────────────┐    ┌──────────┐    ┌──────────────┐    ┌──────────┐
│ Documentos  │───→│ Chunking │───→│  Embedding   │───→│ Vector   │
│ (PDF, MD,   │    │ (dividir │    │ (text→vetor) │    │ Database │
│  HTML, TXT) │    │ em partes│    │              │    │          │
└─────────────┘    └──────────┘    └──────────────┘    └──────────┘

Query (online — responder perguntas):
┌─────────┐    ┌──────────────┐    ┌──────────┐    ┌─────────────┐    ┌──────────┐
│ Pergunta│───→│  Embedding   │───→│ Vector   │───→│  Reranking  │───→│   LLM    │
│ do user │    │ (query→vetor)│    │ Search   │    │ (top K→top N│    │ (gerar   │
│         │    │              │    │ (top K)  │    │  relevantes)│    │ resposta)│
└─────────┘    └──────────────┘    └──────────┘    └─────────────┘    └──────────┘
```

---

## 3. Chunking — Como Dividir Documentos

```
Chunk = pedaço de documento que será indexado separadamente.
Chunks muito grandes: diluem relevância, gastam tokens.
Chunks muito pequenos: perdem contexto, respostas fragmentadas.

Estratégias (da mais simples à mais sofisticada):

1. Fixed size (300-500 tokens) com overlap (50-100 tokens)
   Prós: Simples, previsível
   Contras: Pode cortar no meio de frases/conceitos
   Uso: Default para começar

2. Sentence/paragraph splitting
   Dividir por parágrafos ou frases completas
   Prós: Respeita limites naturais do texto
   Contras: Tamanho variável, parágrafos gigantes
   Uso: Documentação, artigos

3. Semantic chunking
   Dividir quando o tema MUDA (usando embeddings para detectar transição)
   Prós: Chunks coerentes semanticamente
   Contras: Mais complexo, requer embedding a cada split test
   Uso: Documentos longos com múltiplos temas

4. Document-aware chunking
   Usar estrutura do documento (headers, sections) para dividir
   Prós: Contexto preservado, alinhado com estrutura
   Contras: Requer parsing de formato (HTML, MD, PDF)
   Uso: Documentação técnica com headers claros

5. Parent-child (hierarchical)
   Chunks pequenos para busca, chunks grandes para contexto
   Busca retorna chunk pequeno → injeta o chunk pai (maior) no prompt
   Prós: Melhor precisão de busca + contexto rico
   Contras: Mais complexo, mais storage
   Uso: Quando precisão de retrieval é crítica
```

```javascript
// Exemplo: chunking por parágrafos com overlap
function chunkByParagraphs(text, { maxTokens = 500, overlap = 100 } = {}) {
  const paragraphs = text.split(/\n\n+/);
  const chunks = [];
  let current = '';
  let currentTokens = 0;

  for (const para of paragraphs) {
    const paraTokens = estimateTokens(para);

    if (currentTokens + paraTokens > maxTokens && current) {
      chunks.push(current.trim());
      // Overlap: manter último parágrafo
      const lastPara = current.split(/\n\n+/).pop();
      current = lastPara + '\n\n' + para;
      currentTokens = estimateTokens(current);
    } else {
      current += (current ? '\n\n' : '') + para;
      currentTokens += paraTokens;
    }
  }
  if (current) chunks.push(current.trim());

  return chunks;
}
```

### Metadata — Essencial para Retrieval

```javascript
// SEMPRE adicionar metadata aos chunks
const chunk = {
  text: chunkText,
  metadata: {
    source: 'politica-reembolso-v3.pdf',
    section: 'Prazos e Condições',
    page: 5,
    lastUpdated: '2025-01-15',
    category: 'legal',
    // Para filtering: buscar apenas em docs de "legal"
  },
  embedding: null, // Preenchido depois
};
```

---

## 4. Embeddings — Vetorização Semântica

```
Embedding: transforma texto em vetor de números (1536 dimensões tipicamente).
Textos semanticamente SIMILARES terão vetores PRÓXIMOS no espaço vetorial.

"Como solicitar reembolso?" ≈ "Quero meu dinheiro de volta" (vetores próximos)
"Como solicitar reembolso?" ≠ "Receita de bolo" (vetores distantes)
```

| Modelo | Dimensões | Custo | Qualidade | Velocidade |
|--------|-----------|-------|-----------|-----------|
| Voyage 3 | 1024 | $$$ | Excelente | Rápida |
| OpenAI text-embedding-3-large | 3072 | $$ | Muito boa | Rápida |
| OpenAI text-embedding-3-small | 1536 | $ | Boa | Rápida |
| Cohere embed-v3 | 1024 | $$ | Muito boa | Rápida |
| all-MiniLM-L6-v2 (local) | 384 | Grátis | Ok | Rápida |

```
Regras de embedding:
├── Usar MESMO modelo para chunks e queries
├── Normalizar vetores (cosine similarity)
├── Testar com dados REAIS (não apenas benchmarks)
├── Considerar modelos multilíngues se dados em PT-BR
└── Batch embeddings no ingestion (mais barato e rápido)
```

---

## 5. Vector Databases

| DB | Tipo | Managed? | Quando usar |
|----|------|---------|-------------|
| **pgvector** | Extension PostgreSQL | N/A (seu PG) | Já usa PG, < 1M vetores |
| **Pinecone** | Managed | Sim | Escala grande, zero ops |
| **Weaviate** | Self-hosted/Managed | Ambos | Hybrid search (BM25+vector) |
| **ChromaDB** | In-process | Não | Protótipos, dev |
| **Qdrant** | Self-hosted/Managed | Ambos | Performance, filtering |

```sql
-- pgvector: o mais pragmático se já usa PostgreSQL
CREATE EXTENSION vector;

CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  embedding vector(1536), -- Dimensão do modelo de embedding
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índice para busca aproximada (HNSW — mais rápido)
CREATE INDEX ON documents USING hnsw (embedding vector_cosine_ops);

-- Busca: top 5 mais similares
SELECT id, content, metadata,
       1 - (embedding <=> $1::vector) as similarity
FROM documents
WHERE metadata->>'category' = 'legal' -- Filtragem por metadata
ORDER BY embedding <=> $1::vector
LIMIT 5;
```

---

## 6. Retrieval e Reranking

```
Retrieval em 2 estágios:

Stage 1: Recall (buscar MUITOS candidatos rápido)
  Vector search: top 20 por similaridade de cosseno
  Hybrid: BM25 (keyword) + vector (semântico) com RRF (Reciprocal Rank Fusion)

Stage 2: Precision (rerankar para manter os MELHORES)
  Reranker: modelo que pontua pares (query, document) por relevância
  Top 20 → Reranker → Top 5 (esses vão para o prompt)
```

```javascript
// Pipeline completo de retrieval
async function retrieve(query, { topK = 5, category = null } = {}) {
  // 1. Embed query
  const queryEmbedding = await embedText(query);

  // 2. Vector search (recall: top 20)
  const candidates = await vectorDB.search(queryEmbedding, {
    limit: 20,
    filter: category ? { category } : undefined,
  });

  // 3. Rerank (precision: top K)
  const reranked = await reranker.rerank(query, candidates.map(c => c.text));
  const topResults = reranked.slice(0, topK);

  // 4. Montar contexto para o prompt
  const context = topResults
    .map((r, i) => `[Doc ${i + 1}] (${r.metadata.source})\n${r.text}`)
    .join('\n\n');

  return { context, sources: topResults.map(r => r.metadata) };
}

// 5. Gerar resposta
async function answerQuestion(question) {
  const { context, sources } = await retrieve(question);

  const response = await llm.generate({
    system: `Responda usando APENAS o contexto fornecido. Cite [Doc N] para cada afirmação.
Se a resposta não está no contexto, diga "Não encontrei essa informação."`,
    messages: [
      { role: 'user', content: `Contexto:\n${context}\n\nPergunta: ${question}` },
    ],
  });

  return { answer: response.text, sources };
}
```

---

## 7. Evaluation de RAG

```
3 dimensões para avaliar RAG:

1. Retrieval Quality (o contexto certo foi buscado?)
   Métricas: Precision@K, Recall@K, MRR, NDCG
   Teste: Para cada pergunta, verificar se os docs relevantes estão no top K

2. Generation Quality (a resposta é boa dado o contexto?)
   Métricas: Faithfulness (não inventou?), Relevance, Completeness
   Teste: Resposta está baseada nos docs? Respondeu a pergunta?

3. End-to-End (o user ficou satisfeito?)
   Métricas: User satisfaction, correctness, thumbs up/down
   Teste: Comparar resposta do RAG com ground truth

Ferramentas:
├── RAGAS (framework de eval para RAG)
├── LLM-as-judge (usar modelo para avaliar respostas)
├── Human eval (gold standard, mais caro)
└── A/B testing em produção
```

---

## 8. Patterns Avançados

```
Query Expansion:
  User pergunta "reembolso" → Expandir para "reembolso, devolução,
  estorno, cancelamento" → Buscar por todos os termos
  Melhora recall em queries curtas/ambíguas

Hypothetical Document Embedding (HyDE):
  Ao invés de embeddar a PERGUNTA, pedir ao LLM para gerar uma RESPOSTA
  hipotética e embeddar a resposta (que será mais similar aos documentos)

Agentic RAG:
  LLM decide: preciso buscar mais info? → Busca → Ainda não sei →
  Reformula query → Busca novamente → Agora consigo responder
  Mais lento, mas muito melhor para queries complexas

Self-RAG:
  LLM avalia se o contexto retrieved é relevante antes de usar.
  Se não é, descarta e busca novamente (ou responde sem).
  Reduz hallucination causada por contexto irrelevante.
```
