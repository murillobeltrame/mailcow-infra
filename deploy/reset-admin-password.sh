#!/usr/bin/env bash
set -euo pipefail

MAILCOW_DIR="${MAILCOW_DIR:-/opt/mailcow-dockerized}"
NEW_PASS="${MAILCOW_PASS:?MAILCOW_PASS obrigatório}"

cd "${MAILCOW_DIR}"
DBPASS=$(grep '^DBPASS=' mailcow.conf | cut -d= -f2)
DBUSER=$(grep '^DBUSER=' mailcow.conf | cut -d= -f2)
DBNAME=$(grep '^DBNAME=' mailcow.conf | cut -d= -f2)

echo "==> Senha atual em mailcow.conf:"
grep '^MAILCOW_PASS=' mailcow.conf || true

echo "==> Admin no banco:"
docker compose exec -T mysql-mailcow mysql -u"${DBUSER}" -p"${DBPASS}" "${DBNAME}" \
  -e "SELECT username, active, superadmin FROM admin;"

echo "==> Gerando hash BLF-CRYPT..."
HASH=$(docker compose exec -T dovecot-mailcow doveadm pw -s BLF-CRYPT -p "${NEW_PASS}" | tr -d '\r')

echo "==> Atualizando senha do admin..."
docker compose exec -T mysql-mailcow mysql -u"${DBUSER}" -p"${DBPASS}" "${DBNAME}" \
  -e "UPDATE admin SET password='${HASH}', active=1 WHERE username='admin';"

sed -i "s|^MAILCOW_PASS=.*|MAILCOW_PASS=${NEW_PASS}|" mailcow.conf

echo "==> Reiniciando php-fpm e nginx..."
docker compose restart php-fpm-mailcow nginx-mailcow

echo ""
echo "Login atualizado:"
echo "  URL:  https://${MAILCOW_HOSTNAME:-mail.corelycommerce.com.br}/admin"
echo "  User: admin"
echo "  Pass: ${NEW_PASS}"
