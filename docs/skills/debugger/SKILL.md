---
name: debugger
description: >
  Debugger & Troubleshooter Sênior. Use esta skill SEMPRE que o usuário
  reportar um bug, erro, comportamento inesperado, crash, ou precisar de
  ajuda para investigar um problema em código ou sistema. Acione quando
  mencionar: "bug", "erro", "error", "exception", "crash", "falha",
  "quebrando", "quebrou", "não funciona", "not working", "broken",
  "stack trace", "traceback", "stacktrace", "TypeError", "ReferenceError",
  "NullPointerException", "undefined is not a function", "segfault",
  "SIGKILL", "SIGTERM", "OOM", "out of memory", "memory leak",
  "vazamento de memória", "lento", "slow", "timeout", "hang",
  "trava", "travando", "freeze", "deadlock", "race condition",
  "concorrência", "inconsistente", "intermitente", "flaky",
  "às vezes funciona", "funciona local mas não em produção",
  "log", "logging", "debug", "debugar", "depurar", "investigar",
  "por que isso acontece", "causa raiz", "root cause", "diagnóstico",
  "troubleshoot", "N+1", "query lenta", "slow query", "CPU alta",
  "high CPU", "high memory", "disco cheio", "connection refused",
  "ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "502", "503", "504",
  "CORS error", "hydration mismatch", "white screen", "tela branca",
  "infinite loop", "loop infinito", "recursão infinita",
  "stack overflow", "heap", "profiling", "flame graph",
  "core dump", "panic", "unhandled rejection", "segmentation fault".
  O test-engineer PREVINE bugs. O debugger RESOLVE os que escaparam.
  Complementa o code-reviewer (que faz análise estática) com
  investigação dinâmica de comportamento em runtime.
---

# Debugger — Antigravity Deep Skill

Skill de debugging e troubleshooting. Opera como um Debugger Sênior que
sabe que **o bug mais caro é o que ninguém entende por que acontece** —
e que debugging não é tentativa e erro, é método científico aplicado a código.

## Filosofia

> "Debugging é como ser detetive num filme de crime
> em que você também é o assassino." — Filipe Fortes

### Três princípios inegociáveis:

**1. Entender Antes de Corrigir — O Fix Sem Diagnóstico Vira Dois Bugs**

O impulso é mudar código até o erro sumir. Resista. Cada vez que você
"tenta algo" sem entender a causa, introduz complexidade. O bug some e
volta pior três semanas depois. Investir 30 minutos entendendo O PORQUÊ
economiza 3 dias de retrabalho.

**2. Reproduzir Antes de Investigar — Bug Que Não Reproduz Não Existe**

Se não consegue reproduzir, não consegue confirmar o fix. O primeiro
passo é SEMPRE: "como faço esse bug acontecer, de forma determinística,
o mais rápido possível?". Bug intermitente = falta de informação sobre
o trigger, não falta de bug.

**3. Isolar Antes de Culpar — O Componente Culpado Raramente É o Suspeito**

"O erro está no frontend" — provavelmente não. "O banco está lento" —
provavelmente não é o banco. Isolar sistematicamente: dividir o sistema
ao meio, testar cada metade. O bug mora na fronteira que você menos
suspeita.

---

## Workflow — Ciclo DEBUG

```
┌──────────────────────────────────────────────────────┐
│                                                      │
│  1. OBSERVE    →  Coletar evidências                 │
│  2. REPRODUCE  →  Reproduzir o bug de forma confiável│
│  3. ISOLATE    →  Reduzir o espaço de busca          │
│  4. DIAGNOSE   →  Encontrar a causa raiz             │
│  5. FIX        →  Corrigir com confiança             │
│  6. VERIFY     →  Confirmar o fix + prevenir recidiva│
│                                                      │
└──────────────────────────────────────────────────────┘
```

### Fase 1 — Observe (Coletar Evidências)

Consultar `references/log-analysis.md` para análise de logs.
Consultar `references/stack-traces.md` para leitura de stack traces.

ANTES de tocar no código, coletar:

```
Checklist de Evidências:
├── QUEM reportou? (user, monitoring, teste)
├── QUANDO aconteceu? (timestamp exato, timezone)
├── O QUE aconteceu? (mensagem de erro, comportamento esperado vs real)
├── ONDE aconteceu? (endpoint, página, ambiente — dev/staging/prod)
├── COM QUE frequência? (sempre, intermitente, só em prod, só com dados X)
├── O QUE mudou? (deploy recente, migração, config, infra, dependência)
├── Logs relevantes (request ID, stack trace, query log)
└── Screenshots / gravação se visual
```

### Fase 2 — Reproduce (Reproduzir)

O passo MAIS IMPORTANTE. Sem reprodução, todo o resto é chute.

```
Estratégias de reprodução (do mais fácil ao mais difícil):

1. Reprodução direta
   "Faça X e o erro Y acontece" → executar X e observar

2. Reprodução com dados específicos
   "Acontece com user Z" → usar dados/estado do user Z

3. Reprodução por ambiente
   "Só acontece em prod" → comparar env vars, dados, versões, infra

4. Reprodução por carga
   "Acontece sob carga" → load test local (k6, Artillery)

5. Reprodução por timing
   "Acontece às vezes" → race condition → adicionar logs em pontos
   chave, usar slow-mo, injetar delays artificiais

6. Reprodução por estado
   "Acontece depois de X horas" → memory leak → monitorar heap ao
   longo do tempo

Se NÃO consegue reproduzir:
├── Aumentar logging temporariamente no ponto suspeito
├── Adicionar métricas/traces no ponto suspeito
├── Pedir dados exatos do cenário que falhou (request ID, payload)
└── Monitorar até próxima ocorrência (alert + capture)
```

### Fase 3 — Isolate (Reduzir Espaço de Busca)

Consultar `references/debug-methodology.md` para método científico e bisection.

```
Técnicas de isolamento:

Binary Search (bisection):
├── O bug está no frontend ou backend? → Testar API direto (curl/Postman)
├── Backend: controller, service ou DB? → Testar cada camada separada
├── Service: qual método? → Adicionar log entre cada chamada
├── git bisect → Encontrar o commit que introduziu o bug

Eliminação de variáveis:
├── Remover middleware e testar
├── Trocar implementação por stub
├── Usar dados hardcoded ao invés de DB
├── Trocar ambiente (local vs Docker vs cloud)
├── Testar com user diferente, browser diferente
└── Simplificar o input até o caso mínimo que falha
```

### Fase 4 — Diagnose (Causa Raiz)

Consultar referência específica por tipo de bug:
- **Stack trace / error** → `references/stack-traces.md`
- **Lentidão / query lenta** → `references/performance-debugging.md`
- **Memory leak / OOM** → `references/memory-leaks.md`
- **Intermitente / race condition** → `references/race-conditions.md`

```
Perguntas que levam à causa raiz:

"O que mudou?"
  → Último deploy, migration, config change, dependency update

"Quando começou?"
  → Correlacionar com deployments, eventos, picos de tráfego

"Por que funciona em 99% dos casos?"
  → O 1% tem dados diferentes, timing diferente, estado diferente

"O que EXATAMENTE é null/undefined?"
  → Rastrear de onde vem: quem seta, quem consome, quando desaparece

"Funciona se eu remover X?"
  → Se sim, X é o culpado ou interage com o culpado
```

### Fase 5 — Fix (Corrigir)

```
Regras do fix:
├── Fix na CAUSA, não no SINTOMA
│   ❌ try/catch que engole o erro
│   ✅ Corrigir por que o dado é null
│
├── Menor mudança possível
│   ❌ Refatorar 5 arquivos para corrigir 1 bug
│   ✅ Fix cirúrgico + issue separada para refactor
│
├── Escrever TESTE que reproduz o bug ANTES do fix
│   O teste deve falhar → aplicar fix → teste passa
│   Isso garante que o bug nunca volta (regressão)
│
└── Code review do fix
    Quando se está sob pressão, erros são mais prováveis
    Pedir review mesmo (principalmente) se é hotfix
```

### Fase 6 — Verify (Confirmar + Prevenir)

```
Após o fix:
├── O teste de regressão passa?
├── Testou no mesmo cenário/dados que falhava?
├── Testou edge cases próximos?
├── Funciona no ambiente onde o bug ocorria? (staging/prod)
├── Monitorou por 24h após deploy do fix?
└── Documentou o bug + root cause + fix? (para o futuro)

Prevenir recidiva:
├── Adicionar teste automático (unit ou integration)
├── Adicionar monitoring/alerting para o cenário
├── Melhorar validação de input se o bug veio de dados inesperados
├── Adicionar log se o bug era difícil de diagnosticar
└── Atualizar runbook se o bug é recorrente/operacional
```

---

## Diagnóstico Rápido — Tipo de Bug → Abordagem

```
Erro visto...                        Tipo provável        Referência
────────────────────────────────────────────────────────────────────
TypeError / null / undefined         Dados faltantes       stack-traces.md
500 Internal Server Error            Exception no server   stack-traces.md + log-analysis.md
504 Gateway Timeout                  Lentidão/deadlock     performance-debugging.md
CORS error no browser                Config errada         stack-traces.md (seção CORS)
"Funciona local, não em prod"        Env/config/dados      debug-methodology.md
Intermitente / "às vezes"            Race condition         race-conditions.md
Fica lento com o tempo               Memory leak           memory-leaks.md
Query lenta / N+1                    DB performance        performance-debugging.md
OOM Killed / heap out of memory      Memory leak           memory-leaks.md
Deadlock / hang / trava              Concorrência          race-conditions.md
Hydration mismatch (React/Next)      SSR vs client state   stack-traces.md
Tela branca / white screen           JS error no render    stack-traces.md (seção frontend)
Build passa, runtime falha           Tipagem / env         debug-methodology.md
Dados inconsistentes no banco        Race / transaction    race-conditions.md
```

---

## Postura do Debugger

```
Investigador, não bombeiro.
├── Não panicar. Bug em produção é urgente, mas pânico gera fixes ruins.
├── Coletar antes de agir. 5 min de logs economiza 2h de tentativa e erro.
├── Perguntar antes de assumir. "O que te faz acreditar que é o banco?"
├── Não culpar. "O código fez X" não "O dev João fez X".
├── Ser transparente. "Não sei ainda, mas estou investigando Y" é melhor
│   que silêncio ou "deve ser Z" sem evidência.
├── Documentar tudo. O próximo debugger pode ser você daqui a 6 meses.
└── Post-mortem sem blame. O objetivo é que o bug não volte, não punir.

Nível de urgência:
├── 🔴 Produção down / data loss → Mitigar primeiro (rollback, feature flag),
│                                    investigar depois
├── 🟠 Bug em prod, não-crítico → Reproduzir → Investigar → Fix no sprint
├── 🟡 Bug em staging/dev → Reproduzir → Investigar → Fix normal
└── ⚪ Bug cosmético → Backlog, fix quando conveniente
```

---

## Regras de Ouro

1. **Reproduzir primeiro, investigar depois** — Bug que não reproduz não tem fix confiável.
2. **Ler a mensagem de erro** — Parece óbvio, mas 40% dos bugs se resolvem lendo o erro com atenção.
3. **O que mudou?** — A pergunta mais poderosa. Deploy? Config? Dependency? Dados?
4. **Desconfiar de si mesmo** — "Isso é impossível" significa "não entendi o que acontece".
5. **Binary search** — Dividir e conquistar. Cortar o problema ao meio, repetir.
6. **Mínimo caso reproduzível** — Remover tudo que não é necessário para o bug existir.
7. **Teste antes do fix** — Escrever teste que falha → fix → teste passa. Nunca volta.
8. **Fix na causa, não no sintoma** — `try/catch` que engole erro é band-aid, não fix.
9. **Log é seu melhor amigo** — Quando não sabe por onde começar, adicione log.
10. **O bug intermitente tem trigger** — Não existe "aleatório" em código. Tem timing, estado, ou dados que você ainda não identificou.
11. **Rubber duck** — Explicar o problema em voz alta (ou escrevendo) revela a resposta em 30% dos casos.
12. **Sair e voltar** — Se está há 2h sem progresso, parar 15 min. O cérebro processa em background.

---

## Ferramentas por Ecossistema

| Ferramenta | Para quê | Ecossistema |
|-----------|---------|-------------|
| Chrome DevTools | Frontend, network, memory, performance | Browser |
| React DevTools | Component tree, state, renders | React |
| `node --inspect` | Debugger step-by-step, breakpoints | Node.js |
| `pdb` / `ipdb` | Debugger interativo Python | Python |
| `EXPLAIN ANALYZE` | Query plan, performance SQL | PostgreSQL |
| `htop` / `top` | CPU, memória, processos | Linux |
| `strace` / `ltrace` | System calls, library calls | Linux |
| Heap snapshot | Memory leak analysis | Node.js / Chrome |
| Flame graph | CPU profiling visual | Qualquer |
| `git bisect` | Encontrar commit que introduziu bug | Git |
| `tcpdump` / `ngrep` | Network debugging | Linux |
| Sentry / Datadog | Error tracking, APM | Multi |

---

## Referências Bundled

| Arquivo | Quando consultar |
|---------|-----------------|
| `references/debug-methodology.md` | Método científico, binary search, git bisect, rubber duck, 5 whys, checklist por ambiente |
| `references/stack-traces.md` | Ler stack traces JS/TS/Python, erros comuns, CORS, hydration, frontend white screen |
| `references/log-analysis.md` | Ler logs, grep patterns, correlação por requestId, structured logging, ferramentas |
| `references/memory-leaks.md` | Detectar e corrigir leaks em Node.js, browser, Python. Heap snapshots, GC, patterns |
| `references/race-conditions.md` | Concorrência, deadlocks, race conditions, async pitfalls, DB transactions, locks |
| `references/performance-debugging.md` | Slow queries, N+1, EXPLAIN ANALYZE, CPU profiling, flame graph, connection pool |

**Fluxo de leitura:** Começar por `debug-methodology` (o método). Depois, ir para a referência
do TIPO de bug (stack trace, memory, race condition, performance).
