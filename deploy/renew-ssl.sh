#!/usr/bin/env bash
set -euo pipefail
cd /opt/mailcow-dockerized

echo "==> Forçando nova tentativa Let's Encrypt..."
docker compose restart acme-mailcow
sleep 60
docker compose logs acme-mailcow --tail 20

echo ""
echo "==> Certificado atual:"
openssl x509 -in data/assets/ssl/cert.pem -noout -subject -issuer -dates 2>/dev/null || true

docker compose restart nginx-mailcow
