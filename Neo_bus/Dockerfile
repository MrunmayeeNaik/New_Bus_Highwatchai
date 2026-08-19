# ─────────────────────────────────────────────────────────────
# Stage 1 — Build React/Vite Frontend
# ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build


# ─────────────────────────────────────────────────────────────
# Stage 2 — Final Image (Python + Nginx + Supervisord)
# ─────────────────────────────────────────────────────────────
FROM python:3.12-slim

WORKDIR /app

# Install system packages: nginx + supervisord + psycopg2 deps
RUN apt-get update && apt-get install -y \
    nginx \
    supervisor \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# ── Backend: Install Python dependencies ──────────────────────
COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

# ── Backend: Copy source code ─────────────────────────────────
COPY backend/app /app/backend/app

# ── Frontend: Copy built static files into Nginx root ─────────
COPY --from=frontend-builder /app/frontend/dist /usr/share/nginx/html

# ── Nginx: Configure for SPA routing ─────────────────────────
RUN echo '\
server {\n\
    listen 80;\n\
    root /usr/share/nginx/html;\n\
    index index.html;\n\
\n\
    # Proxy API requests to FastAPI backend\n\
    location /api/ {\n\
        proxy_pass http://127.0.0.1:8000;\n\
        proxy_set_header Host $host;\n\
        proxy_set_header X-Real-IP $remote_addr;\n\
    }\n\
\n\
    # Serve React SPA — fallback to index.html\n\
    location / {\n\
        try_files $uri $uri/ /index.html;\n\
    }\n\
}\n\
' > /etc/nginx/sites-available/default

# ── Supervisord: Manage both processes ───────────────────────
RUN echo '\
[supervisord]\n\
nodaemon=true\n\
logfile=/var/log/supervisor/supervisord.log\n\
\n\
[program:nginx]\n\
command=/usr/sbin/nginx -g "daemon off;"\n\
autostart=true\n\
autorestart=true\n\
stdout_logfile=/dev/stdout\n\
stdout_logfile_maxbytes=0\n\
stderr_logfile=/dev/stderr\n\
stderr_logfile_maxbytes=0\n\
\n\
[program:backend]\n\
command=uvicorn app.main:app --host 127.0.0.1 --port 8000\n\
directory=/app/backend\n\
autostart=true\n\
autorestart=true\n\
stdout_logfile=/dev/stdout\n\
stdout_logfile_maxbytes=0\n\
stderr_logfile=/dev/stderr\n\
stderr_logfile_maxbytes=0\n\
' > /etc/supervisor/conf.d/neobus.conf

# Only port 80 exposed (Nginx serves frontend + proxies /api/ to backend)
EXPOSE 80

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/supervisord.conf"]
