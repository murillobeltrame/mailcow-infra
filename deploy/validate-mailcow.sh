#!/usr/bin/env bash
set -euo pipefail

MAILCOW_DIR="${MAILCOW_DIR:-/opt/mailcow-dockerized}"
MAILCOW_HOSTNAME="${MAILCOW_HOSTNAME:?MAILCOW_HOSTNAME obrigatório}"

cd "${MAILCOW_DIR}"

echo "==> Status containers"
docker compose ps

echo ""
echo "==> Portas expostas"
ss -tlnp | grep -E ':25 |:465 |:587 |:993 |:143 |:80 |:443 ' || true

echo ""
echo "==> Teste SMTP local (porta 25)"
timeout 5 bash -c "echo QUIT | nc -w3 127.0.0.1 25" | head -3 || echo "SMTP local indisponível"

echo ""
echo "==> Teste HTTPS admin"
curl -skI "https://${MAILCOW_HOSTNAME}/admin" | head -5 || true

echo ""
echo "==> DKIM (copie para DNS após configure-dns.mjs --dkim)"
docker compose exec -T rspamd-mailcow cat "/var/lib/rspamd/dkim/${MAILCOW_HOSTNAME}.txt" 2>/dev/null || \
  echo "DKIM ainda não gerado — aguarde 2-5 min após o primeiro boot"
