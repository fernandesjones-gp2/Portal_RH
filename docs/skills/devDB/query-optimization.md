# Query Optimization — Padrões e Rewrite

## Índice
1. Checklist de Otimização
2. JOINs — Padrões e Armadilhas
3. Subqueries vs JOINs vs CTEs
4. Window Functions
5. Aggregations Eficientes
6. Pagination
7. N+1 Problem (ORM)
8. Bulk Operations
9. JSONB Queries

---

## 1. Checklist de Otimização

Antes de reescrever qualquer query, rodar este checklist:

```
□ EXPLAIN ANALYZE rodou? (sem EXPLAIN, é chute)
□ Estatísticas estão atualizadas? (ANALYZE tabela)
□ Existe índice para os campos no WHERE/JOIN? (ver index-strategy.md)
□ A query retorna APENAS os campos necessários? (não SELECT *)
□ Tem LIMIT? (se é uma listagem, sempre ter)
□ O ORM não está fazendo N+1? (ver logs SQL)
□ Tem subquery que poderia ser JOIN?
□ Tem OR que poderia ser IN ou UNION?
□ Tem função na coluna do WHERE que mata o índice?
□ Tem DISTINCT desnecessário escondendo um JOIN ruim?
```

---

## 2. JOINs — Padrões e Armadilhas

### Ordem dos JOINs

O PostgreSQL reordena JOINs automaticamente (até ~8 tabelas).
Acima disso, considerar hints via `join_collapse_limit`.

```sql
-- ✅ Boa prática: começar pela tabela mais restritiva
SELECT o.id, o.total, u.name, p.title
FROM orders o                         -- Filtro principal (status + date)
JOIN users u ON u.id = o.user_id      -- 1:1 lookup (rápido com PK)
JOIN order_items oi ON oi.order_id = o.id  -- 1:N
JOIN products p ON p.id = oi.product_id    -- 1:1 lookup
WHERE o.status = 'pending'
  AND o.created_at > NOW() - INTERVAL '7 days'
LIMIT 20;
```

### LEFT JOIN vs INNER JOIN

```sql
-- INNER JOIN: apenas rows com match em AMBOS lados
-- LEFT JOIN: todas as rows do lado esquerdo, NULL se sem match

-- ❌ LEFT JOIN quando deveria ser INNER
SELECT o.*, u.name
FROM orders o
LEFT JOIN users u ON u.id = o.user_id
WHERE u.status = 'active';  -- WHERE no lado RIGHT anula o LEFT JOIN!

-- ✅ Correto
SELECT o.*, u.name
FROM orders o
INNER JOIN users u ON u.id = o.user_id AND u.status = 'active';
```

### EXISTS vs IN vs JOIN para verificar existência

```sql
-- Para "orders que TÊM pelo menos um item":

-- ✅ EXISTS (melhor na maioria dos casos — para na primeira match)
SELECT o.*
FROM orders o
WHERE EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = o.id);

-- 🟡 IN (OK para listas pequenas, ruim para subqueries grandes)
SELECT o.*
FROM orders o
WHERE o.id IN (SELECT order_id FROM order_items);

-- 🟡 JOIN (retorna duplicatas se relação 1:N — precisa de DISTINCT)
SELECT DISTINCT o.*
FROM orders o
JOIN order_items oi ON oi.order_id = o.id;
-- DISTINCT é caro! EXISTS é melhor aqui.
```

---

## 3. Subqueries vs JOINs vs CTEs

### Subqueries correlacionadas (executam por row — cuidado)

```sql
-- ❌ Subquery correlacionada: executa N vezes (1 por order)
SELECT o.*,
  (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) AS item_count
FROM orders o;

-- ✅ Rewrite com JOIN + GROUP BY
SELECT o.*, COUNT(oi.id) AS item_count
FROM orders o
LEFT JOIN order_items oi ON oi.order_id = o.id
GROUP BY o.id;

-- ✅ Ou lateral join (quando precisa de LIMIT na subquery)
SELECT o.*, latest_item.*
FROM orders o
CROSS JOIN LATERAL (
  SELECT oi.product_id, oi.quantity
  FROM order_items oi
  WHERE oi.order_id = o.id
  ORDER BY oi.created_at DESC
  LIMIT 1
) latest_item;
```

### CTEs (WITH) — Legibilidade vs Performance

```sql
-- CTE padrão (PostgreSQL 12+ inline automaticamente)
WITH active_users AS (
  SELECT id, name FROM users WHERE status = 'active'
)
SELECT o.*, au.name
FROM orders o
JOIN active_users au ON au.id = o.user_id;
-- PostgreSQL 12+: otimiza igual a subquery inline. OK.

-- CTE MATERIALIZED (forçar materialização — útil quando CTE é reutilizado)
WITH active_users AS MATERIALIZED (
  SELECT id, name FROM users WHERE status = 'active'
)
SELECT * FROM active_users WHERE ...
UNION ALL
SELECT * FROM active_users WHERE ...;
```

### Recursive CTE (hierarquias)

```sql
-- Árvore de categorias (parent-child)
WITH RECURSIVE category_tree AS (
  -- Base: categorias raiz
  SELECT id, name, parent_id, 0 AS depth, ARRAY[id] AS path
  FROM categories
  WHERE parent_id IS NULL

  UNION ALL

  -- Recursão: filhos
  SELECT c.id, c.name, c.parent_id, ct.depth + 1, ct.path || c.id
  FROM categories c
  JOIN category_tree ct ON ct.id = c.parent_id
  WHERE ct.depth < 10  -- Safety limit
)
SELECT * FROM category_tree ORDER BY path;
```

---

## 4. Window Functions

Processam rows SEM colapsar o resultado (diferente de GROUP BY).

### ROW_NUMBER — Paginação, dedup, ranking

```sql
-- Top produto por categoria
SELECT * FROM (
  SELECT p.*,
    ROW_NUMBER() OVER (PARTITION BY category_id ORDER BY sales DESC) AS rn
  FROM products p
) ranked
WHERE rn <= 3;  -- Top 3 por categoria
```

### LAG / LEAD — Comparar com row anterior/seguinte

```sql
-- Variação de receita mês a mês
SELECT
  month,
  revenue,
  LAG(revenue) OVER (ORDER BY month) AS prev_month,
  revenue - LAG(revenue) OVER (ORDER BY month) AS variation,
  ROUND((revenue - LAG(revenue) OVER (ORDER BY month))::numeric
    / NULLIF(LAG(revenue) OVER (ORDER BY month), 0) * 100, 1) AS pct_change
FROM monthly_revenue;
```

### Aggregates como window function

```sql
-- Running total (total acumulado)
SELECT
  date, amount,
  SUM(amount) OVER (ORDER BY date ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running_total
FROM transactions;

-- Média móvel de 7 dias
SELECT
  date, value,
  AVG(value) OVER (ORDER BY date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) AS moving_avg_7d
FROM daily_metrics;
```

---

## 5. Aggregations Eficientes

### COUNT com filtro

```sql
-- ❌ Múltiplas queries
SELECT COUNT(*) FROM orders WHERE status = 'pending';
SELECT COUNT(*) FROM orders WHERE status = 'shipped';
SELECT COUNT(*) FROM orders WHERE status = 'delivered';

-- ✅ Uma query com FILTER
SELECT
  COUNT(*) FILTER (WHERE status = 'pending') AS pending,
  COUNT(*) FILTER (WHERE status = 'shipped') AS shipped,
  COUNT(*) FILTER (WHERE status = 'delivered') AS delivered
FROM orders;
```

### COUNT estimado (para tabelas grandes onde valor exato não importa)

```sql
-- Estimativa RÁPIDA do total de rows (sem seq scan)
SELECT reltuples::bigint AS estimated_count
FROM pg_class
WHERE relname = 'orders';
```

### GROUP BY com ROLLUP

```sql
-- Vendas por categoria com subtotais e total geral
SELECT
  COALESCE(category, 'TOTAL') AS category,
  COALESCE(status, 'ALL') AS status,
  COUNT(*) AS count,
  SUM(total) AS revenue
FROM orders o
JOIN products p ON p.id = o.product_id
GROUP BY ROLLUP (category, status);
```

---

## 6. Pagination

### Offset-based (simples, mas ruim em páginas altas)

```sql
-- Página 1: rápido
SELECT * FROM products ORDER BY id LIMIT 20 OFFSET 0;

-- Página 5000: LENTO (precisa descartar 100K rows)
SELECT * FROM products ORDER BY id LIMIT 20 OFFSET 99980;
```

### Cursor-based / Keyset (sempre rápido)

```sql
-- Primeira página
SELECT * FROM products ORDER BY created_at DESC, id DESC LIMIT 20;

-- Próximas páginas: usar último valor visto como cursor
SELECT * FROM products
WHERE (created_at, id) < ('2025-01-15T10:00:00Z', 'uuid-do-ultimo')
ORDER BY created_at DESC, id DESC
LIMIT 20;

-- Requer índice composto:
CREATE INDEX idx_products_cursor ON products (created_at DESC, id DESC);
```

### Quando usar qual

| Cenário | Offset | Cursor |
|---------|--------|--------|
| UI com "Página 1, 2, 3..." | 🟡 OK se < 1000 páginas | Não natural |
| Feed infinito (scroll) | ❌ Fica lento | ✅ Sempre rápido |
| API paginada | 🟡 Simples de implementar | ✅ Melhor performance |
| Relatório com export | ❌ | ✅ Obrigatório |

---

## 7. N+1 Problem (ORM)

### Identificar

```
ORM executa:
  1. SELECT * FROM orders WHERE status = 'pending' LIMIT 20;  (1 query)
  2. SELECT * FROM users WHERE id = 10;                        (20 queries,
  3. SELECT * FROM users WHERE id = 11;                         uma por order)
  ...
  21. SELECT * FROM users WHERE id = 29;

Total: 21 queries em vez de 1-2.
```

### Fix: Eager Loading

```python
# Django
orders = Order.objects.filter(status='pending').select_related('user')[:20]

# SQLAlchemy
orders = session.query(Order).options(joinedload(Order.user)).filter(...).limit(20).all()
```

```javascript
// Prisma
const orders = await prisma.order.findMany({
  where: { status: 'pending' },
  include: { user: true },
  take: 20,
});

// Sequelize
const orders = await Order.findAll({
  where: { status: 'pending' },
  include: [User],
  limit: 20,
});
```

### Fix: Batch Loading (DataLoader pattern)

```javascript
// Para GraphQL / resolvers
const userLoader = new DataLoader(async (userIds) => {
  const users = await db.query('SELECT * FROM users WHERE id = ANY($1)', [userIds]);
  return userIds.map(id => users.find(u => u.id === id));
});
```

---

## 8. Bulk Operations

### INSERT em batch

```sql
-- ❌ INSERT um por um (N roundtrips)
INSERT INTO events (type, data) VALUES ('click', '{}');
INSERT INTO events (type, data) VALUES ('view', '{}');

-- ✅ INSERT em batch (1 roundtrip)
INSERT INTO events (type, data) VALUES
  ('click', '{}'),
  ('view', '{}'),
  ('click', '{}');

-- ✅ COPY para volume muito grande (mais rápido que INSERT)
COPY events (type, data) FROM STDIN WITH (FORMAT csv);
```

### UPDATE em batch

```sql
-- ❌ UPDATE um por um
UPDATE products SET price = 10.00 WHERE id = 1;
UPDATE products SET price = 20.00 WHERE id = 2;

-- ✅ UPDATE com VALUES
UPDATE products AS p SET price = v.new_price
FROM (VALUES (1, 10.00), (2, 20.00), (3, 30.00)) AS v(id, new_price)
WHERE p.id = v.id;
```

### UPSERT (INSERT ... ON CONFLICT)

```sql
INSERT INTO user_settings (user_id, key, value)
VALUES (123, 'theme', 'dark')
ON CONFLICT (user_id, key) DO UPDATE
  SET value = EXCLUDED.value,
      updated_at = NOW();
```

---

## 9. JSONB Queries (PostgreSQL)

```sql
-- Acessar campo
SELECT data->>'name' AS name FROM products;         -- text
SELECT data->'address'->>'city' AS city FROM users;  -- nested

-- Filtrar por campo JSONB
SELECT * FROM products WHERE data->>'status' = 'active';

-- Filtrar com containment (usa índice GIN)
SELECT * FROM products WHERE data @> '{"color": "red", "size": "L"}';

-- Índice GIN para queries @>
CREATE INDEX idx_products_data ON products USING GIN (data);

-- Índice para campo específico
CREATE INDEX idx_products_status ON products ((data->>'status'));

-- Aggregação de campo JSONB
SELECT data->>'category' AS category, COUNT(*)
FROM products
GROUP BY data->>'category';
```
