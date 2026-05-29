# Security Hardening — Checklist, Backup e Disaster Recovery

## Índice
1. Server Hardening Checklist
2. Docker Security
3. Secrets Management
4. Backup Strategy
5. Disaster Recovery
6. Runbook Template
7. Post-Mortem Template

---

## 1. Server Hardening Checklist

### SSH

```bash
# /etc/ssh/sshd_config
PermitRootLogin no              # Nunca login como root
PasswordAuthentication no        # Apenas SSH keys
PubkeyAuthentication yes
Port 2222                        # Porta não-padrão (reduz bots)
MaxAuthTries 3
AllowUsers deploy                # Apenas users específicos
ClientAliveInterval 300
ClientAliveCountMax 2

# Aplicar
sudo systemctl restart sshd
```

### Firewall (UFW)

```bash
#!/bin/bash
# scripts/setup-firewall.sh

# Reset
sudo ufw --force reset

# Default deny
sudo ufw default deny incoming
sudo ufw default allow outgoing

# SSH (porta custom)
sudo ufw allow 2222/tcp comment 'SSH'

# HTTP + HTTPS
sudo ufw allow 80/tcp comment 'HTTP'
sudo ufw allow 443/tcp comment 'HTTPS'

# Monitoring (apenas IP interno/VPN)
# sudo ufw allow from 10.0.0.0/8 to any port 3001 comment 'Grafana'

# Ativar
sudo ufw --force enable
sudo ufw status verbose
```

### Atualizações automáticas de segurança

```bash
# Instalar
sudo apt install unattended-upgrades

# Configurar
sudo dpkg-reconfigure -plow unattended-upgrades

# Verificar
cat /etc/apt/apt.conf.d/20auto-upgrades
# APT::Periodic::Update-Package-Lists "1";
# APT::Periodic::Unattended-Upgrade "1";
```

### Fail2Ban (proteção contra brute force)

```bash
sudo apt install fail2ban

# /etc/fail2ban/jail.local
cat << 'EOF' | sudo tee /etc/fail2ban/jail.local
[DEFAULT]
bantime  = 3600
findtime = 600
maxretry = 3

[sshd]
enabled = true
port    = 2222
filter  = sshd
logpath = /var/log/auth.log

[nginx-limit-req]
enabled = true
filter  = nginx-limit-req
logpath = /var/log/nginx/error.log
maxretry = 5
EOF

sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

---

## 2. Docker Security

### Checklist

```
Imagens:
├── Usar imagens oficiais e verificadas
├── Versões fixas (não :latest)
├── Scan de vulnerabilidades: docker scout cves <image>
├── Multi-stage build (menos superficie de ataque)
└── Rebuild periódico para pegar patches de segurança

Runtime:
├── Non-root user em TODOS os containers
├── Read-only filesystem quando possível
├── No new privileges
├── Limitar capabilities
├── Resource limits (CPU, memory)
└── Não usar --privileged

Network:
├── Backend network internal (sem acesso externo)
├── Expor APENAS nginx nas portas 80/443
├── DB e Redis NUNCA acessíveis externamente
└── Usar docker secrets para senhas (Swarm) ou env vars
```

### docker-compose security hardening

```yaml
services:
  app:
    # ... build, env, etc ...
    security_opt:
      - no-new-privileges:true
    read_only: true
    tmpfs:
      - /tmp
    deploy:
      resources:
        limits:
          cpus: "1.0"
          memory: 512M

  db:
    # ... config ...
    # NUNCA expor porta externamente
    # ports:       # COMENTADO de propósito
    #   - "5432:5432"
    networks:
      - backend    # Apenas rede interna
```

---

## 3. Secrets Management

### Hierarquia de segurança

```
Nível 1 (mínimo): .env no .gitignore + CI secrets
├── OK para: side projects, MVPs
└── Risco: secrets em texto plano no servidor

Nível 2 (recomendado): Docker secrets + CI encrypted
├── OK para: startups, produtos em produção
└── Risco: rotação manual

Nível 3 (enterprise): Vault (HashiCorp) ou AWS Secrets Manager
├── OK para: compliance, multi-team
└── Features: rotação automática, audit log, dynamic secrets
```

### .env.example (commitado)

```bash
# .env.example — Template de variáveis de ambiente
# Copiar para .env e preencher com valores reais
# NUNCA commitar .env

# App
NODE_ENV=production
PORT=3000
APP_SECRET=CHANGE_ME_TO_RANDOM_STRING

# Database
DB_HOST=db
DB_PORT=5432
DB_USER=app
DB_PASS=CHANGE_ME
DB_NAME=myapp

# Redis
REDIS_URL=redis://redis:6379

# Auth
JWT_SECRET=CHANGE_ME_TO_RANDOM_64_CHARS
JWT_EXPIRY=15m
REFRESH_TOKEN_EXPIRY=7d

# Email (SMTP)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=CHANGE_ME
SMTP_PASS=CHANGE_ME

# External APIs
STRIPE_SECRET_KEY=sk_test_CHANGE_ME
STRIPE_WEBHOOK_SECRET=whsec_CHANGE_ME

# Monitoring
GRAFANA_USER=admin
GRAFANA_PASS=CHANGE_ME
```

### Gerador de secrets

```bash
#!/bin/bash
# scripts/generate-secrets.sh
echo "APP_SECRET=$(openssl rand -hex 32)"
echo "JWT_SECRET=$(openssl rand -hex 64)"
echo "DB_PASS=$(openssl rand -base64 24 | tr -d '=/+')"
echo "GRAFANA_PASS=$(openssl rand -base64 16 | tr -d '=/+')"
```

---

## 4. Backup Strategy

### Script de backup completo

```bash
#!/bin/bash
# scripts/backup.sh
set -euo pipefail

# Config
BACKUP_DIR="/backups"
RETENTION_DAYS=30
DATE=$(date +%Y%m%d_%H%M%S)
PROJECT="myproject"

mkdir -p ${BACKUP_DIR}

echo "=== Backup iniciado: ${DATE} ==="

# 1. Database dump
echo "[1/3] Backup do PostgreSQL..."
docker compose exec -T db pg_dump \
  -U ${DB_USER} \
  --format=custom \
  --compress=9 \
  ${DB_NAME} > ${BACKUP_DIR}/db_${DATE}.dump

echo "  → $(du -h ${BACKUP_DIR}/db_${DATE}.dump | cut -f1)"

# 2. Uploads / media files
echo "[2/3] Backup dos uploads..."
docker run --rm \
  -v ${PROJECT}_uploads:/data:ro \
  -v ${BACKUP_DIR}:/backup \
  alpine tar czf /backup/uploads_${DATE}.tar.gz -C /data .

echo "  → $(du -h ${BACKUP_DIR}/uploads_${DATE}.tar.gz | cut -f1)"

# 3. Config files (env, nginx, etc.)
echo "[3/3] Backup das configs..."
tar czf ${BACKUP_DIR}/config_${DATE}.tar.gz \
  --exclude='.git' \
  --exclude='node_modules' \
  docker/ monitoring/ scripts/ .env docker-compose*.yml

echo "  → $(du -h ${BACKUP_DIR}/config_${DATE}.tar.gz | cut -f1)"

# 4. Upload para storage remoto (opcional)
# aws s3 sync ${BACKUP_DIR}/ s3://myproject-backups/${DATE}/
# rclone copy ${BACKUP_DIR}/ remote:backups/${DATE}/

# 5. Limpeza de backups antigos
echo "Limpando backups > ${RETENTION_DAYS} dias..."
find ${BACKUP_DIR} -name "*.dump" -mtime +${RETENTION_DAYS} -delete
find ${BACKUP_DIR} -name "*.tar.gz" -mtime +${RETENTION_DAYS} -delete

echo "=== Backup completo: ${DATE} ==="
echo "Arquivos em ${BACKUP_DIR}:"
ls -lh ${BACKUP_DIR}/*${DATE}*
```

### Script de restore

```bash
#!/bin/bash
# scripts/restore.sh
set -euo pipefail

BACKUP_FILE=${1:?"Uso: ./restore.sh /backups/db_20250115_030000.dump"}

echo "⚠️  ATENÇÃO: Isso vai substituir o banco de dados atual!"
echo "Arquivo: ${BACKUP_FILE}"
read -p "Tem certeza? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
  echo "Cancelado."
  exit 0
fi

echo "Restaurando..."
docker compose exec -T db pg_restore \
  -U ${DB_USER} \
  --clean \
  --if-exists \
  -d ${DB_NAME} < ${BACKUP_FILE}

echo "✅ Restore completo. Verificando..."
docker compose exec -T db psql -U ${DB_USER} -d ${DB_NAME} -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';"

echo "Reiniciando app..."
docker compose restart app
```

### Cron schedule

```bash
# crontab -e
# Backup diário às 3h
0 3 * * * /opt/app/scripts/backup.sh >> /var/log/backup.log 2>&1

# Teste de restore semanal (em staging)
0 5 * * 0 /opt/app/scripts/test-restore.sh >> /var/log/restore-test.log 2>&1
```

---

## 5. Disaster Recovery

### RPO e RTO

```
RPO (Recovery Point Objective):
"Quanto dado posso perder?"
├── Backup diário → RPO = 24h (perdo no máximo 1 dia)
├── Backup horário → RPO = 1h
├── Replicação contínua → RPO ≈ 0

RTO (Recovery Time Objective):
"Quanto tempo leva para voltar?"
├── Restore de backup + redeploy → RTO = 1-2h
├── Failover automático → RTO = minutos
├── Multi-region active-active → RTO ≈ 0
```

### Cenários e procedimentos

| Cenário | Impacto | Procedimento | RTO |
|---------|---------|-------------|-----|
| App crashou | Médio | Docker restart automático (restart policy) | ~30s |
| Deploy quebrou | Médio | Rollback: `./scripts/rollback.sh` | ~5min |
| DB corrompeu | Alto | Restore do último backup | ~30min |
| Server morreu | Alto | Provision novo + restore backup | ~1-2h |
| Disco cheio | Médio | Limpar logs, docker prune, expandir volume | ~15min |
| DDoS | Alto | Rate limiting já ativo + CloudFlare/WAF | ~10min |
| Secret vazou | Crítico | Rotacionar TODAS as secrets, invalidar tokens | ~30min |

---

## 6. Runbook Template

```markdown
# Runbook — [Nome do Projeto]

## Informações de Acesso

| Recurso | URL/Endereço | Acesso |
|---------|-------------|--------|
| Produção | https://example.com | — |
| Staging | https://staging.example.com | — |
| Grafana | https://grafana.example.com | admin / (vault) |
| Server SSH | ssh deploy@IP -p 2222 | Key em (local) |

## Comandos Frequentes

```bash
# Status dos containers
docker compose ps

# Logs de um serviço (últimas 100 linhas)
docker compose logs --tail 100 -f app

# Restart de um serviço
docker compose restart app

# Deploy manual
cd /opt/app && git pull && docker compose pull && docker compose up -d

# Rollback para commit anterior
./scripts/rollback.sh

# Backup manual
./scripts/backup.sh

# Verificar disco
df -h

# Limpar imagens Docker não usadas
docker system prune -f
```

## Procedimentos de Emergência

### App não responde
1. `docker compose ps` — verificar status
2. `docker compose logs --tail 50 app` — verificar erro
3. `docker compose restart app` — tentar restart
4. Se persist: `docker compose down && docker compose up -d`
5. Se ainda persist: verificar DB e Redis

### Disco cheio
1. `df -h` — identificar mount point
2. `docker system prune -f` — limpar Docker
3. `find /var/log -name "*.log" -size +100M` — logs grandes
4. Se persist: expandir volume (cloud) ou mover dados

### Database lenta
1. Verificar Grafana — métricas do PostgreSQL
2. `docker compose exec db psql -U app -c "SELECT * FROM pg_stat_activity;"`
3. Identificar queries lentas
4. Se necessário: `docker compose restart db`

## Contatos de Emergência

| Papel | Nome | Contato |
|-------|------|---------|
| Lead | | |
| DevOps | | |
| DB Admin | | |
```

---

## 7. Post-Mortem Template

```markdown
# Post-Mortem — [Título do Incidente]

**Data:** YYYY-MM-DD
**Severidade:** P1 (crítico) | P2 (major) | P3 (minor)
**Duração:** Xh Ymin (HH:MM → HH:MM UTC)
**Impacto:** [X% dos usuários afetados, Y requests falharam]

## Resumo
[2-3 frases descrevendo o que aconteceu]

## Timeline
| Horário (UTC) | Evento |
|---------------|--------|
| HH:MM | [Primeiro sinal do problema] |
| HH:MM | [Alerta disparou] |
| HH:MM | [Início da investigação] |
| HH:MM | [Causa identificada] |
| HH:MM | [Fix aplicado] |
| HH:MM | [Serviço restaurado] |
| HH:MM | [Confirmação de estabilidade] |

## Causa Raiz
[Descrição técnica detalhada]

## O que deu certo
- [Alerta funcionou]
- [Runbook foi útil]

## O que deu errado
- [Investigação demorou porque X]
- [Faltava documentação sobre Y]

## Action Items
| Ação | Responsável | Prazo | Status |
|------|-----------|-------|--------|
| [Implementar X para prevenir recorrência] | | | ⬜ |
| [Melhorar alerta Y] | | | ⬜ |
| [Documentar procedimento Z] | | | ⬜ |

## Lições Aprendidas
[O que o time aprendeu com esse incidente]
```
