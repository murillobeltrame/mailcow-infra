#!/usr/bin/env bash
set -euo pipefail

MAILCOW_DIR="${MAILCOW_DIR:-/opt/mailcow-dockerized}"
NEW_HOST="${MAILCOW_HOSTNAME:?MAILCOW_HOSTNAME obrigatório}"
NEW_DOMAIN="${MAIL_DOMAIN:?MAIL_DOMAIN obrigatório}"
DBUSER="${DBUSER:-mailcow}"
DBNAME="${DBNAME:-mailcow}"

cd "${MAILCOW_DIR}"
DBPASS=$(grep '^DBPASS=' mailcow.conf | cut -d= -f2)
OLD_HOST=$(grep '^MAILCOW_HOSTNAME=' mailcow.conf | cut -d= -f2)

echo "==> Migrando hostname: ${OLD_HOST} -> ${NEW_HOST}"

sed -i "s|^MAILCOW_HOSTNAME=.*|MAILCOW_HOSTNAME=${NEW_HOST}|" mailcow.conf

echo "==> Parando stack..."
docker compose down

echo "==> Removendo container rspamd (cache do hostname antigo)..."
docker rm -f mailcowdockerized-rspamd-mailcow-1 2>/dev/null || true

echo "==> Subindo stack..."
docker compose up -d

echo "==> Aguardando serviços..."
sleep 45

echo "==> Adicionando domínio de e-mail ${NEW_DOMAIN}..."
docker compose exec -T mysql-mailcow mysql -u"${DBUSER}" -p"${DBPASS}" "${DBNAME}" <<SQL
INSERT INTO domain (domain, description, aliases, mailboxes, defquota, maxquota, quota, relayhost, backupmx, gal, active)
VALUES ('${NEW_DOMAIN}', 'Nive Sistemas', 400, 50, 3221225472, 10737418240, 107374182400, '', 0, 1, 1)
ON DUPLICATE KEY UPDATE active=1;
SQL

echo "==> Reiniciando ACME para novo certificado..."
docker compose restart acme-mailcow unbound-mailcow
sleep 90

docker compose logs acme-mailcow --tail 12
openssl x509 -in data/assets/ssl/cert.pem -noout -subject -issuer 2>/dev/null || true

echo ""
echo "Hostname migrado: https://${NEW_HOST}/admin"
echo "Configure PTR: ${NEW_HOST} -> IP do VPS"
