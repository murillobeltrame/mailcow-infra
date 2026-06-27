#!/usr/bin/env bash
# Reconstrói docker-compose.override.yml com um único bloco services (SOGo CSS + Dovecot SSO).
set -euo pipefail
MAILCOW_DIR="${MAILCOW_DIR:-/opt/mailcow-dockerized}"
cd "${MAILCOW_DIR}"
OVERRIDE="${MAILCOW_DIR}/docker-compose.override.yml"

cat > "${OVERRIDE}" <<'EOF'
# Nive Mail — SOGo custom theme CSS + SSO dovecot mount
services:
  sogo-mailcow:
    volumes:
      - ./data/conf/sogo/custom-theme.css:/usr/local/lib/GNUstep/SOGo/WebServerResources/css/theme-default.css:z
  dovecot-mailcow:
    volumes:
      - ./data/conf/phpfpm/sogo-sso/:/etc/sogo-sso/:z
EOF

echo "Override reconstruído:"
cat "${OVERRIDE}"

echo "==> Validando YAML..."
docker compose config >/dev/null
echo "YAML OK"

echo "==> Recriando Dovecot..."
docker compose up -d dovecot-mailcow
sleep 8

DOVECOT="$(docker ps --format '{{.Names}}' | grep -E 'dovecot-mailcow' | head -1)"
docker exec "${DOVECOT}" test -f /etc/sogo-sso/sogo-sso.pass && echo "dovecot: /etc/sogo-sso/sogo-sso.pass OK" || { echo "FALHOU"; exit 1; }

P="$(cat data/conf/phpfpm/sogo-sso/sogo-sso.pass)"
echo "==> Teste doveadm auth (SSO master password):"
docker exec "${DOVECOT}" doveadm auth test contato@storembimportados.com.br "$P" 2>&1 | tail -5

docker compose restart sogo-mailcow memcached-mailcow php-fpm-mailcow
echo "Concluído. Faça logout e login em https://mail.nivesistemas.com.br/"
