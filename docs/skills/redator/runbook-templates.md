# Runbook Templates — Operação, Deploy, Incidentes

## Índice
1. Princípios de Runbook
2. Template: Deploy
3. Template: Rollback
4. Template: Database Recovery
5. Template: Incident Response
6. Template: Scaling
7. Template: Cenários Comuns

---

## 1. Princípios de Runbook

```
Regras de um bom runbook:
├── Escrito para quem está de plantão às 3h da manhã
├── Passos numerados, executáveis, sem ambiguidade
├── Comandos copy-paste (não "execute o comando apropriado")
├── Inclui verificação após cada passo ("como saber que funcionou")
├── Tem rollback para cada passo quando possível
├── Tem contatos de escalação
└── Testado pelo menos 1x (runbook não testado é ficção)
```

---

## 2. Template: Deploy

```markdown
# Runbook: Deploy para Produção

**Owner:** [time/pessoa]
**Última revisão:** YYYY-MM-DD
**Tempo estimado:** 15-30 minutos
**Risco:** Médio
**Requer:** Acesso SSH ao servidor, GitHub permissions

## Pré-condições

- [ ] CI/CD pipeline verde na `main`
- [ ] Smoke tests passaram em staging
- [ ] Changelog atualizado
- [ ] Backup recente verificado (< 24h)
- [ ] Não é sexta-feira (a menos que seja emergência)

## Passos

### 1. Verificar staging

```bash
curl -s https://staging.example.com/health | jq .
# Esperado: {"status":"healthy","checks":{"database":"ok","redis":"ok"}}
```

### 2. Notificar o time

Postar no #deployments:
> 🚀 Iniciando deploy para produção. Versão: [SHA].
> Changelog: [link]

### 3. Fazer backup

```bash
ssh deploy@prod-server 'cd /opt/app && ./scripts/backup.sh'
# Verificar: último arquivo em /backups/ com data de hoje
```

### 4. Deploy

```bash
ssh deploy@prod-server 'cd /opt/app && git pull origin main && docker compose pull && docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --remove-orphans'
```

### 5. Rodar migrations

```bash
ssh deploy@prod-server 'cd /opt/app && docker compose exec -T app npm run db:migrate'
# Verificar: output mostra migrations aplicadas sem erros
```

### 6. Verificar health

```bash
# Esperar 30 segundos para containers estabilizarem
sleep 30
curl -s https://example.com/health | jq .
# Esperado: {"status":"healthy"}
```

### 7. Smoke tests

```bash
# Verificar endpoints críticos
curl -s -o /dev/null -w "%{http_code}" https://example.com/api/v1/health
# Esperado: 200

curl -s -o /dev/null -w "%{http_code}" https://example.com/
# Esperado: 200
```

### 8. Monitorar

- Abrir Grafana: https://grafana.example.com
- Dashboard "Production Overview"
- Verificar por 15 minutos:
  - Error rate < 1%
  - Latência p95 normal
  - Sem alerts disparando

### 9. Notificar sucesso

Postar no #deployments:
> ✅ Deploy concluído. Produção saudável.

## Rollback

Se QUALQUER verificação falhar:

```bash
ssh deploy@prod-server 'cd /opt/app && git checkout HEAD~1 && docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d'
```

Postar no #deployments:
> ⚠️ Deploy revertido. Investigando.

## Contatos

| Papel | Pessoa | Contato |
|-------|--------|---------|
| Lead | [nome] | [telefone/slack] |
| DBA | [nome] | [telefone/slack] |
| Infra | [nome] | [telefone/slack] |
```

---

## 3. Template: Rollback

```markdown
# Runbook: Rollback de Produção

**Quando usar:** Após deploy que causou problemas em produção.
**Tempo estimado:** 5-10 minutos
**Urgência:** ALTA

## Passos

### 1. Identificar versão anterior

```bash
ssh deploy@prod-server 'cd /opt/app && git log --oneline -5'
# Copiar o SHA do commit anterior ao deploy
```

### 2. Reverter

```bash
ssh deploy@prod-server 'cd /opt/app && git checkout <SHA_ANTERIOR> && docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --remove-orphans'
```

### 3. Reverter migrations (se aplicável)

```bash
# CUIDADO: só reverter migration se a migration do deploy causou o problema
ssh deploy@prod-server 'cd /opt/app && docker compose exec -T app npm run db:migrate:undo:last'
```

### 4. Verificar

```bash
sleep 20
curl -s https://example.com/health | jq .
```

### 5. Notificar

```
#deployments: ⚠️ Produção revertida para [SHA]. Motivo: [breve].
#incidents: (se necessário) Criar incident report.
```
```

---

## 4. Template: Database Recovery

```markdown
# Runbook: Recuperação de Banco de Dados

**Quando usar:** Dados corrompidos, migration destrutiva, perda de dados.
**Tempo estimado:** 30-60 minutos
**Urgência:** CRÍTICA
**Requer:** Acesso ao servidor + backups

## Avaliação

Antes de restaurar, determinar:
- [ ] É perda total ou parcial?
- [ ] Qual o backup mais recente? (verificar /backups/)
- [ ] Quanto de dados vamos perder? (RPO)
- [ ] O app pode ficar offline durante o restore?

## Restore Completo

### 1. Parar a aplicação

```bash
ssh deploy@prod-server 'cd /opt/app && docker compose stop app'
# DB continua rodando
```

### 2. Identificar backup

```bash
ssh deploy@prod-server 'ls -lah /backups/db_*.dump | tail -5'
# Escolher o mais recente antes do problema
```

### 3. Restaurar

```bash
ssh deploy@prod-server 'docker compose exec -T db pg_restore -U $DB_USER --clean --if-exists -d $DB_NAME < /backups/db_YYYYMMDD_HHMMSS.dump'
```

### 4. Verificar

```bash
ssh deploy@prod-server 'docker compose exec -T db psql -U $DB_USER -d $DB_NAME -c "SELECT count(*) FROM users; SELECT count(*) FROM orders;"'
# Comparar com volumes esperados
```

### 5. Reiniciar app

```bash
ssh deploy@prod-server 'cd /opt/app && docker compose start app'
sleep 20
curl -s https://example.com/health | jq .
```

### 6. Validar dados

- [ ] Logar como usuário de teste
- [ ] Verificar últimos pedidos no admin
- [ ] Conferir que dados após o backup foram perdidos (esperado)

## Restore Parcial (tabela específica)

```bash
# Extrair apenas uma tabela do backup
pg_restore -U $DB_USER -d $DB_NAME --table=orders /backups/db_YYYYMMDD.dump
```
```

---

## 5. Template: Incident Response

```markdown
# Runbook: Resposta a Incidentes

## Severidades

| Severidade | Definição | SLA de Resposta |
|-----------|----------|-----------------|
| **SEV-1** | Sistema totalmente fora | 15 minutos |
| **SEV-2** | Funcionalidade crítica degradada | 30 minutos |
| **SEV-3** | Funcionalidade não-crítica afetada | 2 horas |
| **SEV-4** | Cosmético / minor | Próximo dia útil |

## Fluxo

```
1. DETECTAR  → Alerta, report de usuário, monitoramento
2. TRIAGAR   → Classificar severidade
3. COMUNICAR → Notificar time + stakeholders
4. INVESTIGAR → Identificar causa raiz
5. MITIGAR   → Resolver o sintoma (pode ser workaround)
6. RESOLVER  → Fix definitivo
7. DOCUMENTAR → Post-mortem
```

## Checklist Imediato

### 1. Abrir canal de incidente

```
#incident-YYYY-MM-DD: [SEV-X] Breve descrição do problema
```

### 2. Coletar informações

```bash
# Logs recentes
ssh deploy@prod-server 'docker compose logs --tail 100 app'

# Status dos containers
ssh deploy@prod-server 'docker compose ps'

# Recursos do servidor
ssh deploy@prod-server 'df -h && free -h && top -bn1 | head -20'

# Conexões do banco
ssh deploy@prod-server 'docker compose exec db psql -U $DB_USER -c "SELECT count(*) FROM pg_stat_activity;"'
```

### 3. Ações comuns por sintoma

| Sintoma | Ação imediata |
|---------|--------------|
| App não responde | `docker compose restart app` |
| 502 Bad Gateway | Verificar se app está healthy: `docker compose ps` |
| Disco cheio | `docker system prune -f` e `find /var/log -name "*.log" -size +100M` |
| DB lento | `SELECT * FROM pg_stat_activity WHERE state != 'idle';` e matar queries longas |
| Memory alta | `docker stats` e restart do serviço consumindo |
| SSL expirado | `certbot renew && docker compose restart nginx` |

### 4. Post-mortem (até 48h após o incidente)

Criar doc em `docs/postmortems/YYYY-MM-DD-titulo.md` seguindo o template.
```

---

## 6. Template: Cenários Comuns

```markdown
# Troubleshooting — Problemas Comuns

## "Não consigo rodar o projeto localmente"

### Docker não inicia
```bash
# Verificar se Docker está rodando
docker info

# Se não: iniciar Docker Desktop ou
sudo systemctl start docker
```

### Porta já em uso
```bash
# Descobrir quem está usando a porta 3000
lsof -i :3000
# Matar o processo ou mudar a porta no .env
```

### Migration falha
```bash
# Resetar banco local
npm run db:drop
npm run db:create
npm run db:migrate
npm run db:seed
```

### "Cannot find module X"
```bash
rm -rf node_modules package-lock.json
npm install
```

## "API retorna 401"

1. Token expirou? Fazer login novamente.
2. Token no formato correto? `Authorization: Bearer <token>` (com espaço após Bearer).
3. Variável JWT_SECRET igual entre quem gerou e quem valida?

## "Banco lento em produção"

Seguir o database-specialist skill ou:
1. Verificar `pg_stat_activity` para queries travadas
2. Verificar disco: `df -h`
3. Verificar se autovacuum está rodando
4. Verificar connection count vs max_connections
```
