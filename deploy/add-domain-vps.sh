#!/usr/bin/env bash
# Adiciona domínio de e-mail no Mailcow: domínio + contato/noreply/postmaster + DKIM
# Uso no VPS: bash add-domain-vps.sh storembimportados.com.br
set -euo pipefail

DOMAIN="${1:?domínio obrigatório, ex: storembimportados.com.br}"
MAILCOW_DIR="${MAILCOW_DIR:-/opt/mailcow-dockerized}"
cd "${MAILCOW_DIR}"

read_conf() { grep "^${1}=" mailcow.conf | cut -d= -f2- | tr -d '\r"' || true; }

MAILCOW_HOSTNAME=$(read_conf MAILCOW_HOSTNAME)
MAILCOW_PASS=$(read_conf MAILCOW_PASS)
DBPASS=$(read_conf DBPASS)
KEY=$(read_conf API_KEY)

echo "==> Domínio: ${DOMAIN}"

docker compose exec -T mysql-mailcow mysql -umailcow -p"${DBPASS}" mailcow \
  -e "INSERT INTO domain (domain, description, aliases, mailboxes, defquota, maxquota, quota, relayhost, backupmx, gal, active)
      VALUES ('${DOMAIN}', 'Nive Mail - ${DOMAIN}', 400, 50, 3221225472, 10737418240, 107374182400, '', 0, 1, 1)
      ON DUPLICATE KEY UPDATE active=1, description='Nive Mail - ${DOMAIN}';"

docker compose exec -T mysql-mailcow mysql -umailcow -p"${DBPASS}" mailcow \
  -e "SELECT domain, active FROM domain WHERE domain='${DOMAIN}';"

for local in postmaster contato noreply; do
  echo "==> ${local}@${DOMAIN}"
  RESP=$(curl -sk -X POST "https://127.0.0.1/api/v1/add/mailbox" \
    -H "Host: ${MAILCOW_HOSTNAME}" \
    -H "Content-Type: application/json" \
    -H "X-API-Key: ${KEY}" \
    -d "{\"local_part\":\"${local}\",\"domain\":\"${DOMAIN}\",\"name\":\"${local^}\",\"quota\":\"3072\",\"password\":\"${MAILCOW_PASS}\",\"password2\":\"${MAILCOW_PASS}\",\"active\":\"1\",\"force_pw_update\":\"0\"}")
  echo "${RESP}" | head -c 200
  echo ""
done

echo "==> DKIM ${DOMAIN}"
docker compose exec -T rspamd-mailcow rspamadm dkim_keygen -d "${DOMAIN}" -s dkim 2>/dev/null || true
docker compose exec -T rspamd-mailcow cat "/var/lib/rspamd/dkim/${DOMAIN}.txt" 2>/dev/null | grep -o '"p=[^"]*"' | head -1 || true
docker compose restart rspamd-mailcow postfix-mailcow

# DKIM para publicar no Cloudflare (node add-domain-dns.mjs ... --dkim)
echo "==> DKIM TXT (copie se precisar publicar DNS):"
docker compose exec -T rspamd-mailcow cat "/var/lib/rspamd/dkim/${DOMAIN}.txt" 2>/dev/null | tr -d '\n' | grep -o 'v=DKIM1[^)]*' | head -1 || true
echo ""
echo "==> Concluído: ${DOMAIN}"
