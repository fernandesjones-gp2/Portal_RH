# Index Strategy — Quando, Qual e Como

## Índice
1. Princípios de Indexação
2. Tipos de Índice (PostgreSQL)
3. Índices Compostos
4. Índices Parciais
5. Índices de Expressão
6. Covering Indexes (Index-Only Scans)
7. Anti-Patterns
8. Manutenção de Índices

---

## 1. Princípios de Indexação

```
Regras fundamentais:
├── Índice existe para EVITAR seq scan em tabelas grandes
├── Cada índice CUSTA em write (INSERT, UPDATE, DELETE ficam mais lentos)
├── Índice não usado é peso morto (espaço + write overhead)
├── A ORDEM dos campos no índice composto IMPORTA
├── EXPLAIN ANALYZE é o juiz — não intuição
└── Menos índices melhores > muitos índices mediocres
```

### Quando criar índice

| Cenário | Criar? |
|---------|--------|
| WHERE em campo com alta seletividade (user_id, email) | ✅ Sim |
| JOIN key (FK) | ✅ Sim (sempre) |
| ORDER BY frequente | ✅ Sim, especialmente com LIMIT |
| WHERE em campo boolean (active = true) | 🟡 Talvez — índice parcial se poucos true |
| WHERE em campo com baixa seletividade (status com 3 valores) | 🟡 Parcial ou composto |
| Tabela com < 1000 rows | ❌ Não (seq scan é mais rápido) |
| Coluna que nunca aparece em WHERE/JOIN/ORDER | ❌ Não |
| Tabela write-heavy com poucos reads | ⚠️ Cuidado — cada índice penaliza writes |

### Quanto custa um índice em writes

```
Regra de bolso:
├── 1 índice → INSERT ~10-15% mais lento
├── 5 índices → INSERT ~40-60% mais lento
├── 10 índices → INSERT pode dobrar de tempo
└── UPDATE em coluna indexada → atualiza a row + TODOS índices que incluem a coluna
```

---

## 2. Tipos de Índice (PostgreSQL)

| Tipo | Melhor para | Operadores suportados |
|------|-------------|----------------------|
| **B-tree** (default) | Igualdade, range, ORDER BY | `=`, `<`, `>`, `<=`, `>=`, `BETWEEN`, `IN`, `IS NULL` |
| **Hash** | Igualdade apenas | `=` |
| **GIN** | Arrays, JSONB, full-text search | `@>`, `<@`, `?`, `?&`, `?\|`, `@@` |
| **GiST** | Geoespacial, range types, full-text | `<<`, `>>`, `&&`, `@>`, `<@` |
| **BRIN** | Colunas com correlação física (timestamps em tabelas append-only) | `<`, `>`, `=` |
| **SP-GiST** | Dados com particionamento natural (pontos, ranges) | Variável |

### Quando usar cada tipo

```sql
-- B-tree: Default. 90% dos casos.
CREATE INDEX idx_users_email ON users (email);

-- GIN: JSONB queries
CREATE INDEX idx_products_attrs ON products USING GIN (attributes);
-- Para: SELECT * FROM products WHERE attributes @> '{"color": "red"}';

-- GIN: Array contains
CREATE INDEX idx_posts_tags ON posts USING GIN (tags);
-- Para: SELECT * FROM posts WHERE tags @> ARRAY['javascript'];

-- GIN: Full-text search
CREATE INDEX idx_articles_search ON articles USING GIN (to_tsvector('portuguese', title || ' ' || body));

-- BRIN: Timestamps em tabelas grandes de log/events (muito compacto)
CREATE INDEX idx_events_created_brin ON events USING BRIN (created_at);
-- 1000x menor que B-tree equivalente. Bom para tabelas de bilhões de rows.

-- GiST: PostGIS / geoespacial
CREATE INDEX idx_places_location ON places USING GIST (location);
```

---

## 3. Índices Compostos

### A ordem dos campos importa (MUITO)

```sql
-- Índice (A, B, C) serve para:
✅ WHERE A = ?
✅ WHERE A = ? AND B = ?
✅ WHERE A = ? AND B = ? AND C = ?
✅ WHERE A = ? ORDER BY B
❌ WHERE B = ?           ← Não usa o índice!
❌ WHERE C = ?           ← Não usa o índice!
❌ WHERE B = ? AND C = ? ← Não usa o índice!
```

**Regra do leftmost prefix**: O índice composto só é usado se a query
começa pelo campo mais à esquerda.

### Como ordenar campos no índice composto

```
Regra de ouro (Equality → Range → Sort):

1. Campos de IGUALDADE primeiro (status = 'active')
2. Campos de RANGE depois (created_at > '2025-01-01')
3. Campos de SORT por último (ORDER BY created_at DESC)
```

### Exemplo prático

```sql
-- Query
SELECT * FROM orders
WHERE status = 'pending'
  AND created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC
LIMIT 20;

-- Índice ÓTIMO (equality → range+sort)
CREATE INDEX idx_orders_status_created ON orders (status, created_at DESC);

-- Com INCLUDE para covering index (Index Only Scan):
CREATE INDEX idx_orders_status_created ON orders (status, created_at DESC)
  INCLUDE (id, total, user_id);
```

---

## 4. Índices Parciais

Índice que cobre apenas um SUBCONJUNTO das rows. Menor, mais rápido, menos overhead.

```sql
-- Apenas orders pendentes (se 95% dos orders são completed)
CREATE INDEX idx_orders_pending ON orders (created_at DESC)
  WHERE status = 'pending';
-- Index size: ~5% do equivalente full. Queries em pending: mesma performance.

-- Apenas usuários ativos
CREATE INDEX idx_users_active_email ON users (email)
  WHERE deleted_at IS NULL;

-- Apenas itens em estoque
CREATE INDEX idx_products_in_stock ON products (category_id, price)
  WHERE stock > 0;
```

### Quando usar índice parcial

| Cenário | Índice parcial? |
|---------|----------------|
| Coluna booleana onde 90%+ é um valor | ✅ Sim, indexar apenas o valor minoritário |
| Soft delete (deleted_at IS NULL para ativos) | ✅ Sim |
| Status com distribuição desigual | ✅ Sim, indexar apenas status frequentes em queries |
| UNIQUE que só se aplica a subset | ✅ `UNIQUE WHERE active = true` |

---

## 5. Índices de Expressão

Indexar o RESULTADO de uma expressão, não a coluna raw.

```sql
-- Busca case-insensitive por email
CREATE INDEX idx_users_email_lower ON users (LOWER(email));
-- Query DEVE usar a mesma expressão:
SELECT * FROM users WHERE LOWER(email) = 'john@example.com';

-- Extrair campo de JSONB
CREATE INDEX idx_orders_customer_email ON orders ((data->>'customer_email'));
-- Para: WHERE data->>'customer_email' = 'john@example.com'

-- Date part
CREATE INDEX idx_events_year_month ON events (date_trunc('month', created_at));
-- Para: WHERE date_trunc('month', created_at) = '2025-01-01'
```

---

## 6. Covering Indexes (Index-Only Scans)

O planner pode responder a query APENAS com o índice, sem visitar a tabela.
É o cenário mais rápido possível.

```sql
-- INCLUDE: campos extras que não são chave de busca mas são retornados
CREATE INDEX idx_orders_user ON orders (user_id, created_at DESC)
  INCLUDE (id, status, total);

-- Query que agora faz Index Only Scan:
SELECT id, status, total
FROM orders
WHERE user_id = 123
ORDER BY created_at DESC
LIMIT 20;
```

**Atenção**: Index Only Scan só funciona se a tabela tem visibility map
atualizado (VACUUM em dia). Se VACUUM está atrasado, cai para Index Scan regular.

---

## 7. Anti-Patterns

### ❌ Índice em toda coluna

```sql
-- NÃO fazer isso
CREATE INDEX idx_1 ON users (name);
CREATE INDEX idx_2 ON users (email);
CREATE INDEX idx_3 ON users (created_at);
CREATE INDEX idx_4 ON users (status);
CREATE INDEX idx_5 ON users (role);
CREATE INDEX idx_6 ON users (last_login);
-- 6 índices = 6x overhead em writes, espaço, vacuum

-- Fazer: apenas os necessários baseado em queries reais
CREATE INDEX idx_users_email ON users (email);  -- Usado em login
CREATE INDEX idx_users_status_created ON users (status, created_at DESC);  -- Usado em listagem admin
```

### ❌ Índice duplicado

```sql
-- idx_orders_user (user_id) já é coberto por
-- idx_orders_user_created (user_id, created_at)
-- O composto serve para WHERE user_id = ? também!
```

### ❌ Índice em coluna com baixíssima seletividade

```sql
-- status com 3 valores em 1M rows → cada valor = 333K rows
-- B-tree normal não ajuda. Use parcial ou composto.
CREATE INDEX idx_orders_status ON orders (status);  -- ❌ Inútil sozinho
CREATE INDEX idx_orders_pending ON orders (user_id) WHERE status = 'pending';  -- ✅
```

### ❌ Função na coluna sem índice de expressão

```sql
-- ❌ Índice em created_at NÃO é usado aqui:
WHERE DATE(created_at) = '2025-01-15'
WHERE LOWER(email) = 'john@example.com'
WHERE amount / 100 > 50

-- ✅ Reescrever para usar o índice:
WHERE created_at >= '2025-01-15' AND created_at < '2025-01-16'
-- Ou criar expression index
```

---

## 8. Manutenção de Índices

### Reindex (rebuild de índice com bloat)

```sql
-- Reindex online (PostgreSQL 12+, não bloqueia reads)
REINDEX INDEX CONCURRENTLY idx_orders_status_created;

-- Reindex de toda tabela
REINDEX TABLE CONCURRENTLY orders;
```

### Encontrar e remover índices inúteis

```sql
-- Query do diagnostic-toolkit: índices com 0 scans
-- Revisar mensalmente e dropar os não usados
DROP INDEX CONCURRENTLY idx_que_ninguem_usa;
```

### ANALYZE após criar índice

```sql
CREATE INDEX CONCURRENTLY idx_novo ON tabela (campo);
ANALYZE tabela;  -- Atualizar estatísticas para o planner usar o índice novo
```
