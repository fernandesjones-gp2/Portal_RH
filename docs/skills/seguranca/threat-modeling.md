# Threat Modeling — STRIDE, Attack Surface e Data Flow

## Índice
1. Por Que Threat Model
2. STRIDE Framework
3. Data Flow Diagram (DFD)
4. Trust Boundaries
5. Attack Surface Mapping
6. Threat Model Template
7. Priorização de Ameaças (DREAD)

---

## 1. Por Que Threat Model

```
Threat modeling responde 4 perguntas:

1. O que estamos construindo?      → DFD (Data Flow Diagram)
2. O que pode dar errado?           → STRIDE por componente
3. O que vamos fazer sobre isso?    → Controles / mitigações
4. Fizemos um bom trabalho?         → Validação / teste

Quando fazer:
├── Início do projeto (antes de codar)
├── Adição de feature com dados sensíveis
├── Nova integração com terceiro
├── Mudança de arquitetura significativa
├── Pré-audit de segurança
└── Após incidente (retrospecção)
```

---

## 2. STRIDE Framework

Cada letra é uma categoria de ameaça. Aplicar a CADA componente do sistema:

```
S — Spoofing (Falsificação de identidade)
    "Alguém pode fingir ser quem não é?"
    Exemplos: Forjar token JWT, roubar sessão, phishing
    Controles: Autenticação forte, MFA, token validation

T — Tampering (Adulteração)
    "Alguém pode modificar dados em trânsito ou em repouso?"
    Exemplos: Man-in-the-middle, modificar request body, alterar DB
    Controles: HTTPS, HMAC, integrity checks, input validation

R — Repudiation (Repúdio / Negação)
    "Alguém pode negar que fez algo?"
    Exemplos: User nega que fez a compra, admin nega que deletou dados
    Controles: Audit logs, timestamps, assinaturas digitais, non-repudiation

I — Information Disclosure (Vazamento de informação)
    "Dados sensíveis podem ser expostos?"
    Exemplos: Stack trace no erro, PII no log, backup sem criptografia
    Controles: Criptografia, data masking, erro genérico, least privilege

D — Denial of Service (Negação de serviço)
    "Alguém pode derrubar ou degradar o sistema?"
    Exemplos: Request flood, query pesada, upload gigante, regex DoS
    Controles: Rate limiting, timeouts, circuit breaker, WAF

E — Elevation of Privilege (Escalação de privilégio)
    "Alguém pode acessar mais do que deveria?"
    Exemplos: User vira admin, IDOR (acessar recurso de outro), bypass de authz
    Controles: RBAC, ownership checks, least privilege, defense in depth
```

### Como aplicar STRIDE

```
Para CADA componente no DFD, perguntar cada letra:

Componente: API de Orders
├── S: Alguém sem login pode criar order?          → Auth middleware obrigatório
├── T: O body do request pode ser adulterado?       → Validação de schema (Zod)
├── R: User pode negar que criou o pedido?          → Audit log com userId + timestamp
├── I: O response expõe dados de outros users?      → Ownership check (IDOR protection)
├── D: Podem sobrecarregar com requests?            → Rate limiting
└── E: User pode criar order com role de admin?     → RBAC no controller

Componente: Banco de Dados
├── S: Alguém pode conectar com credenciais roubadas? → Secrets em vault, rotate
├── T: Queries podem ser manipuladas?                 → Parameterized queries APENAS
├── R: Alterações podem ser rastreadas?               → Audit trail (created_by, updated_by)
├── I: Backups podem ser acessados?                   → Criptografia at rest
├── D: Query pesada pode travar o banco?              → Query timeout, connection pool limit
└── E: App user pode executar DDL?                    → DB user com mínimo de permissões
```

---

## 3. Data Flow Diagram (DFD)

```
Componentes de um DFD:

[Entidade Externa]  →  Quem interage com o sistema (user, API terceiro)
(Processo)          →  Código que processa dados (API, worker, service)
[Data Store]        →  Onde dados são armazenados (DB, Redis, S3)
  ───────→          →  Fluxo de dados (com label do que trafega)
--- --- ---         →  Trust boundary (fronteira de confiança)
```

### Exemplo: E-commerce

```
                    INTERNET (não confiável)
┌─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐

  [Browser]  ──── HTTPS ────→  [Nginx/CDN]
  [Mobile]   ──── HTTPS ────→  [Nginx/CDN]
  [Webhook Stripe] ─ HTTPS ─→  [Nginx/CDN]

└─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘
                    DMZ
┌─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐

  [Nginx/CDN] ── HTTP ──→ (API Server)

└─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘
                    REDE INTERNA
┌─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐

  (API Server) ──→ [PostgreSQL]    dados de users, orders, products
  (API Server) ──→ [Redis]         sessions, cache, rate limits
  (API Server) ──→ [Queue/Worker]  emails, webhooks
  (Worker)     ──→ [SendGrid API]  envio de emails
  (API Server) ──→ [Stripe API]    pagamentos

└─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘
```

---

## 4. Trust Boundaries

```
Trust boundary = linha onde o nível de confiança muda.

Cada cruzamento de boundary é um ponto de validação obrigatória:

Boundary 1: Internet → DMZ
  Tudo é não-confiável. WAF, TLS, rate limiting.

Boundary 2: DMZ → App
  Validar headers, autenticar, sanitizar input.

Boundary 3: App → Database
  Parameterized queries, least privilege, connection encrypted.

Boundary 4: App → API externa
  Validar response, timeout, certificate pinning.

Boundary 5: Upload do user → Storage
  Validar tipo, tamanho, nome, escanear malware.
```

---

## 5. Attack Surface Mapping

```markdown
## Attack Surface — [Projeto]

### Endpoints Públicos (sem auth)
| Endpoint | Método | Dados aceitos | Risco |
|---------|--------|--------------|-------|
| /api/auth/register | POST | name, email, password | Brute force, enumeration |
| /api/auth/login | POST | email, password | Brute force, credential stuffing |
| /api/auth/reset-password | POST | email | Email enumeration |
| /api/products | GET | query params | Info disclosure, DoS via query |
| /api/webhooks/stripe | POST | Stripe event payload | Spoofing, replay attack |

### Endpoints Autenticados (com auth)
| Endpoint | Método | Authz | Risco |
|---------|--------|-------|-------|
| /api/orders | POST | user | IDOR, injection via items |
| /api/orders/:id | GET | owner or admin | IDOR |
| /api/users/:id | PATCH | owner or admin | Mass assignment, privilege escalation |
| /api/admin/* | ALL | admin only | Privilege escalation |

### Inputs de Dados
| Input | Tipo | Sanitização | Risco |
|-------|------|------------|-------|
| File upload | Imagens | Tipo, tamanho, rename | Path traversal, malware |
| Search query | String | Escape, limit | SQL injection, ReDoS |
| URL callback | URL | Whitelist | SSRF |

### Integrações Externas
| Serviço | Dados enviados | Dados recebidos | Risco |
|---------|---------------|----------------|-------|
| Stripe | Valor, metadata | Charge status | API key leak, webhook spoof |
| SendGrid | Email, nome, conteúdo | Status | PII em trânsito |
| AWS S3 | Arquivos | URLs | Bucket público, path traversal |
```

---

## 6. Threat Model Template

```markdown
# Threat Model — [Feature/Componente]

**Data:** YYYY-MM-DD
**Autor:** [nome]
**Escopo:** [o que está sendo modelado]

## Ativos
1. **Dados de usuário** — nome, email, senha hash, endereço
2. **Dados de pagamento** — tokens Stripe (não armazenamos cartão)
3. **Sessões/Tokens** — JWT access + refresh tokens
4. **Dados de pedidos** — histórico, valores, status

## Diagrama de Fluxo
[DFD do componente]

## Ameaças (STRIDE)

| ID | Categoria | Ameaça | Componente | Impacto | Probabilidade | Mitigação |
|----|----------|--------|-----------|---------|--------------|-----------|
| T1 | Spoofing | Token JWT forjado | API | Alto | Baixa | HS256 com secret forte, verificar alg |
| T2 | Injection | SQL injection no search | DB | Crítico | Média | Parameterized queries |
| T3 | IDOR | User acessa order de outro | API | Alto | Alta | Ownership check |
| T4 | Info Disc. | Stack trace no erro 500 | API | Médio | Alta | Error handler genérico |
| T5 | DoS | Upload de 1GB | Storage | Médio | Média | Max file size 10MB |
| T6 | Elevation | Mass assignment no PATCH | API | Alto | Média | Whitelist de campos |

## Mitigações Implementadas
- [x] T2: Todas queries usam Prisma (parameterized)
- [x] T4: Error handler global retorna mensagem genérica
- [ ] T1: Secret JWT é string curta — trocar para 64+ chars
- [ ] T3: Sem ownership check — CRÍTICO, implementar
- [ ] T5: Sem limit de upload — implementar
- [ ] T6: PATCH aceita qualquer campo — implementar whitelist
```

---

## 7. Priorização de Ameaças (DREAD)

```
DREAD Score = (D + R + E + A + D) / 5

D — Damage:          Quanto dano se explorado? (1-10)
R — Reproducibility:  Quão fácil de reproduzir? (1-10)
E — Exploitability:   Quão fácil de explorar? (1-10)
A — Affected Users:   Quantos usuários afetados? (1-10)
D — Discoverability:  Quão fácil de descobrir? (1-10)

Exemplo:
SQL Injection no login:
  Damage=10, Reproducibility=10, Exploitability=8,
  Affected=10, Discoverability=8 → Score: 9.2 → CRITICAL

Header X-Frame-Options ausente:
  Damage=3, Reproducibility=10, Exploitability=3,
  Affected=2, Discoverability=8 → Score: 5.2 → MEDIUM
```
