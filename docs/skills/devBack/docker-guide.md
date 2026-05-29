# Docker Guide — Containers Production-Grade

## Índice
1. Princípios de Containerização
2. Dockerfiles por Stack (Multi-Stage)
3. Docker Compose
4. .dockerignore
5. Otimização de Imagens
6. Healthchecks
7. Volumes e Persistência
8. Networking

---

## 1. Princípios de Containerização

```
Regras invioláveis:
├── 1 container = 1 processo (não rodar app + db no mesmo container)
├── Imagem imutável (build uma vez, deploy em qualquer ambiente)
├── Non-root user (NUNCA rodar como root em produção)
├── Multi-stage build (separar build de runtime)
├── .dockerignore antes do Dockerfile (evitar contexto enorme)
├── Versões fixas (node:22-alpine, não node:latest)
├── COPY antes de RUN npm install (cache de layers)
└── Healthcheck em todo serviço
```

---

## 2. Dockerfiles por Stack

### Node.js (Express, NestJS, Fastify)

```dockerfile
# ============================================
# Stage 1: Dependencies
# ============================================
FROM node:22-alpine AS deps

WORKDIR /app

# Copiar apenas package files para cache de layer
COPY package.json package-lock.json ./

# Instalar APENAS dependências de produção
RUN npm ci --only=production && \
    cp -R node_modules /prod_modules && \
    npm ci

# ============================================
# Stage 2: Build
# ============================================
FROM node:22-alpine AS build

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build (TypeScript, etc)
RUN npm run build

# ============================================
# Stage 3: Runtime (PRODUÇÃO)
# ============================================
FROM node:22-alpine AS runtime

# Labels para metadata
LABEL maintainer="team@example.com"
LABEL version="1.0.0"

# Segurança: criar usuário non-root
RUN addgroup -g 1001 appgroup && \
    adduser -u 1001 -G appgroup -D appuser

WORKDIR /app

# Copiar apenas o necessário
COPY --from=deps /prod_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./

# Variáveis de ambiente com defaults seguros
ENV NODE_ENV=production
ENV PORT=3000

# Non-root
USER appuser

# Expose (documentação, não abre porta)
EXPOSE 3000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

# Graceful shutdown
STOPSIGNAL SIGTERM

CMD ["node", "dist/main.js"]
```

### Python (FastAPI, Django)

```dockerfile
# ============================================
# Stage 1: Build
# ============================================
FROM python:3.12-slim AS build

WORKDIR /app

# Instalar dependências de sistema para build
RUN apt-get update && \
    apt-get install -y --no-install-recommends gcc libpq-dev && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# ============================================
# Stage 2: Runtime
# ============================================
FROM python:3.12-slim AS runtime

# Dependências de runtime (libpq para psycopg2)
RUN apt-get update && \
    apt-get install -y --no-install-recommends libpq5 curl && \
    rm -rf /var/lib/apt/lists/*

# Non-root user
RUN groupadd -r appgroup && useradd -r -g appgroup appuser

WORKDIR /app

# Copiar dependências instaladas
COPY --from=build /install /usr/local

# Copiar código
COPY . .

ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV PORT=8000

USER appuser
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Go

```dockerfile
# ============================================
# Stage 1: Build
# ============================================
FROM golang:1.23-alpine AS build

WORKDIR /app

# Cache de dependências
COPY go.mod go.sum ./
RUN go mod download

COPY . .

# Build estático (sem dependências de C)
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /server ./cmd/server

# ============================================
# Stage 2: Runtime (scratch = 0 overhead)
# ============================================
FROM scratch

# Certificados SSL (para chamadas HTTPS externas)
COPY --from=build /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/

# Binary
COPY --from=build /server /server

EXPOSE 8080

ENTRYPOINT ["/server"]
```

### Frontend Estático (React, Vue, Next.js export)

```dockerfile
# ============================================
# Stage 1: Build
# ============================================
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Build gera /app/dist ou /app/build
RUN npm run build

# ============================================
# Stage 2: Serve com Nginx
# ============================================
FROM nginx:alpine AS runtime

# Remover config default
RUN rm /etc/nginx/conf.d/default.conf

# Copiar config customizada
COPY docker/nginx/spa.conf /etc/nginx/conf.d/default.conf

# Copiar build
COPY --from=build /app/dist /usr/share/nginx/html

# Non-root nginx
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    chown -R nginx:nginx /etc/nginx/conf.d && \
    touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid

USER nginx

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
```

---

## 3. Docker Compose

### Template Completo (App + DB + Redis + Nginx)

```yaml
# docker-compose.yml — Desenvolvimento e Staging
version: "3.9"

services:
  # ====== NGINX (Reverse Proxy) ======
  nginx:
    image: nginx:alpine
    ports:
      - "${NGINX_PORT:-80}:80"
      - "${NGINX_SSL_PORT:-443}:443"
    volumes:
      - ./docker/nginx/conf.d:/etc/nginx/conf.d:ro
      - ./docker/nginx/ssl:/etc/nginx/ssl:ro
      - static_files:/usr/share/nginx/static:ro
    depends_on:
      app:
        condition: service_healthy
    restart: unless-stopped
    networks:
      - frontend

  # ====== APP (Backend) ======
  app:
    build:
      context: .
      dockerfile: docker/Dockerfile
      target: runtime
    env_file:
      - .env
    environment:
      - DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@db:5432/${DB_NAME}
      - REDIS_URL=redis://redis:6379
    volumes:
      - uploads:/app/uploads
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/health"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 15s
    restart: unless-stopped
    networks:
      - frontend
      - backend

  # ====== DATABASE (PostgreSQL) ======
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASS}
      POSTGRES_DB: ${DB_NAME}
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./scripts/init-db.sql:/docker-entrypoint-initdb.d/init.sql:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER} -d ${DB_NAME}"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped
    networks:
      - backend
    # NUNCA expor porta do DB externamente em produção
    # ports:
    #   - "5432:5432"  # APENAS para dev local

  # ====== CACHE (Redis) ======
  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
    volumes:
      - redisdata:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5
    restart: unless-stopped
    networks:
      - backend

volumes:
  pgdata:
    driver: local
  redisdata:
    driver: local
  uploads:
    driver: local
  static_files:
    driver: local

networks:
  frontend:
    driver: bridge
  backend:
    driver: bridge
    internal: true  # Não acessível externamente
```

### docker-compose.prod.yml (Override para produção)

```yaml
# docker-compose.prod.yml — Overrides de produção
# Uso: docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
version: "3.9"

services:
  app:
    build:
      target: runtime
    deploy:
      resources:
        limits:
          cpus: "1.0"
          memory: 512M
        reservations:
          cpus: "0.25"
          memory: 128M
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"

  db:
    deploy:
      resources:
        limits:
          cpus: "1.0"
          memory: 1G
    # Em produção, usar managed database (RDS, Cloud SQL) em vez de container
    # Este bloco existe como fallback para VPS

  redis:
    deploy:
      resources:
        limits:
          memory: 256M

  nginx:
    ports:
      - "80:80"
      - "443:443"
```

---

## 4. .dockerignore

```
# .dockerignore — CRÍTICO para builds rápidos e seguros
node_modules
npm-debug.log*
.npm

# Git
.git
.gitignore

# Environment (NUNCA enviar para o build context)
.env
.env.*
!.env.example

# IDE
.vscode
.idea
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Docker
docker-compose*.yml
Dockerfile*

# Docs e testes (não precisam na imagem)
docs/
tests/
__tests__
*.test.*
*.spec.*
coverage/
.nyc_output/

# Build artifacts locais
dist/
build/
.next/
*.log

# Infra
infra/
terraform/
.terraform/
monitoring/
```

---

## 5. Otimização de Imagens

### Checklist de otimização

```
1. Multi-stage build (separar build de runtime)
2. Alpine ou slim como base (não full)
3. Minimizar layers (combinar RUN commands com &&)
4. Copiar package.json ANTES do código (cache)
5. .dockerignore completo
6. Não instalar dev dependencies no runtime
7. Remover cache de package manager (apt, pip, npm)
8. Usar --no-cache-dir (pip) e npm ci (npm)
```

### Comparação de tamanhos

```
Imagem                    | Full    | Slim    | Alpine  | Scratch
node:22                   | 1.1GB   | -       | 180MB   | -
node:22-slim              | -       | 250MB   | -       | -
node:22-alpine            | -       | -       | 130MB   | -
+ multi-stage (app only)  | -       | -       | ~50MB   | -

python:3.12               | 1.0GB   | 150MB   | 80MB    | -
+ multi-stage             | -       | ~120MB  | -       | -

golang:1.23               | 800MB   | -       | 250MB   | -
+ multi-stage (scratch)   | -       | -       | -       | ~10MB
```

---

## 6. Healthchecks

### Endpoint /health na aplicação

```javascript
// Node.js — health endpoint
app.get('/health', async (req, res) => {
  try {
    // Check database
    await db.raw('SELECT 1');
    // Check Redis
    await redis.ping();
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks: {
        database: 'ok',
        redis: 'ok'
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});
```

```python
# Python FastAPI
@app.get("/health")
async def health():
    checks = {}
    try:
        await db.execute("SELECT 1")
        checks["database"] = "ok"
    except Exception:
        checks["database"] = "failed"
    try:
        await redis.ping()
        checks["redis"] = "ok"
    except Exception:
        checks["redis"] = "failed"

    healthy = all(v == "ok" for v in checks.values())
    return JSONResponse(
        status_code=200 if healthy else 503,
        content={"status": "healthy" if healthy else "unhealthy", "checks": checks}
    )
```

---

## 7. Volumes e Persistência

```yaml
# REGRA: dados persistentes SEMPRE em named volumes, NUNCA em bind mounts
volumes:
  pgdata:       # Database — NUNCA perder
  redisdata:    # Cache — perder é ok, mas ruim para restart
  uploads:      # User uploads — backup obrigatório

# Bind mounts APENAS para dev (hot reload):
# volumes:
#   - ./src:/app/src  # Apenas em docker-compose.dev.yml
```

### Backup de volumes

```bash
#!/bin/bash
# scripts/backup.sh
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=/backups

# Dump PostgreSQL
docker compose exec -T db pg_dump -U ${DB_USER} ${DB_NAME} | \
  gzip > ${BACKUP_DIR}/db_${DATE}.sql.gz

# Backup de uploads
docker run --rm \
  -v projeto_uploads:/data:ro \
  -v ${BACKUP_DIR}:/backup \
  alpine tar czf /backup/uploads_${DATE}.tar.gz /data

# Limpar backups > 30 dias
find ${BACKUP_DIR} -name "*.gz" -mtime +30 -delete

echo "Backup completo: ${DATE}"
```

---

## 8. Networking

```
                    Internet
                       │
                    [Nginx] ← porta 80/443 (única porta exposta)
                       │
              ┌────────┼────────┐
              │    frontend     │   ← network bridge
              │    network      │
              └────────┼────────┘
                       │
                     [App] ← porta 3000 (interna)
                       │
              ┌────────┼────────┐
              │    backend      │   ← network bridge INTERNAL
              │    network      │      (sem acesso externo)
              └───┬────┼────┬───┘
                  │    │    │
                [DB] [Redis] [Queue]
                      (portas internas apenas)
```

**Regra**: Backend network é `internal: true`. DB, Redis e filas
NUNCA são acessíveis externamente. Apenas via Nginx → App → Backend.
