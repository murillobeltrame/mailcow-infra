#!/usr/bin/env bash
set -euo pipefail
cd /opt/mailcow-dockerized
KEY=$(grep '^API_KEY=' mailcow.conf | cut -d= -f2- | tr -d '\r')
HOST=$(grep '^MAILCOW_HOSTNAME=' mailcow.conf | cut -d= -f2- | tr -d '\r')
USER="contato@nivesistemas.com.br"
PASS="${1:?senha obrigatoria}"

curl -sk -X POST "https://127.0.0.1/api/v1/edit/mailbox" \
  -H "Host: ${HOST}" \
  -H "X-API-Key: ${KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"items\":[\"${USER}\"],\"attr\":{\"password\":\"${PASS}\",\"password2\":\"${PASS}\",\"force_pw_update\":\"0\"}}"
echo ""
