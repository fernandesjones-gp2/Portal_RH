# Data Privacy — LGPD, GDPR, PII, Criptografia

## Índice
1. LGPD — Resumo Prático para Devs
2. Classificação de Dados
3. PII Handling
4. Criptografia — At Rest e In Transit
5. Data Retention e Deletion
6. Logging Seguro
7. Checklist de Compliance

---

## 1. LGPD — Resumo Prático para Devs

```
LGPD (Lei Geral de Proteção de Dados) — Lei 13.709/2018
Equivalente brasileira da GDPR europeia.

Para o DEV, na prática:

Princípios que impactam código:
├── Finalidade — Coletar dados apenas para o propósito declarado
├── Necessidade — Coletar o MÍNIMO necessário (não "pegar tudo por via das dúvidas")
├── Transparência — User sabe quais dados são coletados e por quê
├── Segurança — Proteger dados com medidas técnicas adequadas
├── Prevenção — Antecipar riscos (threat modeling)
└── Não discriminação — Dados não usados para discriminar

Direitos do titular (implementar no sistema):
├── Acesso — Endpoint para exportar dados do user (/api/me/data)
├── Correção — Endpoint para editar dados pessoais
├── Eliminação — Endpoint para deletar conta e dados ("right to be forgotten")
├── Portabilidade — Exportar dados em formato estruturado (JSON, CSV)
├── Revogação de consentimento — Toggle para opt-out de marketing, analytics
└── Informação — Política de privacidade acessível e clara
```

### Bases legais (quando pode tratar dados)

```
1. Consentimento — User deu OK explícito (opt-in, não opt-out)
2. Execução de contrato — Precisa dos dados para entregar o serviço
3. Obrigação legal — Lei exige (ex: nota fiscal precisa de CPF)
4. Legítimo interesse — Justificativa razoável (ex: segurança, fraude)

Na prática para dev:
├── Email e nome para criar conta → Execução de contrato ✅
├── CPF para emitir nota fiscal → Obrigação legal ✅
├── Email para newsletter → Consentimento necessário (opt-in) ✅
├── Tracking para ads → Consentimento necessário ✅
├── Logs de segurança com IP → Legítimo interesse ✅
└── Vender dados para terceiros → ❌ (precisa consentimento explícito)
```

---

## 2. Classificação de Dados

```
Nível 1 — PÚBLICO
  Dados que podem ser expostos sem impacto.
  Exemplos: nome do produto, preço, descrição pública
  Proteção: Integridade (não adulteração)

Nível 2 — INTERNO
  Dados internos da empresa, baixo impacto se vazados.
  Exemplos: documentação técnica, código, roadmap
  Proteção: Acesso controlado, não expor publicamente

Nível 3 — CONFIDENCIAL
  Dados pessoais (PII), impacto moderado se vazados.
  Exemplos: email, nome, endereço, telefone, data nascimento
  Proteção: Criptografia, acesso por necessidade, log de acesso

Nível 4 — RESTRITO
  Dados altamente sensíveis, impacto grave se vazados.
  Exemplos: CPF, dados financeiros, saúde, biometria, senhas
  Proteção: Criptografia forte, acesso mínimo, mascaramento,
            audit trail completo, retenção mínima
```

---

## 3. PII Handling

### O que é PII (Personally Identifiable Information)

```
PII direta (identifica sozinha):
├── Nome completo
├── CPF / RG
├── Email pessoal
├── Telefone
├── Endereço
├── Data de nascimento
├── Biometria (face, impressão digital)
└── Número de cartão de crédito

PII indireta (identifica combinada):
├── CEP + idade + gênero → pode identificar
├── IP address
├── Device ID
├── Geolocalização precisa
└── Cookies de tracking
```

### Regras de handling

```javascript
// 1. Coletar o mínimo necessário
// ❌
const registerSchema = z.object({
  name: z.string(),
  email: z.string().email(),
  cpf: z.string(),         // Precisa pra quê no registro?
  phone: z.string(),       // Precisa pra quê no registro?
  birthDate: z.string(),   // Precisa pra quê no registro?
  address: z.object({...}),// Precisa pra quê no registro?
});

// ✅ Coletar apenas o necessário para a ação
const registerSchema = z.object({
  name: z.string(),
  email: z.string().email(),
  password: z.string().min(8),
});
// CPF, endereço → pedir apenas no checkout, quando necessário

// 2. Criptografar PII sensível no banco
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY = Buffer.from(process.env.ENCRYPTION_KEY, 'hex'); // 32 bytes

function encrypt(text) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

function decrypt(data) {
  const [ivHex, tagHex, encryptedHex] = data.split(':');
  const decipher = createDecipheriv(ALGORITHM, KEY, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return decipher.update(encryptedHex, 'hex', 'utf8') + decipher.final('utf8');
}

// 3. Mascarar em exibição
function maskCPF(cpf) { return `***.${cpf.slice(3,6)}.***-**`; }
function maskEmail(email) {
  const [local, domain] = email.split('@');
  return `${local[0]}***@${domain}`;
}
function maskPhone(phone) { return `(**) ****-${phone.slice(-4)}`; }
```

---

## 4. Criptografia — At Rest e In Transit

```
In Transit (dados trafegando):
├── TLS 1.2+ para todas comunicações (HTTPS)
├── HSTS header para forçar HTTPS
├── Certificate pinning para mobile apps
├── mTLS entre microserviços (quando possível)
└── Criptografia de conexão com DB (SSL mode=require)

At Rest (dados armazenados):
├── Criptografia de disco (AWS EBS encryption, GCP CMEK)
├── Criptografia de banco (RDS encryption, transparent encryption)
├── Criptografia de campo para PII sensível (AES-256-GCM)
├── Criptografia de backups
└── Criptografia de file storage (S3 SSE)

Secrets:
├── NUNCA em código ou .env commitado
├── Vault (HashiCorp Vault, AWS Secrets Manager)
├── Env vars em runtime (não em build time)
├── Rotação periódica (90 dias mínimo)
└── Diferentes secrets por ambiente (dev ≠ staging ≠ prod)
```

---

## 5. Data Retention e Deletion

```javascript
// Política de retenção — definir ANTES de coletar

const RETENTION_POLICY = {
  // Dados         | Retenção      | Motivo
  userAccount:      'until_deleted', // Até user pedir exclusão
  orderHistory:     '5_years',       // Obrigação fiscal
  paymentTokens:    '1_year',        // Pós última transação
  securityLogs:     '1_year',        // Compliance
  analyticsEvents:  '6_months',      // Depois, agregar e deletar PII
  supportTickets:   '2_years',       // Referência
  deletedAccounts:  '30_days',       // Soft delete → hard delete
};

// Implementar "right to be forgotten"
async function deleteUserAccount(userId) {
  // 1. Anonimizar dados que não podem ser deletados (obrigação legal)
  await db.order.updateMany({
    where: { userId },
    data: {
      userName: 'DELETED_USER',
      userEmail: `deleted_${userId}@anonymized.local`,
      userAddress: null,
      userPhone: null,
    },
  });

  // 2. Deletar dados que podem ser deletados
  await db.userPreference.deleteMany({ where: { userId } });
  await db.session.deleteMany({ where: { userId } });
  await db.notification.deleteMany({ where: { userId } });

  // 3. Deletar a conta
  await db.user.delete({ where: { id: userId } });

  // 4. Log da ação (sem PII)
  logger.info('User account deleted', { userId, deletedAt: new Date() });
}

// Job agendado para limpar dados expirados
async function cleanExpiredData() {
  const sixMonthsAgo = subMonths(new Date(), 6);
  await db.analyticsEvent.deleteMany({ where: { createdAt: { lt: sixMonthsAgo } } });

  const thirtyDaysAgo = subDays(new Date(), 30);
  await db.deletedAccount.deleteMany({ where: { deletedAt: { lt: thirtyDaysAgo } } });
}
```

---

## 6. Logging Seguro

```javascript
// ❌ Log com PII
logger.info('User login', { email: 'maria@email.com', ip: '189.10.20.30', password: 'abc123' });

// ✅ Log sem PII sensível
logger.info('User login', { userId: 'u-123', ip: '189.10.x.x', result: 'success' });

// Regras de logging:
const LOG_RULES = {
  // Nunca logar:
  never: ['password', 'creditCard', 'cvv', 'cpf', 'token', 'secret', 'apiKey'],

  // Mascarar:
  mask: ['email', 'phone', 'address', 'ip'],

  // OK logar:
  allowed: ['userId', 'requestId', 'action', 'statusCode', 'duration', 'path', 'method'],
};

// Middleware de sanitização de logs
function sanitizeForLog(obj) {
  const sanitized = { ...obj };
  for (const key of LOG_RULES.never) {
    if (key in sanitized) sanitized[key] = '[REDACTED]';
  }
  for (const key of LOG_RULES.mask) {
    if (key in sanitized) sanitized[key] = maskField(key, sanitized[key]);
  }
  return sanitized;
}
```

---

## 7. Checklist de Compliance

```
LGPD / GDPR — Checklist Técnico:

Coleta:
☐ Coletando apenas dados necessários para a funcionalidade?
☐ Consentimento obtido para dados opcionais (newsletter, analytics)?
☐ Política de privacidade acessível e clara?
☐ Cookie banner com opt-in (não opt-out) para analytics?

Armazenamento:
☐ PII sensível criptografado no banco (CPF, dados de saúde)?
☐ Passwords com bcrypt(12) ou Argon2id?
☐ Backups criptografados?
☐ Criptografia at rest no disco/DB?
☐ Secrets em vault (não em código/env files commitados)?

Acesso:
☐ Least privilege no acesso a dados (dev não lê prod)?
☐ Audit trail de acesso a dados sensíveis?
☐ MFA para acesso a painel admin?
☐ Endpoint de exportação de dados (/api/me/data)?

Retenção:
☐ Política de retenção definida por tipo de dado?
☐ Job de limpeza de dados expirados automatizado?
☐ Endpoint de exclusão de conta ("right to be forgotten")?
☐ Soft delete com hard delete após período?

Transferência:
☐ TLS para todas as comunicações?
☐ PII não trafega em query params de URL?
☐ APIs de terceiros recebem apenas dados necessários?
☐ Data Processing Agreement com fornecedores?

Incidentes:
☐ Plano de resposta a incidentes documentado?
☐ Notificação à ANPD em 72h (ou "prazo razoável")?
☐ Notificação a titulares quando há risco?
☐ Contato do DPO (encarregado) publicado?
```
