#!/usr/bin/env bash
set -euo pipefail
cd /opt/mailcow-dockerized
KEY=$(grep '^API_KEY=' mailcow.conf | cut -d= -f2- | tr -d '\r')
HOST="${MAILCOW_HOSTNAME:?}"
PASS="${MAILCOW_PASS:?}"

api() {
  curl -sk -X "$1" "https://127.0.0.1/api/v1/$2" \
    -H "Host: ${HOST}" \
    -H "Content-Type: application/json" \
    -H "X-API-Key: ${KEY}" \
    -d "$3"
}

echo "==> Mailboxes ativas:"
MAILBOXES=$(curl -sk "https://127.0.0.1/api/v1/get/mailbox/all" \
  -H "Host: ${HOST}" \
  -H "X-API-Key: ${KEY}" | grep -o '"username": "[^"]*"' | cut -d'"' -f4)

for mb in ${MAILBOXES}; do
  echo "==> Reset senha: ${mb}"
  api POST edit/mailbox "{\"items\":[\"${mb}\"],\"attr\":{\"password\":\"${PASS}\",\"password2\":\"${PASS}\",\"force_pw_update\":\"0\"}}"
  echo ""
done

echo "==> Senhas sincronizadas (MAILCOW_PASS). Rode verify-mail.sh para validar IMAP/SMTP."
