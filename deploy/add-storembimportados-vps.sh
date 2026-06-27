#!/usr/bin/env bash
# Cria domínio storembimportados.com.br + contato@ e noreply@ no Nive Mail.
# VPS: curl -fsSL -o /tmp/add-storemb.sh URL && bash /tmp/add-storemb.sh
set -euo pipefail

DOMAIN="storembimportados.com.br"
MAILCOW_DIR="${MAILCOW_DIR:-/opt/mailcow-dockerized}"
cd "${MAILCOW_DIR}"

read_conf() { grep "^${1}=" mailcow.conf | cut -d= -f2- | tr -d '\r"' || true; }

MAILCOW_HOSTNAME=$(read_conf MAILCOW_HOSTNAME)
MAILCOW_PASS=$(read_conf MAILCOW_PASS)
DBPASS=$(read_conf DBPASS)
KEY=$(read_conf API_KEY)

[[ -n "${KEY}" ]] || { echo "ERRO: API_KEY ausente"; exit 1; }

grep -q '^API_ALLOW_FROM=' mailcow.conf || echo 'API_ALLOW_FROM=127.0.0.1,172.22.1.1,172.23.1.1' >> mailcow.conf
docker compose exec -T mysql-mailcow mysql -umailcow -p"${DBPASS}" mailcow \
  -e "DELETE FROM api; INSERT INTO api (api_key, active, allow_from, access) VALUES ('${KEY}', 1, '127.0.0.1,172.22.1.1,172.23.1.1', 'rw');" 2>/dev/null || true

echo "==> Domínio ${DOMAIN}"
docker compose exec -T mysql-mailcow mysql -umailcow -p"${DBPASS}" mailcow \
  -e "INSERT INTO domain (domain, description, aliases, mailboxes, defquota, maxquota, quota, relayhost, backupmx, gal, active)
      VALUES ('${DOMAIN}', 'Nive Mail - MB Importados', 400, 50, 3221225472, 10737418240, 107374182400, '', 0, 1, 1)
      ON DUPLICATE KEY UPDATE active=1, description='Nive Mail - MB Importados';"

add_mb() {
  local local_part="$1"
  local name="$2"
  echo "==> ${local_part}@${DOMAIN}"
  RESP=$(curl -sk -X POST "https://127.0.0.1/api/v1/add/mailbox" \
    -H "Host: ${MAILCOW_HOSTNAME}" \
    -H "Content-Type: application/json" \
    -H "X-API-Key: ${KEY}" \
    -d "{\"local_part\":\"${local_part}\",\"domain\":\"${DOMAIN}\",\"name\":\"${name}\",\"quota\":\"3072\",\"password\":\"${MAILCOW_PASS}\",\"password2\":\"${MAILCOW_PASS}\",\"active\":\"1\",\"force_pw_update\":\"0\"}")
  if echo "${RESP}" | grep -q 'object_exists'; then
    curl -sk -X POST "https://127.0.0.1/api/v1/edit/mailbox" \
      -H "Host: ${MAILCOW_HOSTNAME}" \
      -H "Content-Type: application/json" \
      -H "X-API-Key: ${KEY}" \
      -d "{\"items\":[\"${local_part}@${DOMAIN}\"],\"attr\":{\"password\":\"${MAILCOW_PASS}\",\"password2\":\"${MAILCOW_PASS}\",\"force_pw_update\":\"0\"}}" \
      > /dev/null
    echo "  já existia — senha atualizada"
  else
    echo "  ${RESP}" | head -c 150
    echo ""
  fi
}

add_mb "contato" "Contato MB Importados"
add_mb "noreply" "No Reply MB Importados"
add_mb "postmaster" "Postmaster"

echo ""
echo "==> Caixas ${DOMAIN}:"
docker compose exec -T mysql-mailcow mysql -umailcow -p"${DBPASS}" mailcow \
  -e "SELECT username, active FROM mailbox WHERE username LIKE '%@${DOMAIN}';" 2>/dev/null

echo ""
echo "==> DKIM"
docker compose exec -T rspamd-mailcow rspamadm dkim_keygen -d "${DOMAIN}" -s dkim 2>/dev/null || true
docker compose restart rspamd-mailcow postfix-mailcow

echo ""
echo "Concluído. Use contato@${DOMAIN} no SMTP (senha = MAILCOW_PASS)."
