# Nginx Reverse Proxy — Configurações Production-Grade

## Índice
1. Config Principal (nginx.conf)
2. Reverse Proxy para App
3. SSL/TLS com Let's Encrypt
4. Security Headers
5. Rate Limiting
6. SPA (Single Page App) Config
7. Gzip e Cache
8. Configs por Cenário

---

## 1. Config Principal (nginx.conf)

```nginx
# nginx.conf — Config global
user nginx;
worker_processes auto;  # 1 worker por CPU core
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
    multi_accept on;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # === LOG FORMAT (JSON estruturado) ===
    log_format json_combined escape=json
        '{'
            '"time": "$time_iso8601",'
            '"remote_addr": "$remote_addr",'
            '"method": "$request_method",'
            '"uri": "$request_uri",'
            '"status": $status,'
            '"body_bytes": $body_bytes_sent,'
            '"request_time": $request_time,'
            '"upstream_time": "$upstream_response_time",'
            '"user_agent": "$http_user_agent",'
            '"referer": "$http_referer"'
        '}';

    access_log /var/log/nginx/access.log json_combined;

    # === PERFORMANCE ===
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    client_max_body_size 50M;  # Ajustar para uploads

    # === GZIP ===
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 4;
    gzip_min_length 256;
    gzip_types
        text/plain
        text/css
        text/javascript
        application/javascript
        application/json
        application/xml
        image/svg+xml
        font/woff2;

    # === SECURITY ===
    server_tokens off;  # Esconder versão do Nginx

    # === RATE LIMITING ===
    limit_req_zone $binary_remote_addr zone=general:10m rate=30r/s;
    limit_req_zone $binary_remote_addr zone=auth:10m rate=5r/s;
    limit_req_zone $binary_remote_addr zone=api:10m rate=60r/s;

    # === UPSTREAM (backend) ===
    upstream app_backend {
        server app:3000;
        keepalive 32;
    }

    include /etc/nginx/conf.d/*.conf;
}
```

---

## 2. Reverse Proxy para App

```nginx
# conf.d/default.conf — Reverse proxy

# Redirect HTTP → HTTPS
server {
    listen 80;
    server_name example.com www.example.com;

    # Let's Encrypt challenge
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

# HTTPS server
server {
    listen 443 ssl http2;
    server_name example.com www.example.com;

    # === SSL ===
    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;
    ssl_session_tickets off;

    # OCSP Stapling
    ssl_stapling on;
    ssl_stapling_verify on;

    # === SECURITY HEADERS ===
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;

    # === API (Backend) ===
    location /api/ {
        limit_req zone=api burst=20 nodelay;

        proxy_pass http://app_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";

        # Timeouts
        proxy_connect_timeout 10s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;

        # Buffer
        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;
    }

    # === AUTH endpoints (rate limit mais agressivo) ===
    location /api/auth/ {
        limit_req zone=auth burst=5 nodelay;

        proxy_pass http://app_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # === HEALTHCHECK (sem rate limit) ===
    location /health {
        proxy_pass http://app_backend;
        access_log off;
    }

    # === STATIC FILES (se servidos pelo nginx) ===
    location /static/ {
        alias /usr/share/nginx/static/;
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # === UPLOADS (se servidos pelo nginx) ===
    location /uploads/ {
        alias /usr/share/nginx/uploads/;
        expires 30d;
        add_header Cache-Control "public";
    }

    # === FRONTEND (SPA) ===
    location / {
        limit_req zone=general burst=30 nodelay;
        root /usr/share/nginx/html;
        index index.html;
        try_files $uri $uri/ /index.html;

        # Cache para assets com hash
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
            access_log off;
        }
    }

    # === ERROR PAGES ===
    error_page 502 503 504 /50x.html;
    location = /50x.html {
        root /usr/share/nginx/html;
        internal;
    }
}
```

---

## 3. SSL com Let's Encrypt

### Setup inicial (Certbot + Docker)

```yaml
# Adicionar ao docker-compose.yml
services:
  certbot:
    image: certbot/certbot
    volumes:
      - ./docker/nginx/ssl:/etc/letsencrypt
      - certbot_www:/var/www/certbot
    entrypoint: "/bin/sh -c 'trap exit TERM; while :; do certbot renew; sleep 12h & wait $${!}; done;'"

volumes:
  certbot_www:
```

```bash
# scripts/ssl-init.sh — Primeira vez
#!/bin/bash
DOMAIN=${1:-example.com}
EMAIL=${2:-admin@example.com}

docker compose run --rm certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email ${EMAIL} \
  --agree-tos \
  --no-eff-email \
  -d ${DOMAIN} \
  -d www.${DOMAIN}

echo "Certificado gerado. Restart nginx:"
echo "docker compose restart nginx"
```

### Renovação automática (cron)

```bash
# Adicionar ao crontab do host
0 3 * * 1 docker compose run --rm certbot renew --quiet && docker compose restart nginx
```

---

## 4. Security Headers Explicados

```nginx
# Cada header e por que é importante:

# Previne clickjacking (embedding em iframe)
add_header X-Frame-Options "SAMEORIGIN" always;

# Previne MIME type sniffing
add_header X-Content-Type-Options "nosniff" always;

# Previne XSS refletido
add_header X-XSS-Protection "1; mode=block" always;

# Controla Referer header (privacidade)
add_header Referrer-Policy "strict-origin-when-cross-origin" always;

# Força HTTPS por 2 anos (HSTS)
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;

# Restringe APIs do browser
add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;

# Content Security Policy (ajustar conforme necessidade)
# add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'" always;
```

---

## 5. Rate Limiting

```nginx
# Definir zonas (no bloco http)
limit_req_zone $binary_remote_addr zone=auth:10m rate=5r/s;    # Login: 5/seg
limit_req_zone $binary_remote_addr zone=api:10m rate=60r/s;    # API geral: 60/seg
limit_req_zone $binary_remote_addr zone=general:10m rate=30r/s; # Páginas: 30/seg

# Aplicar (no bloco location)
location /api/auth/ {
    limit_req zone=auth burst=5 nodelay;
    # burst=5 permite 5 requests extras em rajada
    # nodelay não enfileira, rejeita imediatamente
    limit_req_status 429;  # Retorna 429 Too Many Requests
}

# Response customizada para 429
error_page 429 = @rate_limited;
location @rate_limited {
    default_type application/json;
    return 429 '{"error":{"code":"RATE_LIMITED","message":"Muitas requisições. Tente novamente em breve."}}';
}
```

---

## 6. SPA Config (React, Vue, Angular)

```nginx
# conf.d/spa.conf — Para frontend SPA puro (sem backend)
server {
    listen 80;
    server_name _;

    root /usr/share/nginx/html;
    index index.html;

    # Todas as rotas caem no index.html (client-side routing)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Assets com hash no nome = cache agressivo
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # index.html = NUNCA cachear (para deploys funcionarem)
    location = /index.html {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        expires 0;
    }
}
```

---

## 7. Configs por Cenário

### API-only (sem frontend no nginx)

Remover o bloco `location /` com SPA e manter apenas `/api/` e `/health`.

### WebSocket support

```nginx
location /ws {
    proxy_pass http://app_backend;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_read_timeout 86400;  # 24h para WebSocket
}
```

### File upload grande

```nginx
# No bloco server ou location
client_max_body_size 100M;  # Ajustar conforme necessidade

# Para uploads muito grandes, considerar:
proxy_request_buffering off;  # Stream direto para o backend
```

### Multiple backends (microserviços)

```nginx
upstream auth_service { server auth:3001; }
upstream orders_service { server orders:3002; }
upstream products_service { server products:3003; }

location /api/auth/    { proxy_pass http://auth_service; }
location /api/orders/  { proxy_pass http://orders_service; }
location /api/products/ { proxy_pass http://products_service; }
```
