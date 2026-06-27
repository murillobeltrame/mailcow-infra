#!/usr/bin/env bash
# Insere domínios de e-mail no MySQL do Mailcow (fallback quando API falha).
set -euo pipefail

MAILCOW_DIR="${MAILCOW_DIR:-/opt/mailcow-dockerized}"
MAIL_DOMAIN="${MAIL_DOMAIN:?}"
EXTRA_MAIL_DOMAIN="${EXTRA_MAIL_DOMAIN:-}"

cd "${MAILCOW_DIR}"
DBPASS=$(grep '^DBPASS=' mailcow.conf | cut -d= -f2- | tr -d '\r')

insert_domain() {
  local domain="$1"
  local desc="$2"
  echo "==> MySQL domínio: ${domain}"
  docker compose exec -T mysql-mailcow mysql -umailcow -p"${DBPASS}" mailcow <<SQL
INSERT INTO domain (domain, description, aliases, mailboxes, defquota, maxquota, quota, relayhost, backupmx, gal, active)
VALUES ('${domain}', '${desc}', 400, 50, 3221225472, 10737418240, 107374182400, '', 0, 1, 1)
ON DUPLICATE KEY UPDATE active=1, description='${desc}';
SQL
}

insert_domain "${MAIL_DOMAIN}" "Nive Mail - ${MAIL_DOMAIN}"

if [[ -n "${EXTRA_MAIL_DOMAIN}" ]]; then
  insert_domain "${EXTRA_MAIL_DOMAIN}" "Nive Mail - ${EXTRA_MAIL_DOMAIN}"
fi

echo "==> Domínios ativos:"
docker compose exec -T mysql-mailcow mysql -umailcow -p"${DBPASS}" mailcow -N -e "SELECT domain,active FROM domain;"

echo "==> Reiniciando postfix/rspamd..."
docker compose restart rspamd-mailcow postfix-mailcow
