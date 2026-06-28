#!/usr/bin/env bash
# Rebuild forçado do webmail a partir do repo no VPS (sem .env.deploy).
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/mailcow-infra}"
MAILCOW_DIR="${MAILCOW_DIR:-/opt/mailcow-dockerized}"
HOST="${MAILCOW_HOSTNAME:-mail.nivesistemas.com.br}"

echo "=== Rebuild webmail ==="
cd "$APP_DIR"
git fetch origin master
git reset --hard origin/master
echo "Commit: $(git log -1 --oneline)"

echo "==> docker build..."
docker build -t nive-mail-web:latest "$APP_DIR/webmail"

echo "==> repair compose override..."
bash "$APP_DIR/deploy/repair-compose-override.sh"

echo "==> recreate container..."
cd "$MAILCOW_DIR"
docker compose up -d --force-recreate nive-mail-web

sleep 5
echo ""
echo "=== Verificação ==="
docker ps --format '{{.Names}}: {{.Status}}' | grep nive-mail || true

if docker exec nive-mail-web grep -q "resolveSessionFromCookie" /app/dist/session.js; then
  echo "OK: sessão server-side no container"
else
  echo "ERRO: fix de sessão ausente" >&2
  docker exec nive-mail-web head -5 /app/dist/session.js 2>/dev/null || true
  exit 2
fi

curl -sk -o /dev/null -w "GET /mail/health -> HTTP %{http_code}\n" -H "Host: ${HOST}" "https://127.0.0.1/mail/health"
echo "Concluído."
