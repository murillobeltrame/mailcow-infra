#!/usr/bin/env bash
# Cria postmaster@ em cada domínio (senha = MAILCOW_PASS).
set -euo pipefail

MAILCOW_DIR="${MAILCOW_DIR:-/opt/mailcow-dockerized}"
MAILCOW_HOSTNAME="${MAILCOW_HOSTNAME:?}"
MAILCOW_PASS="${MAILCOW_PASS:?}"
MAIL_DOMAIN="${MAIL_DOMAIN:?}"
EXTRA_MAIL_DOMAIN="${EXTRA_MAIL_DOMAIN:-}"

cd "${MAILCOW_DIR}"

add_mb() {
  local local_part="$1"
  local domain="$2"
  echo "==> ${local_part}@${domain}"
  curl -sk -X POST "https://127.0.0.1/api/v1/add/mailbox" \
    -H "Host: ${MAILCOW_HOSTNAME}" \
    -H "Content-Type: application/json" \
    -H "X-API-Key: $(grep '^API_KEY=' mailcow.conf | cut -d= -f2- | tr -d '\r')" \
    -d "{\"local_part\":\"${local_part}\",\"domain\":\"${domain}\",\"name\":\"${local_part^}\",\"quota\":\"3072\",\"password\":\"${MAILCOW_PASS}\",\"password2\":\"${MAILCOW_PASS}\",\"active\":\"1\",\"force_pw_update\":\"0\"}"
  echo ""
}

for d in "${MAIL_DOMAIN}" "${EXTRA_MAIL_DOMAIN}"; do
  [[ -z "${d}" ]] && continue
  add_mb "postmaster" "${d}" || true
  add_mb "contato" "${d}" || true
done

echo "==> Mailboxes:"
curl -sk "https://127.0.0.1/api/v1/get/mailbox/all" \
  -H "Host: ${MAILCOW_HOSTNAME}" \
  -H "X-API-Key: $(grep '^API_KEY=' mailcow.conf | cut -d= -f2- | tr -d '\r')" \
  | head -c 3000 || true
