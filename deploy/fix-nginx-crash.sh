#!/usr/bin/env bash
# Hotfix: restaura nginx apos config invalida em site.nive-mail-redirects.custom
set -euo pipefail
MAILCOW_DIR="${MAILCOW_DIR:-/opt/mailcow-dockerized}"
cd "${MAILCOW_DIR}"

echo "==> Restaurando site.nive-mail-redirects.custom (sem limit_except invalido)..."
mkdir -p data/conf/nginx
cat > data/conf/nginx/site.nive-mail-redirects.custom <<'NGINX'
# Portal Nive Mail — raiz e painéis PHP legados → /mail/login ou portal React
location = / {
    return 302 /mail/login;
}
location = /user {
    return 302 /mail/account;
}
location ^~ /user/ {
    return 302 /mail/account;
}
location = /admin {
    return 302 /mail/admin;
}
location ^~ /admin/ {
    return 302 /mail/admin;
}
location = /domainadmin {
    return 302 /mail/domain;
}
location ^~ /domainadmin/ {
    return 302 /mail/domain;
}
location ~ ^/SOGo/so/[^/]+/Mail(/|$) {
    return 302 /mail/;
}
location ~ ^/SOGo/so/[^/]+/Calendar(/|$) {
    return 302 /mail/calendar;
}
location ~ ^/SOGo/so/[^/]+/Contacts(/|$) {
    return 302 /mail/contacts;
}
NGINX

echo "==> Reiniciando nginx-mailcow..."
docker compose restart nginx-mailcow
sleep 5

NG=$(docker ps --filter "name=nginx-mailcow" --format "{{.Names}}: {{.Status}}" | head -1)
echo "Status: ${NG}"

HOST=$(grep '^MAILCOW_HOSTNAME=' mailcow.conf | cut -d= -f2- | tr -d '\r"')
for path in / /mail/login /mail/ /mail/health; do
  code=$(curl -sk -o /dev/null -w "%{http_code}" -H "Host: ${HOST}" "https://127.0.0.1${path}" --max-time 10 || echo "000")
  echo "GET ${path} -> HTTP ${code}"
done
