#!/usr/bin/env bash
set -euo pipefail

MAILCOW_DIR="${MAILCOW_DIR:-/opt/mailcow-dockerized}"
MAIL_DOMAIN="${MAIL_DOMAIN:?}"
DBUSER="${DBUSER:-mailcow}"
DBNAME="${DBNAME:-mailcow}"

cd "${MAILCOW_DIR}"
DBPASS=$(grep '^DBPASS=' mailcow.conf | cut -d= -f2)

echo "==> Inserindo domínio ${MAIL_DOMAIN}..."
docker compose exec -T mysql-mailcow mysql -u"${DBUSER}" -p"${DBPASS}" "${DBNAME}" <<SQL
INSERT INTO domain (domain, description, aliases, mailboxes, defquota, maxquota, quota, relayhost, backupmx, gal, active)
VALUES ('${MAIL_DOMAIN}', 'Corely Commerce', 400, 50, 3221225472, 10737418240, 107374182400, '', 0, 1, 1)
ON DUPLICATE KEY UPDATE active=1;
SQL

echo "==> Gerando DKIM via rspamd..."
docker compose exec -T rspamd-mailcow rspamadm dkim_keygen -d "${MAIL_DOMAIN}" -s dkim -k "/var/lib/rspamd/dkim/${MAIL_DOMAIN}.dkim.key" 2>/dev/null || true
docker compose exec -T rspamd-mailcow sh -c "test -f /var/lib/rspamd/dkim/${MAIL_DOMAIN}.txt && cat /var/lib/rspamd/dkim/${MAIL_DOMAIN}.txt || ls -la /var/lib/rspamd/dkim/"

echo "==> Reiniciando rspamd/postfix..."
docker compose restart rspamd-mailcow postfix-mailcow
