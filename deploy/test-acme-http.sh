#!/usr/bin/env bash
set -euo pipefail
cd /opt/mailcow-dockerized

docker compose exec -T acme-mailcow sh <<'EOF'
R=999888777
echo "$R" > /var/www/acme/$R
echo "FILE=$(cat /var/www/acme/$R)"
echo "CURL autodiscover=$(curl --insecure -4 -L "http://autodiscover.corelycommerce.com.br/.well-known/acme-challenge/$R" --silent)"
echo "CURL mail=$(curl --insecure -4 -L "http://mail.corelycommerce.com.br/.well-known/acme-challenge/$R" --silent)"
rm -f /var/www/acme/$R
EOF
