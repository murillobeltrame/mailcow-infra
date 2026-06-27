#!/usr/bin/env bash
# Instala/atualiza o webmail moderno Nive Mail no VPS Mailcow.
set -euo pipefail

MAILCOW_DIR="${MAILCOW_DIR:-/opt/mailcow-dockerized}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEBMAIL_DIR="${SCRIPT_DIR}/../webmail"
OVERRIDE_FILE="${MAILCOW_DIR}/docker-compose.override.yml"
MARKER="# Nive Mail — webmail moderno (React + IMAP)"
HOST="${MAILCOW_HOSTNAME:-mail.nivesistemas.com.br}"

if [[ ! -d "${MAILCOW_DIR}" ]]; then
  echo "Mailcow não encontrado em ${MAILCOW_DIR}" >&2
  exit 1
fi

if [[ ! -d "${WEBMAIL_DIR}" ]]; then
  echo "Pasta webmail não encontrada: ${WEBMAIL_DIR}" >&2
  exit 1
fi

echo "==> Build imagem nive-mail-web..."
docker build -t nive-mail-web:latest "${WEBMAIL_DIR}"

echo "==> Configurando docker-compose.override.yml..."
WEBMAIL_BLOCK="
${MARKER}
  nive-mail-web:
    image: nive-mail-web:latest
    container_name: nive-mail-web
    restart: unless-stopped
    networks:
      - mailcow-network
    environment:
      - NODE_ENV=production
      - PORT=8080
      - IMAP_HOST=dovecot-mailcow
      - IMAP_PORT=993
      - SMTP_HOST=postfix-mailcow
      - SMTP_PORT=587
      - COOKIE_SECRET=\${NIVE_MAIL_COOKIE_SECRET:-change-me-in-production}
    labels:
      - traefik.enable=false
"

if [[ -f "${OVERRIDE_FILE}" ]] && grep -qF "${MARKER}" "${OVERRIDE_FILE}"; then
  echo "    Override webmail já presente."
elif [[ -f "${OVERRIDE_FILE}" ]]; then
  cat >> "${OVERRIDE_FILE}" <<EOF
services:${WEBMAIL_BLOCK}
EOF
else
  cat > "${OVERRIDE_FILE}" <<EOF
services:${WEBMAIL_BLOCK}
EOF
fi

echo "==> Configurando nginx proxy /mail/ ..."
NGINX_CUSTOM="${MAILCOW_DIR}/data/conf/nginx/nive-mail-web.conf"
mkdir -p "$(dirname "${NGINX_CUSTOM}")"
cat > "${NGINX_CUSTOM}" <<'NGINX'
# Nive Mail Web — proxy para webmail moderno
location /mail/ {
    proxy_pass http://nive-mail-web:8080/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
NGINX

echo "==> Subindo container..."
cd "${MAILCOW_DIR}"
docker compose up -d nive-mail-web 2>/dev/null || docker-compose up -d nive-mail-web 2>/dev/null || true
docker compose restart nginx-mailcow 2>/dev/null || docker-compose restart nginx-mailcow 2>/dev/null || true

echo ""
echo "Webmail moderno: https://${HOST}/mail/"
echo "SOGo (calendário/contatos): https://${HOST}/SOGo/"
