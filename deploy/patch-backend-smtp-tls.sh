#!/usr/bin/env bash
# Aplica hotfix TLS SMTP no backend em produção (mesmo VPS que o Mailcow).
set -euo pipefail
APP="/var/www/corely-foundation-builders/backend"
FILE="$APP/src/notifications/notifications.service.ts"
grep -q 'buildSmtpTransportOptions' "$FILE" && { echo "Hotfix já aplicado."; exit 0; }
echo "ERRO: faça git pull + deploy do corely-foundation-builders (fix TLS SMTP em notifications.service.ts)"
