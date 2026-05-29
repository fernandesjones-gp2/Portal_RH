# Requirements Template — Especificação de Requisitos

## Índice
1. Estrutura do Documento
2. Requisitos Funcionais (User Stories)
3. Requisitos Não-Funcionais
4. Regras de Negócio
5. Escopo Negativo
6. Template Completo

---

## 1. Estrutura do Documento

O documento de requisitos é o contrato entre "o que foi entendido" e
"o que será construído". Cada item deve ser:

- **Verificável**: Dá pra testar se foi implementado corretamente
- **Não-ambíguo**: Uma pessoa lê e não tem dúvida do que significa
- **Rastreável**: Cada requisito tem um ID para referência futura
- **Priorizado**: P0 (MVP), P1 (importante), P2 (nice-to-have)

---

## 2. Requisitos Funcionais (User Stories)

### Formato padrão

```markdown
### RF-[módulo]-[número]: [Título curto]

**Como** [persona/ator],
**eu quero** [ação/funcionalidade],
**para** [benefício/valor].

**Prioridade:** P0 | P1 | P2
**Complexidade estimada:** Baixa | Média | Alta

**Critérios de Aceite:**
- [ ] Dado que [contexto], quando [ação], então [resultado esperado]
- [ ] Dado que [contexto], quando [ação], então [resultado esperado]
- [ ] [Edge case ou validação específica]

**Notas:**
- [Observação técnica ou de negócio relevante]
```

### Exemplo

```markdown
### RF-AUTH-001: Cadastro de novo usuário

**Como** visitante do site,
**eu quero** criar uma conta com email e senha,
**para** acessar as funcionalidades do sistema.

**Prioridade:** P0
**Complexidade estimada:** Média

**Critérios de Aceite:**
- [ ] Dado que informo email válido e senha com 8+ chars, quando submeto o form, então a conta é criada
- [ ] Dado que informo email já cadastrado, quando submeto, então vejo erro "Email já em uso"
- [ ] Dado que a senha tem menos de 8 chars, quando submeto, então vejo erro de validação
- [ ] Após cadastro, recebo email de confirmação
- [ ] Não posso acessar o sistema sem confirmar o email

**Notas:**
- Senha deve ter mínimo 8 caracteres, 1 maiúscula, 1 número
- Email de confirmação expira em 24h
- Considerar OAuth2 em P2
```

### Agrupamento por módulo

Organizar user stories por módulo funcional:

```
Módulo: Autenticação (AUTH)
├── RF-AUTH-001: Cadastro
├── RF-AUTH-002: Login
├── RF-AUTH-003: Logout
├── RF-AUTH-004: Reset de senha
└── RF-AUTH-005: OAuth2 (P2)

Módulo: Gestão de Produtos (PROD)
├── RF-PROD-001: Listar produtos
├── RF-PROD-002: Criar produto
├── RF-PROD-003: Editar produto
└── RF-PROD-004: Excluir produto
```

---

## 3. Requisitos Não-Funcionais

### Template por categoria

```markdown
### Performance
| ID | Requisito | Meta | Como medir |
|----|-----------|------|-----------|
| RNF-PERF-001 | Tempo de resposta da API | < 200ms (p95) | APM / Load test |
| RNF-PERF-002 | Tempo de carregamento da página | < 3s (LCP) | Lighthouse |
| RNF-PERF-003 | Suportar N usuários simultâneos | [definir] | Load test |

### Segurança
| ID | Requisito | Implementação |
|----|-----------|---------------|
| RNF-SEC-001 | Senhas armazenadas com hash | bcrypt (cost 12+) |
| RNF-SEC-002 | Comunicação HTTPS | TLS 1.2+ |
| RNF-SEC-003 | Proteção contra OWASP Top 10 | CSRF, XSS, SQLi, etc. |
| RNF-SEC-004 | Rate limiting | [X] req/min por IP |
| RNF-SEC-005 | LGPD compliance | Consentimento, exclusão, portabilidade |

### Escalabilidade
| ID | Requisito | Estratégia |
|----|-----------|-----------|
| RNF-SCAL-001 | Horizontal scaling | Stateless services |
| RNF-SCAL-002 | Database scaling | Read replicas / sharding |

### Disponibilidade
| ID | Requisito | Meta |
|----|-----------|------|
| RNF-AVAIL-001 | Uptime | 99.9% (8.7h downtime/ano) |
| RNF-AVAIL-002 | RTO (Recovery Time Objective) | < 1h |
| RNF-AVAIL-003 | RPO (Recovery Point Objective) | < 5min |

### Usabilidade
| ID | Requisito | Meta |
|----|-----------|------|
| RNF-UX-001 | Responsivo mobile | Funcional em 320px+ |
| RNF-UX-002 | Acessibilidade | WCAG 2.1 AA |
| RNF-UX-003 | i18n | Suporte a pt-BR (+ en-US futuro?) |

### Observabilidade
| ID | Requisito | Ferramenta sugerida |
|----|-----------|-------------------|
| RNF-OBS-001 | Logs estruturados | [a definir] |
| RNF-OBS-002 | Métricas de aplicação | [a definir] |
| RNF-OBS-003 | Tracing distribuído | [a definir] |
| RNF-OBS-004 | Alertas | [a definir] |
```

---

## 4. Regras de Negócio

Regras que o sistema precisa enforçar independentemente da interface.

### Formato

```markdown
### RN-[módulo]-[número]: [Título]

**Regra:** [Descrição precisa da regra]

**Quando se aplica:** [Contexto/trigger]

**Exceções:** [Se houver]

**Exemplo:**
- Entrada: [input]
- Resultado: [output]
```

### Exemplo

```markdown
### RN-ORD-001: Cálculo de frete grátis

**Regra:** Pedidos acima de R$ 200,00 têm frete grátis para regiões Sul e Sudeste.

**Quando se aplica:** No momento do cálculo do carrinho e no checkout.

**Exceções:**
- Produtos da categoria "Oversized" nunca têm frete grátis
- Promoções podem alterar o valor mínimo temporariamente

**Exemplo:**
- Pedido de R$ 250 para SP → Frete grátis
- Pedido de R$ 250 para AM → Frete cobrado (região Norte)
- Pedido de R$ 150 para SP → Frete cobrado (abaixo de R$ 200)
```

---

## 5. Escopo Negativo

Tão importante quanto definir o que entra é definir o que NÃO entra.

```markdown
## Fora do Escopo

| Feature / Capacidade | Por que está fora | Quando pode entrar |
|---------------------|-------------------|--------------------|
| App mobile nativo | MVP é web-only, mobile via PWA | v2, se houver demanda |
| Multi-idioma | Foco no mercado brasileiro | v2, se expandir |
| Marketplace | Complexidade alta, baixo ROI inicial | Após validar modelo |
| Integração com ERP X | Sem API disponível, negociação em andamento | Quando API estiver pronta |
| Chat em tempo real | Não é core do produto | P2 ou nunca |
```

---

## 6. Template Completo

```markdown
# 02 — Requisitos

## Resumo
> [Frase resumindo o escopo do sistema]

**Total de requisitos:**
- Funcionais: [X] (P0: [Y], P1: [Z], P2: [W])
- Não-funcionais: [X]
- Regras de negócio: [X]

---

## Requisitos Funcionais

### Módulo: [Nome] ([SIGLA])

#### RF-[SIGLA]-001: [Título]
(... seguir formato de user story ...)

---

## Requisitos Não-Funcionais

### Performance
(... tabela ...)

### Segurança
(... tabela ...)

### Escalabilidade
(... tabela ...)

### Disponibilidade
(... tabela ...)

---

## Regras de Negócio

### RN-[SIGLA]-001: [Título]
(... seguir formato ...)

---

## Fora do Escopo
(... tabela ...)

---

## Glossário
| Termo | Definição |
|-------|-----------|
| [Termo do domínio] | [Definição clara] |

---

## Rastreabilidade
| ID | Documento Origem | Seção |
|----|-----------------|-------|
| RF-AUTH-001 | 01-discovery.md | Fluxo de cadastro |
```
