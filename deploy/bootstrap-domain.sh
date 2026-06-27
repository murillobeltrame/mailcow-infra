#!/usr/bin/env bash
set -euo pipefail

MAILCOW_DIR="${MAILCOW_DIR:-/opt/mailcow-dockerized}"
MAILCOW_HOSTNAME="${MAILCOW_HOSTNAME:?}"
MAIL_DOMAIN="${MAIL_DOMAIN:?}"
MAILCOW_API_KEY="${MAILCOW_API_KEY:?}"

cd "${MAILCOW_DIR}"

echo "==> Adicionando domínio ${MAIL_DOMAIN} via API..."
curl -sk -X POST "https://127.0.0.1/api/v1/add/domain" \
  -H "Host: ${MAILCOW_HOSTNAME}" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${MAILCOW_API_KEY}" \
  -d "{\"domain\":\"${MAIL_DOMAIN}\",\"active\":\"1\",\"aliases\":\"400\",\"mailboxes\":\"50\",\"defquota\":\"3072\",\"maxquota\":\"10240\",\"quota\":\"102400\",\"relayhost\":\"\",\"backupmx\":\"0\",\"gal\":\"1\"}"

echo ""
echo "==> Criando mailbox postmaster@${MAIL_DOMAIN}..."
curl -sk -X POST "https://127.0.0.1/api/v1/add/mailbox" \
  -H "Host: ${MAILCOW_HOSTNAME}" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${MAILCOW_API_KEY}" \
  -d "{\"local_part\":\"postmaster\",\"domain\":\"${MAIL_DOMAIN}\",\"name\":\"Postmaster\",\"quota\":\"1024\",\"password\":\"${MAILBOX_POSTMASTER_PASS:-ChangeMePostmaster2026!}\",\"active\":\"1\",\"force_pw_update\":\"0\"}"

echo ""
sleep 8
echo "==> DKIM disponível:"
docker compose exec -T rspamd-mailcow cat "/var/lib/rspamd/dkim/${MAIL_DOMAIN}.txt" 2>/dev/null || \
  find data/dkim -name "*.txt" 2>/dev/null || echo "Aguardando geração DKIM..."
