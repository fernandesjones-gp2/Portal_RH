# Migrations Safety — Zero-Downtime DDL e Rollback

## Índice
1. Princípios de Migration Segura
2. Operações Seguras vs Perigosas
3. Padrões de Migration Zero-Downtime
4. Data Migrations
5. Rollback Strategy
6. Checklist de Migration

---

## 1. Princípios de Migration Segura

```
Regras invioláveis:
├── NUNCA rodar migration em produção sem testar em staging
├── NUNCA rodar DDL que trava a tabela em horário de pico
├── SEMPRE ter rollback preparado ANTES de rodar
├── SEMPRE fazer backup ANTES de migrations destrutivas
├── NUNCA deletar coluna no mesmo deploy que remove o código que a usa
├── SEMPRE usar CONCURRENTLY para índices em produção
└── Migration é forward-only quando possível (expand/contract pattern)
```

### O que pode dar errado

| Operação | Risco | Impacto |
|----------|-------|---------|
| ALTER TABLE ADD COLUMN com default (PG < 11) | Reescreve tabela inteira | Lock exclusivo por minutos/horas |
| CREATE INDEX (sem CONCURRENTLY) | Lock de write na tabela | Inserts/updates bloqueados |
| ALTER TABLE SET NOT NULL | Scan de tabela inteira | Lock |
| DROP COLUMN | Dados perdidos irreversivelmente | Sem rollback possível |
| RENAME COLUMN | App quebra se código ainda usa nome antigo | Downtime |
| ALTER TYPE (mudar tipo da coluna) | Reescreve tabela | Lock longo |

---

## 2. Operações Seguras vs Perigosas

### ✅ Operações seguras (instant ou muito rápido)

```sql
-- Adicionar coluna nullable sem default (instant no PostgreSQL)
ALTER TABLE orders ADD COLUMN notes TEXT;

-- Adicionar coluna com default (instant no PostgreSQL 11+)
ALTER TABLE orders ADD COLUMN priority INTEGER DEFAULT 0;

-- Criar índice CONCURRENTLY (não bloqueia writes)
CREATE INDEX CONCURRENTLY idx_orders_status ON orders (status);

-- Adicionar constraint CHECK como NOT VALID (não valida dados existentes)
ALTER TABLE orders ADD CONSTRAINT check_total_positive
  CHECK (total >= 0) NOT VALID;

-- Drop constraint
ALTER TABLE orders DROP CONSTRAINT check_total_positive;

-- COMMENT (metadata apenas)
COMMENT ON COLUMN orders.status IS 'pending, paid, shipped, delivered';
```

### 🔴 Operações perigosas (requerem cuidado)

```sql
-- ❌ SET NOT NULL (faz scan de tabela inteira + lock)
ALTER TABLE orders ALTER COLUMN status SET NOT NULL;

-- ✅ Alternativa segura: constraint NOT VALID + validate separado
ALTER TABLE orders ADD CONSTRAINT orders_status_not_null
  CHECK (status IS NOT NULL) NOT VALID;
-- Deploy e esperar
ALTER TABLE orders VALIDATE CONSTRAINT orders_status_not_null;
-- Validate roda sem lock exclusivo (ShareUpdateExclusiveLock)

-- ❌ CREATE INDEX (sem CONCURRENTLY)
CREATE INDEX idx_big_table ON big_table (column);

-- ✅ Sempre usar CONCURRENTLY
CREATE INDEX CONCURRENTLY idx_big_table ON big_table (column);

-- ❌ ALTER TYPE (reescreve tabela)
ALTER TABLE users ALTER COLUMN age TYPE BIGINT;

-- ✅ Alternativa: criar coluna nova, migrar dados, trocar
ALTER TABLE users ADD COLUMN age_new BIGINT;
UPDATE users SET age_new = age;  -- Em batches!
-- Deploy: app começa a usar age_new
ALTER TABLE users DROP COLUMN age;
ALTER TABLE users RENAME COLUMN age_new TO age;
```

---

## 3. Padrões de Migration Zero-Downtime

### Padrão Expand/Contract

Toda mudança destrutiva (rename, drop, change type) segue 3 fases:

```
Fase 1: EXPAND (adicionar o novo)
├── Criar coluna/tabela nova
├── App começa a ESCREVER em ambos (dual-write)
├── Backfill dados antigos para a estrutura nova
└── Deploy: app começa a LER do novo

Fase 2: MIGRATE (transição)
├── App lê APENAS do novo
├── App ainda escreve em ambos (safety net)
├── Validar que tudo funciona
└── Monitorar por 1-7 dias

Fase 3: CONTRACT (remover o velho)
├── App para de escrever no antigo
├── Dropar coluna/tabela antiga
└── Limpar código de dual-write
```

### Exemplo: Renomear coluna

```sql
-- ❌ NUNCA: rename direto (quebra a app)
ALTER TABLE users RENAME COLUMN name TO full_name;

-- ✅ Expand/Contract:

-- Migration 1 (Expand): Adicionar coluna nova
ALTER TABLE users ADD COLUMN full_name TEXT;

-- Migration 2: Copiar dados (em batches)
UPDATE users SET full_name = name WHERE full_name IS NULL AND id BETWEEN 1 AND 10000;
UPDATE users SET full_name = name WHERE full_name IS NULL AND id BETWEEN 10001 AND 20000;
-- ...

-- Migration 3: Trigger para sync (enquanto ambas colunas existem)
CREATE OR REPLACE FUNCTION sync_user_name() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.full_name IS NULL THEN NEW.full_name = NEW.name; END IF;
  IF NEW.name IS NULL THEN NEW.name = NEW.full_name; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_name BEFORE INSERT OR UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION sync_user_name();

-- Deploy: App começa a ler full_name e escrever em ambos
-- Monitorar por X dias

-- Migration 4 (Contract): Remover coluna antiga
DROP TRIGGER trg_sync_name ON users;
DROP FUNCTION sync_user_name();
ALTER TABLE users DROP COLUMN name;
```

### Exemplo: Adicionar NOT NULL em coluna existente

```sql
-- ❌ NUNCA em tabela grande:
ALTER TABLE orders ALTER COLUMN status SET NOT NULL;
-- Faz FULL TABLE SCAN + ACCESS EXCLUSIVE LOCK

-- ✅ Seguro:

-- Step 1: Adicionar CHECK constraint sem validar
ALTER TABLE orders ADD CONSTRAINT orders_status_nn
  CHECK (status IS NOT NULL) NOT VALID;

-- Step 2: App garante que novos registros nunca são NULL

-- Step 3: Backfill NULLs existentes (em batches)
UPDATE orders SET status = 'unknown' WHERE status IS NULL AND id BETWEEN 1 AND 10000;

-- Step 4: Validar constraint (lock leve, não exclusivo)
ALTER TABLE orders VALIDATE CONSTRAINT orders_status_nn;

-- Step 5 (opcional): Trocar para NOT NULL real
-- Em PostgreSQL 12+, o planner reconhece o CHECK e trata como NOT NULL
-- Se quiser o NOT NULL formal:
ALTER TABLE orders ALTER COLUMN status SET NOT NULL;
ALTER TABLE orders DROP CONSTRAINT orders_status_nn;
-- Isso é instant porque PG já sabe que não há NULLs (validado pelo CHECK)
```

---

## 4. Data Migrations

### Regra: Em batches, nunca tudo de uma vez

```sql
-- ❌ UPDATE em 10M rows de uma vez (lock, WAL explosion, OOM)
UPDATE orders SET new_column = old_column;

-- ✅ Em batches de 10K
DO $$
DECLARE
  batch_size INT := 10000;
  total_updated INT := 0;
  rows_affected INT;
BEGIN
  LOOP
    UPDATE orders
    SET new_column = old_column
    WHERE new_column IS NULL
      AND id IN (
        SELECT id FROM orders
        WHERE new_column IS NULL
        LIMIT batch_size
        FOR UPDATE SKIP LOCKED
      );

    GET DIAGNOSTICS rows_affected = ROW_COUNT;
    total_updated := total_updated + rows_affected;
    RAISE NOTICE 'Updated % rows (total: %)', rows_affected, total_updated;

    EXIT WHEN rows_affected = 0;

    -- Pausa entre batches para não sobrecarregar
    PERFORM pg_sleep(0.1);
  END LOOP;
END $$;
```

### Para tabelas muito grandes (100M+)

```sql
-- Criar tabela nova com a estrutura desejada
CREATE TABLE orders_new (LIKE orders INCLUDING ALL);
ALTER TABLE orders_new ADD COLUMN new_column TEXT;

-- Copiar em chunks usando COPY (mais rápido que INSERT)
INSERT INTO orders_new
SELECT *, compute_new_column(old_column) AS new_column
FROM orders
WHERE id BETWEEN 1 AND 1000000;

-- Repetir para próximos chunks...

-- Quando pronto:
BEGIN;
ALTER TABLE orders RENAME TO orders_old;
ALTER TABLE orders_new RENAME TO orders;
COMMIT;

-- Depois de validar:
DROP TABLE orders_old;
```

---

## 5. Rollback Strategy

### Toda migration tem rollback

```sql
-- Migration file: 20250115_add_priority_to_orders.sql

-- UP
ALTER TABLE orders ADD COLUMN priority INTEGER DEFAULT 0;
CREATE INDEX CONCURRENTLY idx_orders_priority ON orders (priority);

-- DOWN (rollback)
DROP INDEX CONCURRENTLY IF EXISTS idx_orders_priority;
ALTER TABLE orders DROP COLUMN IF EXISTS priority;
```

### Quando rollback NÃO é possível

```
Situações irreversíveis:
├── DROP COLUMN (dados perdidos) → Backup é o rollback
├── DROP TABLE → Backup
├── TRUNCATE → Backup
├── Data migration destrutiva → Backup + coluna de backup
└── Conversão de tipo com perda de precisão → Manter coluna original
```

### Estratégia para irreversíveis

```sql
-- Antes de dropar, RENOMEAR (soft-drop)
ALTER TABLE orders RENAME COLUMN old_column TO _deprecated_old_column;

-- Esperar 1-2 semanas em produção
-- Se ninguém reclamou:
ALTER TABLE orders DROP COLUMN _deprecated_old_column;

-- Se alguém reclamou:
ALTER TABLE orders RENAME COLUMN _deprecated_old_column TO old_column;
-- Rollback instantâneo!
```

---

## 6. Checklist de Migration

### Antes de rodar

```
□ Migration testada em staging com dados reais (ou volume similar)?
□ EXPLAIN ANALYZE rodou nas queries afetadas?
□ Rollback script existe e foi testado?
□ Backup recente existe e está verificado?
□ Horário de baixo tráfego? (se migration é pesada)
□ Time está de plantão durante a execução?
□ Monitoramento está ativo (connections, locks, disk)?
□ Índices usam CONCURRENTLY?
□ Data migrations são em batches (não full table update)?
□ Columns com NOT NULL usam padrão CHECK NOT VALID?
□ Não tem DROP COLUMN no mesmo deploy que remove código?
```

### Durante a execução

```
□ Monitorar pg_stat_activity (queries travadas?)
□ Monitorar locks (pg_locks)
□ Monitorar disk usage (WAL pode crescer)
□ Monitorar replication lag (se tem replicas)
□ Ter terminal pronto para rollback
```

### Depois

```
□ ANALYZE nas tabelas afetadas
□ Verificar que queries usam novos índices (EXPLAIN)
□ Monitorar performance por 24-48h
□ Documentar a migration no changelog
□ Limpar código/colunas deprecated na próxima sprint
```
