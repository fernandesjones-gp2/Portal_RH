# CI/CD Pipelines — Templates Production-Grade

## Índice
1. Princípios de Pipeline
2. GitHub Actions — CI (Lint + Test + Build)
3. GitHub Actions — Deploy (Staging + Prod)
4. Deploy Strategies
5. Secrets Management
6. GitLab CI Template
7. Boas Práticas

---

## 1. Princípios de Pipeline

```
Regras invioláveis:
├── Pipeline quebrada = ninguém mergea (main protegida)
├── Testes rodam ANTES do build, build ANTES do deploy
├── Deploy para produção TEM gate manual (exceto se canary)
├── Secrets NUNCA em código, SEMPRE via CI secrets
├── Cache de dependências para velocidade
├── Imagens Docker taggeadas com SHA do commit (não :latest)
├── Rollback é um re-deploy da versão anterior (não um processo especial)
└── Notificar em falha (Slack, email, etc.)
```

---

## 2. GitHub Actions — CI

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true  # Cancela runs anteriores da mesma branch

env:
  NODE_VERSION: "22"
  # Ou PYTHON_VERSION, GO_VERSION, etc.

jobs:
  # ====== LINT ======
  lint:
    name: Lint & Format
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: "npm"

      - run: npm ci

      - name: Lint
        run: npm run lint

      - name: Type Check
        run: npm run type-check

      - name: Format Check
        run: npx prettier --check .

  # ====== TEST ======
  test:
    name: Tests
    runs-on: ubuntu-latest
    needs: lint  # Só roda se lint passar

    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: test_db
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: "npm"

      - run: npm ci

      - name: Run Migrations
        run: npm run db:migrate
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/test_db

      - name: Unit Tests
        run: npm run test:unit -- --coverage
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/test_db
          REDIS_URL: redis://localhost:6379

      - name: Integration Tests
        run: npm run test:integration
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/test_db
          REDIS_URL: redis://localhost:6379

      - name: Upload Coverage
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: coverage
          path: coverage/

  # ====== BUILD ======
  build:
    name: Build Docker Image
    runs-on: ubuntu-latest
    needs: test  # Só roda se testes passarem
    if: github.event_name == 'push'  # Não builda em PRs

    permissions:
      contents: read
      packages: write

    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Login to Registry
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and Push
        uses: docker/build-push-action@v5
        with:
          context: .
          file: docker/Dockerfile
          target: runtime
          push: true
          tags: |
            ghcr.io/${{ github.repository }}:${{ github.sha }}
            ghcr.io/${{ github.repository }}:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - name: Image Size
        run: docker images ghcr.io/${{ github.repository }}:${{ github.sha }} --format "{{.Size}}"
```

---

## 3. GitHub Actions — Deploy

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  workflow_run:
    workflows: ["CI"]
    types: [completed]
    branches: [main]

jobs:
  # ====== DEPLOY STAGING (automático) ======
  deploy-staging:
    name: Deploy to Staging
    runs-on: ubuntu-latest
    if: ${{ github.event.workflow_run.conclusion == 'success' }}
    environment:
      name: staging
      url: https://staging.example.com

    steps:
      - uses: actions/checkout@v4

      - name: Deploy to Staging
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.STAGING_HOST }}
          username: ${{ secrets.STAGING_USER }}
          key: ${{ secrets.STAGING_SSH_KEY }}
          script: |
            cd /opt/app
            git pull origin main
            docker compose pull
            docker compose -f docker-compose.yml -f docker-compose.staging.yml up -d --remove-orphans
            docker compose exec -T app npm run db:migrate
            sleep 10
            curl -sf http://localhost:3000/health || exit 1
            echo "✅ Staging deploy successful"
            docker image prune -f

      - name: Smoke Tests
        run: |
          sleep 15
          STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://staging.example.com/health)
          if [ "$STATUS" != "200" ]; then
            echo "❌ Health check failed with status $STATUS"
            exit 1
          fi
          echo "✅ Health check passed"

      - name: Notify Success
        if: success()
        run: echo "🚀 Staging deploy completed"
        # Adicionar Slack notification aqui

      - name: Notify Failure
        if: failure()
        run: echo "❌ Staging deploy FAILED"

  # ====== DEPLOY PRODUCTION (manual gate) ======
  deploy-production:
    name: Deploy to Production
    runs-on: ubuntu-latest
    needs: deploy-staging
    environment:
      name: production
      url: https://example.com
    # O environment "production" deve ter "Required reviewers" configurado
    # no GitHub Settings → Environments → production

    steps:
      - uses: actions/checkout@v4

      - name: Deploy to Production
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.PROD_HOST }}
          username: ${{ secrets.PROD_USER }}
          key: ${{ secrets.PROD_SSH_KEY }}
          script: |
            cd /opt/app

            # Backup antes do deploy
            ./scripts/backup.sh

            # Pull e deploy
            git pull origin main
            docker compose pull
            docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --remove-orphans
            docker compose exec -T app npm run db:migrate

            # Healthcheck
            sleep 15
            curl -sf http://localhost:3000/health || {
              echo "❌ ROLLBACK: Health check failed"
              git checkout HEAD~1
              docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --remove-orphans
              exit 1
            }

            echo "✅ Production deploy successful"
            docker image prune -f

      - name: Verify Production
        run: |
          sleep 20
          STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://example.com/health)
          if [ "$STATUS" != "200" ]; then
            echo "❌ Production health check failed"
            exit 1
          fi
          echo "✅ Production is healthy"
```

---

## 4. Deploy Strategies

### Rolling Deploy (default com docker-compose)

```bash
# Pull new images e restart um container por vez
docker compose pull
docker compose up -d --remove-orphans
# Docker compose faz rolling por default
```

### Blue-Green Deploy

```bash
#!/bin/bash
# scripts/blue-green-deploy.sh
CURRENT=$(docker compose ps --format json | jq -r '.Name' | head -1)

if [[ $CURRENT == *"blue"* ]]; then
  NEW="green"
else
  NEW="blue"
fi

echo "Deploying $NEW..."

# Start new version
docker compose -f docker-compose.${NEW}.yml up -d
sleep 15

# Health check
if curl -sf http://localhost:3001/health; then
  echo "✅ $NEW is healthy, switching traffic..."
  # Switch nginx upstream
  sed -i "s/app_${CURRENT}/app_${NEW}/g" /etc/nginx/conf.d/default.conf
  nginx -s reload
  sleep 5
  # Stop old
  docker compose -f docker-compose.${CURRENT}.yml down
  echo "✅ Switched to $NEW"
else
  echo "❌ $NEW failed health check, keeping $CURRENT"
  docker compose -f docker-compose.${NEW}.yml down
  exit 1
fi
```

### Rollback

```bash
#!/bin/bash
# scripts/rollback.sh
PREVIOUS_SHA=${1:-$(git rev-parse HEAD~1)}

echo "Rolling back to ${PREVIOUS_SHA}..."
git checkout ${PREVIOUS_SHA}
docker compose pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
sleep 15

if curl -sf http://localhost:3000/health; then
  echo "✅ Rollback successful"
else
  echo "❌ Rollback ALSO failed — escalate immediately"
  exit 1
fi
```

---

## 5. Secrets Management

### GitHub Actions Secrets

```yaml
# Configurar em: Settings → Secrets and variables → Actions

# Secrets necessários:
# STAGING_HOST       → IP ou hostname do staging
# STAGING_USER       → User SSH
# STAGING_SSH_KEY    → Private key SSH
# PROD_HOST          → IP ou hostname de produção
# PROD_USER          → User SSH
# PROD_SSH_KEY       → Private key SSH
# REGISTRY_TOKEN     → Token do container registry

# Uso no workflow:
env:
  DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

### Nunca fazer:

```yaml
# ❌ NUNCA
env:
  DB_PASSWORD: "minha_senha_123"
  API_KEY: "sk-abc123..."

# ❌ NUNCA (mesmo em base64)
env:
  SECRET: ${{ toBase64('minha_senha') }}

# ✅ CORRETO
env:
  DB_PASSWORD: ${{ secrets.DB_PASSWORD }}
```

---

## 6. GitLab CI Template

```yaml
# .gitlab-ci.yml
stages:
  - lint
  - test
  - build
  - deploy-staging
  - deploy-production

variables:
  DOCKER_IMAGE: $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA

lint:
  stage: lint
  image: node:22-alpine
  cache:
    paths:
      - node_modules/
  script:
    - npm ci
    - npm run lint
    - npm run type-check

test:
  stage: test
  image: node:22-alpine
  services:
    - postgres:16-alpine
    - redis:7-alpine
  variables:
    DATABASE_URL: postgresql://test:test@postgres:5432/test_db
    REDIS_URL: redis://redis:6379
    POSTGRES_USER: test
    POSTGRES_PASSWORD: test
    POSTGRES_DB: test_db
  script:
    - npm ci
    - npm run db:migrate
    - npm run test

build:
  stage: build
  image: docker:24
  services:
    - docker:24-dind
  only:
    - main
  script:
    - docker login -u $CI_REGISTRY_USER -p $CI_REGISTRY_PASSWORD $CI_REGISTRY
    - docker build -f docker/Dockerfile --target runtime -t $DOCKER_IMAGE .
    - docker push $DOCKER_IMAGE

deploy-staging:
  stage: deploy-staging
  only:
    - main
  environment:
    name: staging
    url: https://staging.example.com
  script:
    - ssh $STAGING_USER@$STAGING_HOST "cd /opt/app && git pull && docker compose pull && docker compose up -d"

deploy-production:
  stage: deploy-production
  only:
    - main
  when: manual  # Gate manual
  environment:
    name: production
    url: https://example.com
  script:
    - ssh $PROD_USER@$PROD_HOST "cd /opt/app && ./scripts/backup.sh && git pull && docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d"
```

---

## 7. Boas Práticas

```
Pipeline rápida:
├── Cache node_modules / pip / go modules entre runs
├── Paralelizar lint e test quando independentes
├── Multi-stage Docker build com cache de layers
├── Cancelar runs anteriores da mesma branch (concurrency)
└── Só buildar imagem Docker em push para main (não em PRs)

Segurança:
├── Secrets em encrypted vars, NUNCA em código
├── Imagens de base com versão fixa (não :latest)
├── Scan de vulnerabilidades na imagem (Trivy, Snyk)
├── Branch protection rules na main
└── Required reviews antes de merge

Confiabilidade:
├── Healthcheck após cada deploy
├── Rollback automático se healthcheck falhar
├── Notificação em falha (Slack, Discord, email)
├── Ambientes separados (staging e prod) com gates
└── Database migrations rodam ANTES da nova versão subir
```
