#!/usr/bin/env bash
# Instala/atualiza o webmail moderno Nive Mail no VPS Mailcow.
set -euo pipefail

MAILCOW_DIR="${MAILCOW_DIR:-/opt/mailcow-dockerized}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEBMAIL_DIR="${SCRIPT_DIR}/../webmail"
OVERRIDE_FILE="${MAILCOW_DIR}/docker-compose.override.yml"
MARKER="# Nive Mail — webmail moderno (React + IMAP)"
HOST="${MAILCOW_HOSTNAME:-mail.nivesistemas.com.br}"
NGINX_CUSTOM="${MAILCOW_DIR}/data/conf/nginx/site.nive-mail.custom"

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
bash "${SCRIPT_DIR}/repair-compose-override.sh"

echo "==> Configurando nginx proxy /mail/ (site.nive-mail.custom)..."
mkdir -p "$(dirname "${NGINX_CUSTOM}")"
cat > "${NGINX_CUSTOM}" <<'NGINX'
# Nive Mail Web — proxy para webmail moderno (React + IMAP)
location = /mail {
    return 301 /mail/;
}

location ^~ /mail/ {
    proxy_pass http://nive-mail-web:8080/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 120s;
}
NGINX

echo "==> Subindo container..."
cd "${MAILCOW_DIR}"
docker compose up -d nive-mail-web 2>/dev/null || docker-compose up -d nive-mail-web 2>/dev/null

echo "==> Reiniciando nginx..."
docker compose restart nginx-mailcow 2>/dev/null || docker-compose restart nginx-mailcow 2>/dev/null || true

echo "==> Verificação..."
sleep 3
curl -sk -o /dev/null -w "    /mail/ -> HTTP %{http_code}\n" -H "Host: ${HOST}" https://127.0.0.1/mail/ || true
docker ps --format '    {{.Names}}: {{.Status}}' | grep nive-mail-web || echo "    AVISO: container nive-mail-web não encontrado"

echo ""
echo "Webmail moderno: https://${HOST}/mail/"
echo "SOGo (calendário/contatos): https://${HOST}/SOGo/"
