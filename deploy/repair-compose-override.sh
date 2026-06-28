#!/usr/bin/env bash
# Reconstrói docker-compose.override.yml válido (SOGo theme + SSO + webmail portal).
set -euo pipefail
MAILCOW_DIR="${MAILCOW_DIR:-/opt/mailcow-dockerized}"
OVERRIDE="${MAILCOW_DIR}/docker-compose.override.yml"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Carrega MAILCOW_API_KEY do mailcow.conf se disponível
MAILCOW_API_KEY="${MAILCOW_API_KEY:-}"
if [[ -z "${MAILCOW_API_KEY}" && -f "${MAILCOW_DIR}/mailcow.conf" ]]; then
  MAILCOW_API_KEY="$(grep '^API_KEY=' "${MAILCOW_DIR}/mailcow.conf" | cut -d= -f2- | tr -d '\r')"
fi

cat > "${OVERRIDE}" <<EOF
# Nive Mail — override unificado (SOGo theme, SSO Dovecot, webmail React portal)
services:
  sogo-mailcow:
    volumes:
      - ./data/conf/sogo/custom-theme.css:/usr/local/lib/GNUstep/SOGo/WebServerResources/css/theme-default.css:z
      - ./data/conf/sogo/custom-theme.js:/usr/local/lib/GNUstep/SOGo/WebServerResources/js/theme.js:z
  dovecot-mailcow:
    volumes:
      - ./data/conf/phpfpm/sogo-sso/:/etc/sogo-sso/:z
  nive-mail-web:
    image: nive-mail-web:latest
    container_name: nive-mail-web
    restart: unless-stopped
    networks:
      - mailcow-network
    environment:
      - NODE_ENV=production
      - PORT=8080
      - COOKIE_PATH=/mail/
      - IMAP_TLS_SERVERNAME=mail.nivesistemas.com.br
      - IMAP_TLS_REJECT_UNAUTHORIZED=false
      - SMTP_TLS_SERVERNAME=mail.nivesistemas.com.br
      - IMAP_HOST=dovecot-mailcow
      - IMAP_PORT=993
      - SMTP_HOST=postfix-mailcow
      - SMTP_PORT=587
      - SIEVE_HOST=dovecot-mailcow
      - SIEVE_PORT=4190
      - MAILCOW_API_URL=https://nginx-mailcow
      - MAILCOW_API_KEY=${MAILCOW_API_KEY}
      - COOKIE_SECRET=\${NIVE_MAIL_COOKIE_SECRET:-change-me-in-production}
    labels:
      - traefik.enable=false
EOF

echo "Override reparado: ${OVERRIDE}"
cd "${MAILCOW_DIR}"
docker compose config >/dev/null
echo "YAML válido."

docker compose up -d nive-mail-web sogo-mailcow
docker compose restart nginx-mailcow

sleep 2
curl -sk -o /dev/null -w "/mail/ -> HTTP %{http_code}\n" -H "Host: mail.nivesistemas.com.br" https://127.0.0.1/mail/
docker ps --format '{{.Names}}: {{.Status}}' | grep -E 'nive-mail|nginx'
