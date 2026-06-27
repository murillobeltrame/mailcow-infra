#!/usr/bin/env bash
set -euo pipefail
cd /opt/mailcow-dockerized

grep -q '^SKIP_HTTP_VERIFICATION=' mailcow.conf \
  && sed -i 's/^SKIP_HTTP_VERIFICATION=.*/SKIP_HTTP_VERIFICATION=y/' mailcow.conf \
  || echo 'SKIP_HTTP_VERIFICATION=y' >> mailcow.conf

echo "SKIP_HTTP_VERIFICATION=$(grep SKIP_HTTP_VERIFICATION mailcow.conf)"

docker compose restart acme-mailcow
sleep 90
docker compose logs acme-mailcow --tail 15

echo ""
openssl x509 -in data/assets/ssl/cert.pem -noout -issuer -dates 2>/dev/null

docker compose restart nginx-mailcow
