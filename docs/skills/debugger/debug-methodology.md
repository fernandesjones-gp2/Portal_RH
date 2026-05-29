# Debug Methodology — O Método Científico do Debugging

## Índice
1. O Método Científico Aplicado a Bugs
2. Binary Search (Bisection)
3. Git Bisect
4. Rubber Duck Debugging
5. 5 Whys — Root Cause
6. "Funciona Local, Não em Prod"
7. Wolf Fence Algorithm
8. Debugging Checklist por Cenário

---

## 1. O Método Científico Aplicado a Bugs

```
Debugging NÃO é tentativa e erro.
Debugging É o método científico:

1. OBSERVAR     →  Coletar evidências (logs, erro, comportamento)
2. HIPÓTESE     →  "Acredito que o bug é causado por X porque Y"
3. PREDIÇÃO     →  "Se minha hipótese está correta, quando eu fizer Z, deveria ver W"
4. EXPERIMENTO  →  Executar Z e observar
5. ANALISAR     →  O resultado confirma ou refuta a hipótese?
6. ITERAR       →  Se refutou, formular nova hipótese com a informação nova

O que diferencia debugger júnior de sênior:
├── Júnior: muda coisas aleatoriamente até funcionar
├── Pleno: tem intuição de onde olhar, mas sem método
├── Sênior: formula hipótese → testa → refina → converge rápido
```

### Exemplo prático

```
Observação: "API retorna 500 ao criar pedido, mas só para alguns users"

Hipótese 1: "O user tem dados inválidos que a validação não pega"
  Predição: Se eu enviar os mesmos dados com curl, recebo 500
  Experimento: curl -X POST /orders -d '{"items": [...]}' -H 'Auth: Bearer <token>'
  Resultado: 200 OK → Hipótese refutada. Não são os dados.

Hipótese 2: "O user tem endereço sem CEP e o cálculo de frete falha"
  Predição: Users que falham não têm CEP. Users que funcionam têm.
  Experimento: SELECT id, address_zip FROM users WHERE id IN (falha_ids)
  Resultado: Todos com zip=NULL → Hipótese confirmada!

Root cause: calculateShipping() assume address.zip existe, lança
TypeError: Cannot read property 'slice' of null

Fix: Validar que endereço tem CEP antes de calcular frete,
ou retornar erro claro "Endereço sem CEP".
```

---

## 2. Binary Search (Bisection)

```
Princípio: cortar o espaço de busca pela metade a cada passo.
Em vez de olhar 1000 linhas, perguntar: "O bug está na metade A ou B?"
Repetir até chegar na linha exata.

Aplicações:

A) Bisection no código (isolamento por camada):
   Frontend → API call → Middleware → Controller → Service → Repository → DB
   1. O request chega no backend? (log na entrada do controller)
   2. Se sim: o service recebe os dados corretos? (log na entrada do service)
   3. Se sim: a query executa sem erro? (log no repository)
   4. Se sim: o response é montado corretamente? (log no serializer)
   → Cada passo elimina metade do sistema como suspeito

B) Bisection no tempo (git bisect):
   "Funcionava semana passada, não funciona hoje"
   → Qual commit quebrou? (ver seção 3)

C) Bisection no input:
   "Falha com esse JSON de 500 campos"
   → Funciona com metade dos campos? Sim → o bug está na outra metade
   → Funciona com 1/4? Não → o bug está nesse 1/4
   → Continuar até encontrar o campo exato

D) Bisection em features:
   "O deploy de terça quebrou"
   → 5 PRs foram merged. Reverter 3 e testar.
   → Funciona? Bug está nas 3 revertidas. Senão, nas 2 restantes.
```

---

## 3. Git Bisect

```bash
# O algoritmo mais subestimado do debugging.
# Encontra o commit exato que introduziu o bug em O(log n) passos.
# 1000 commits → no máximo 10 testes.

# Iniciar
git bisect start

# Marcar o estado atual como ruim
git bisect bad

# Marcar um commit antigo que funcionava
git bisect good abc1234

# Git faz checkout do commit do meio. Testar e marcar:
git bisect good   # Se funciona nesse commit
git bisect bad    # Se o bug está presente nesse commit

# Repetir até Git dizer:
# "abc5678 is the first bad commit"

# Finalizar
git bisect reset

# AUTOMATIZAR (se tem teste que reproduz o bug):
git bisect start HEAD abc1234
git bisect run npm test -- --grep "should calculate shipping"
# Git roda o teste em cada commit automaticamente!
```

### Quando usar git bisect

```
✅ "Funcionava em <versão>, agora não funciona"
✅ "Regressão depois de algum deploy" (não sabe qual)
✅ "Performance degradou" (usar benchmark como teste)
✅ Bug sutil que não é óbvio em code review

❌ Bug existe desde o primeiro commit
❌ Bug depende de dados/estado (não do código)
❌ Poucos commits (<10) — mais rápido olhar manualmente
```

---

## 4. Rubber Duck Debugging

```
Técnica: Explicar o problema em voz alta (ou escrevendo)
para um "pato de borracha" (ou colega, ou chat).

Por que funciona:
├── Força organização do pensamento
├── Expõe premissas não verificadas
├── O ato de verbalizar revela lacunas lógicas
├── "Espera, eu disse que X é sempre true, mas será que...?"
└── Funciona em ~30% dos bugs (sério)

Template de rubber duck:

"O que deveria acontecer é [comportamento esperado].
O que está acontecendo é [comportamento real].
Isso ocorre quando [condição/trigger].
Eu verifiquei que [o que já descartou].
Minha hipótese atual é [suspeita].
O que não faz sentido é [a parte que contradiz]."

O bug geralmente mora na parte "o que não faz sentido".
```

---

## 5. 5 Whys — Root Cause

```
Sintoma: "O job de relatório falha toda segunda-feira de manhã"

Por que o job falha?
→ Timeout ao consultar a tabela de transações.

Por que dá timeout?
→ A query demora 45 segundos (threshold é 30s).

Por que a query demora 45 segundos na segunda?
→ Na segunda, inclui transações de sábado e domingo (3 dias).

Por que 3 dias é muito mais lento?
→ A query faz full table scan — não tem índice no campo created_at.

Por que não tem índice?
→ A tabela foi criada pelo ORM e ninguém revisou as queries geradas.

ROOT CAUSE: Falta de índice em created_at na tabela de transações.
O sintoma (timeout na segunda) é consequência de 3x mais dados sem índice.

FIX: CREATE INDEX idx_transactions_created ON transactions(created_at);
PREVENÇÃO: Review de queries do ORM no code review (ver database-specialist).
```

---

## 6. "Funciona Local, Não em Prod"

O clássico. Checklist de diferenças:

```
AMBIENTE:
☐ Node/Python/runtime version diferente?
☐ Env vars faltando ou com valor diferente?
☐ Timezone diferente (UTC vs local)?
☐ OS diferente (Mac vs Linux, filesystem case sensitivity)?
☐ Docker vs bare metal (DNS resolution, localhost vs container name)?

DADOS:
☐ Banco local tem dados simplificados (seed)?
☐ Prod tem dados que não existem em dev (nulls, unicode, volumes)?
☐ Migrations em ordem diferente?
☐ Cache em estado diferente (Redis stale)?

REDE:
☐ Firewall bloqueando (VPC, security groups)?
☐ DNS resolution diferente (interno vs externo)?
☐ TLS/SSL (local sem HTTPS, prod com HTTPS)?
☐ CORS (localhost:3000 vs app.dominio.com)?
☐ Proxy reverso (Nginx) alterando headers, body size?

INFRA:
☐ Memória limitada (container com 256MB vs dev com 16GB)?
☐ CPU throttling (container limits)?
☐ Disco read-only (container filesystem)?
☐ Escala (1 instância local vs N instâncias com load balancer)?
☐ Health check matando o processo?

DEPENDÊNCIAS:
☐ Versão de dependência diferente (package-lock vs npm install)?
☐ npm ci vs npm install no deploy?
☐ Dependência nativa que funciona em Mac mas não em Alpine Linux?

TIMING:
☐ Local é rápido, prod tem latência de rede (DB remoto, API)?
☐ Timeouts configurados diferente?
☐ Race condition que só aparece sob latência real?
```

---

## 7. Wolf Fence Algorithm

```
"Existe um lobo na floresta. Construa uma cerca no meio da floresta.
Escute de que lado vem o uivo. Construa outra cerca no meio desse lado.
Repita até encurralar o lobo."

Aplicação em código:

function processOrder(order) {
  console.log('>>> WOLF 1: order received', order.id);
  const validated = validateOrder(order);
  console.log('>>> WOLF 2: after validate', validated);
  const enriched = enrichWithUserData(validated);
  console.log('>>> WOLF 3: after enrich', enriched?.userId);
  const priced = calculatePricing(enriched);
  console.log('>>> WOLF 4: after pricing', priced?.total);
  const saved = await orderRepo.save(priced);
  console.log('>>> WOLF 5: after save', saved?.id);
  return saved;
}

// Se WOLF 3 mostra undefined, o bug está entre WOLF 2 e WOLF 3
// → enrichWithUserData retornou undefined
// → Investigar enrichWithUserData

Regra: logs de debug com prefixo distinguível (>>> ou 🐛)
para poder grep e remover facilmente depois.
```

---

## 8. Debugging Checklist por Cenário

### Bug reportado por user

```
1. ☐ Obter passos para reproduzir (passo a passo exato)
2. ☐ Obter browser/device/OS do user
3. ☐ Obter request ID (se o sistema gera)
4. ☐ Procurar nos logs pelo request ID ou timestamp
5. ☐ Reproduzir localmente com os mesmos dados
6. ☐ Se não reproduz: reproduzir no staging com dados de prod
```

### Erro 500 em produção

```
1. ☐ Verificar logs do período (qual a exception?)
2. ☐ Ler o stack trace completo (não só a mensagem)
3. ☐ Quantas vezes está ocorrendo? (spike ou constante?)
4. ☐ Começou quando? (correlacionar com deploy, migration, tráfego)
5. ☐ Afeta todos os users ou subset? (dados específicos?)
6. ☐ Rollback é opção? (se sim e é critical, rollback PRIMEIRO)
```

### Performance degradou

```
1. ☐ Quando começou? (deploy? pico de tráfego? dados cresceram?)
2. ☐ Qual endpoint/query é lento? (APM, slow query log)
3. ☐ CPU, memória ou I/O? (metrics dashboard)
4. ☐ EXPLAIN ANALYZE nas queries suspeitas
5. ☐ Profiling de código (flame graph)
6. ☐ Connection pool esgotado? (DB connections, HTTP agents)
```

### Bug intermitente

```
1. ☐ Coletar TODOS os dados de cada ocorrência
2. ☐ Procurar padrão: horário, user, dados, concorrência
3. ☐ Adicionar logging extra no código suspeito
4. ☐ Considerar: race condition, cache stale, DNS TTL, GC pause
5. ☐ Monitorar com alerta para próxima ocorrência
6. ☐ Quando capturar, fazer snapshot completo (request, state, timing)
```
