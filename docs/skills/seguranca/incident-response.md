# Incident Response — Detection, Logging, Alertas e Response

## Índice
1. Security Logging
2. O Que Logar (e O Que Não)
3. Detecção de Anomalias
4. Alertas de Segurança
5. Incident Response Plan
6. Classificação de Incidentes
7. Post-Mortem de Segurança

---

## 1. Security Logging

```javascript
// Eventos de segurança que DEVEM ser logados:

const SECURITY_EVENTS = {
  // Autenticação
  'auth.login.success':     { level: 'info',  alert: false },
  'auth.login.failure':     { level: 'warn',  alert: true, threshold: 5 },
  'auth.token.expired':     { level: 'info',  alert: false },
  'auth.token.invalid':     { level: 'warn',  alert: true, threshold: 10 },
  'auth.mfa.failure':       { level: 'warn',  alert: true, threshold: 3 },
  'auth.password.reset':    { level: 'info',  alert: false },

  // Autorização
  'authz.denied':           { level: 'warn',  alert: true, threshold: 5 },
  'authz.idor.attempt':     { level: 'warn',  alert: true, threshold: 3 },
  'authz.admin.access':     { level: 'info',  alert: false },

  // Input
  'input.validation.failed':  { level: 'info',  alert: false },
  'input.injection.detected': { level: 'error', alert: true, threshold: 1 },
  'input.xss.detected':       { level: 'error', alert: true, threshold: 1 },

  // Rate limiting
  'rate.limit.hit':          { level: 'warn',  alert: true, threshold: 10 },
  'rate.limit.auth.hit':     { level: 'warn',  alert: true, threshold: 3 },

  // Dados
  'data.export.requested':   { level: 'info',  alert: false },
  'data.deletion.requested': { level: 'info',  alert: true, threshold: 1 },
  'data.bulk.access':        { level: 'warn',  alert: true, threshold: 1 },

  // Sistema
  'system.config.changed':   { level: 'warn',  alert: true, threshold: 1 },
  'system.dependency.cve':   { level: 'error', alert: true, threshold: 1 },
  'system.error.unhandled':  { level: 'error', alert: true, threshold: 5 },
};
```

### Formato do log de segurança

```javascript
function securityLog(event, details) {
  const config = SECURITY_EVENTS[event];
  const entry = {
    timestamp: new Date().toISOString(),
    event,
    level: config.level,
    requestId: details.requestId,
    userId: details.userId || 'anonymous',
    ip: details.ip,
    userAgent: details.userAgent,
    path: details.path,
    method: details.method,
    // Contexto específico (sem PII)
    ...sanitizeForLog(details.context || {}),
  };

  logger[config.level]('SECURITY', entry);

  // Enviar para SIEM/alerting se configurado
  if (config.alert) {
    checkAlertThreshold(event, details);
  }
}

// Uso
securityLog('auth.login.failure', {
  requestId: req.id,
  ip: req.ip,
  userAgent: req.headers['user-agent'],
  path: req.path,
  method: req.method,
  context: { email: maskEmail(email), reason: 'invalid_password' },
});
```

---

## 2. O Que Logar (e O Que Não)

```
SEMPRE logar:
├── Quem (userId ou "anonymous")
├── Quando (timestamp ISO 8601 UTC)
├── O quê (ação/evento)
├── De onde (IP, user-agent)
├── Resultado (success/failure)
├── Request ID (correlação)
└── Contexto relevante (endpoint, parâmetros sanitizados)

NUNCA logar:
├── Passwords (plain text ou hash)
├── Tokens (JWT, API keys, secrets)
├── Dados de cartão (PCI compliance)
├── CPF completo (LGPD)
├── Dados de saúde (LGPD dados sensíveis)
├── Request/response body completo (pode conter PII)
└── Stack traces em produção para o CLIENT (ok para log interno)
```

---

## 3. Detecção de Anomalias

```javascript
// Patterns que indicam ataque:

const ANOMALY_RULES = [
  {
    name: 'brute_force_login',
    event: 'auth.login.failure',
    window: 300,    // 5 minutos
    threshold: 10,  // 10 falhas
    groupBy: 'ip',  // Por IP
    action: 'block_ip_temp', // Bloquear temporariamente
  },
  {
    name: 'credential_stuffing',
    event: 'auth.login.failure',
    window: 3600,   // 1 hora
    threshold: 50,  // 50 tentativas em contas diferentes
    groupBy: 'ip',
    action: 'block_ip_alert',
  },
  {
    name: 'idor_scan',
    event: 'authz.denied',
    window: 60,     // 1 minuto
    threshold: 10,  // 10 tentativas de IDOR
    groupBy: 'userId',
    action: 'alert_security_team',
  },
  {
    name: 'injection_attempt',
    event: 'input.injection.detected',
    window: 60,
    threshold: 1,   // Qualquer tentativa
    groupBy: 'ip',
    action: 'block_ip_alert',
  },
  {
    name: 'data_exfiltration',
    event: 'data.bulk.access',
    window: 3600,
    threshold: 5,   // 5 exports em 1 hora
    groupBy: 'userId',
    action: 'alert_security_team',
  },
];

// Implementação com Redis (sliding window)
async function checkAlertThreshold(event, details) {
  for (const rule of ANOMALY_RULES.filter(r => r.event === event)) {
    const key = `anomaly:${rule.name}:${details[rule.groupBy]}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, rule.window);

    if (count >= rule.threshold) {
      await executeAction(rule.action, details, rule);
    }
  }
}

async function executeAction(action, details, rule) {
  switch (action) {
    case 'block_ip_temp':
      await redis.set(`blocked:${details.ip}`, '1', 'EX', 900); // 15min
      logger.error('IP blocked', { ip: details.ip, rule: rule.name });
      break;
    case 'block_ip_alert':
      await redis.set(`blocked:${details.ip}`, '1', 'EX', 3600);
      await notifySecurityTeam(rule, details);
      break;
    case 'alert_security_team':
      await notifySecurityTeam(rule, details);
      break;
  }
}
```

---

## 4. Alertas de Segurança

```
Canais de alerta por severidade:

CRITICAL (resposta imediata):
├── SMS/ligação para on-call
├── Slack #security-incidents (com @channel)
├── PagerDuty / OpsGenie
└── Exemplos: SQL injection detectada, data breach, auth bypass

HIGH (resposta em horas):
├── Slack #security-alerts
├── Email para security team
└── Exemplos: Brute force sustentado, CVE critical em dependência

MEDIUM (resposta em dias):
├── Slack #security-alerts (sem mention)
├── Ticket no board
└── Exemplos: Rate limit hit frequente, IDOR attempts

LOW (review periódico):
├── Dashboard de segurança
├── Review semanal
└── Exemplos: Headers ausentes, config warnings
```

---

## 5. Incident Response Plan

```markdown
# Incident Response Plan

## Fase 1 — Detecção (DETECT)
1. Alerta recebido (monitoring, user report, dependency alert)
2. Classificar severidade (ver seção 6)
3. Abrir canal de incidente (#incident-YYYY-MM-DD)
4. Notificar: Incident Commander (IC), Security Lead, CTO

## Fase 2 — Contenção (CONTAIN)
**Objetivo:** Parar o sangramento. Não investigar ainda.

Ações imediatas (primeiros 15 minutos):
├── Bloquear IP/user se ataque ativo
├── Revogar tokens/API keys comprometidos
├── Isolar sistema afetado (se possível sem derrubar tudo)
├── Preservar evidências (não deletar logs!)
└── Comunicar status para stakeholders

## Fase 3 — Erradicação (ERADICATE)
**Objetivo:** Remover a causa raiz.

├── Identificar vetor de ataque exato
├── Aplicar fix (patch, config, code)
├── Rotate ALL secrets que podem ter sido comprometidos
├── Scan completo por indicadores de comprometimento
├── Verificar se atacante deixou backdoor
└── Confirmar que o fix resolve o vetor

## Fase 4 — Recuperação (RECOVER)
**Objetivo:** Voltar ao normal com confiança.

├── Restaurar serviços com fix aplicado
├── Monitorar intensivamente por 24-72h
├── Verificar integridade dos dados
├── Re-habilitar funcionalidades desabilitadas
└── Comunicar resolução para stakeholders

## Fase 5 — Lições Aprendidas (LEARN)
**Objetivo:** Não repetir.

├── Post-mortem em até 5 dias úteis
├── Timeline detalhada do incidente
├── Root cause analysis (5 Whys)
├── Action items com owners e deadlines
├── Atualizar runbooks e alertas
└── Compartilhar aprendizados (blameless)
```

---

## 6. Classificação de Incidentes

| Severidade | Definição | SLA Response | Exemplos |
|-----------|----------|-------------|---------|
| **SEV-1** | Data breach confirmado, sistema comprometido | 15 min | Acesso não-autorizado a DB, ransomware, data leak |
| **SEV-2** | Vulnerabilidade sendo explorada ativamente | 1 hora | Brute force massivo, DDoS, injection em produção |
| **SEV-3** | Vulnerabilidade descoberta mas não explorada | 24 horas | CVE critical em dependência, misconfiguration |
| **SEV-4** | Risco baixo, melhoria de segurança | 1 semana | Header ausente, política de senha fraca |

---

## 7. Post-Mortem de Segurança

```markdown
# Post-Mortem: [Título do Incidente]

**Data do incidente:** YYYY-MM-DD HH:mm UTC
**Duração:** X horas
**Severidade:** SEV-N
**IC (Incident Commander):** [nome]

## Resumo
[2-3 frases sobre o que aconteceu e o impacto]

## Timeline
| Hora (UTC) | Evento |
|------------|--------|
| 14:30 | Alerta de brute force no login |
| 14:35 | IC acionado, canal de incidente aberto |
| 14:40 | Identificado: 50K tentativas de login de botnet |
| 14:45 | Rate limiting endurecido, IPs bloqueados |
| 15:00 | Ataque contido, monitoramento intensivo |
| 15:30 | Confirmado: nenhuma conta comprometida |
| 16:00 | Incidente encerrado |

## Root Cause
Rate limiting do endpoint de login permitia 100 req/min por IP.
Atacante usou 200+ IPs distintos (botnet) para distribuir o ataque.
Total: ~50K tentativas em 10 minutos contra ~500 emails.

## Impacto
- 12 contas tiveram lockout temporário por excesso de tentativas
- Nenhuma conta comprometida (senhas fortes + bcrypt)
- 0 dados vazados

## O Que Deu Certo ✅
- Alerta de brute force disparou em 5 minutos
- bcrypt impediu login mesmo em senhas fracas (10ms por tentativa vs 50K tentativas)
- Logs detalhados permitiram análise rápida

## O Que Falhou ❌
- Rate limiting per-IP insuficiente contra botnet distribuída
- Sem rate limiting per-account (apenas per-IP)
- Sem CAPTCHA após N tentativas falhadas

## Action Items
| # | Ação | Owner | Deadline | Status |
|---|------|-------|---------|--------|
| 1 | Adicionar rate limiting per-account (5/15min) | @dev | D+3 | Done |
| 2 | Implementar CAPTCHA após 3 falhas | @frontend | D+7 | In progress |
| 3 | Bloquear IPs de botnets conhecidas (WAF) | @infra | D+5 | Done |
| 4 | Avaliar serviço anti-bot (Cloudflare Bot Management) | @security | D+14 | To do |
```
