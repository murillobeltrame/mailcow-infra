#!/usr/bin/env bash
set -euo pipefail
echo "=== Container status ==="
docker ps --format '{{.Names}}: {{.Status}}' | grep nive-mail || true
echo ""
echo "=== /app/dist/session.js ==="
docker exec nive-mail-web ls -la /app/dist/session.js
docker exec nive-mail-web grep -c resolveSessionFromCookie /app/dist/session.js && echo "OK: resolveSessionFromCookie presente"
echo ""
echo "=== Health ==="
curl -sk -o /dev/null -w "GET /mail/health -> HTTP %{http_code}\n" -H "Host: mail.nivesistemas.com.br" "https://127.0.0.1/mail/health"
