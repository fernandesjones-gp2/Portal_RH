# ============================================================
# Portal RH — Next.js 16 (standalone) — Dockerfile production-grade
# Multi-stage build + usuário non-root + imagem mínima.
# ============================================================

ARG NODE_VERSION=22-alpine

# ------------------------------------------------------------
# Stage 1: Dependências
# ------------------------------------------------------------
FROM node:${NODE_VERSION} AS deps

WORKDIR /app

# libc6-compat: alguns pacotes nativos precisam no Alpine
RUN apk add --no-cache libc6-compat

# Copia apenas os manifests para aproveitar cache de layer
COPY package.json package-lock.json ./

# Instala dependências exatamente como no lockfile
RUN npm ci --no-audit --no-fund

# ------------------------------------------------------------
# Stage 2: Build
# ------------------------------------------------------------
FROM node:${NODE_VERSION} AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# -----------------------------------------------------------------
# IMPORTANTE: variáveis NEXT_PUBLIC_* são embutidas no bundle do
# cliente DURANTE O BUILD. Por isso elas precisam chegar como ARG
# (build args), e não apenas como env de runtime.
#
# No EasyPanel: configure-as em "Build Arguments" (ou marque as env
# vars para também serem usadas no build).
# -----------------------------------------------------------------
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY

ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
ENV NODE_ENV=production
# Telemetria do Next desligada no build
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ------------------------------------------------------------
# Stage 3: Runtime (produção)
# ------------------------------------------------------------
FROM node:${NODE_VERSION} AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Usuário non-root (segurança)
RUN addgroup -g 1001 -S nodejs && \
    adduser -u 1001 -S nextjs -G nodejs

# Assets públicos
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Output standalone: traz server.js + node_modules mínimos necessários
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# Assets estáticos gerados pelo build
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

# Healthcheck: a rota "/" (tela de login) responde 200.
# Usa ${PORT} para seguir a porta definida em runtime (o EasyPanel costuma
# injetar PORT=80, sobrescrevendo o default 3000). Assim funciona em qualquer porta.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-3000}/" >/dev/null 2>&1 || exit 1

STOPSIGNAL SIGTERM

# server.js é gerado pelo output standalone do Next
CMD ["node", "server.js"]
