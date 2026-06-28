#!/usr/bin/env bash
# Sincroniza API_KEY do mailcow.conf com a tabela api (obrigatório para a API funcionar).
set -euo pipefail

MAILCOW_DIR="${MAILCOW_DIR:-/opt/mailcow-dockerized}"
cd "${MAILCOW_DIR}"

set_conf() {
  local key="$1"
  local value="$2"
  if grep -q "^${key}=" mailcow.conf; then
    sed -i "s|^${key}=.*|${key}=${value}|" mailcow.conf
  elif grep -q "^#${key}=" mailcow.conf; then
    sed -i "s|^#${key}=.*|${key}=${value}|" mailcow.conf
  else
    echo "${key}=${value}" >> mailcow.conf
  fi
}

set_conf API_ALLOW_FROM "127.0.0.1,172.22.1.1,172.23.1.0/24"

KEY=$(grep '^API_KEY=' mailcow.conf | cut -d= -f2- | tr -d '\r')
DBPASS=$(grep '^DBPASS=' mailcow.conf | cut -d= -f2- | tr -d '\r')

if [[ -z "${KEY}" ]]; then
  echo "API_KEY ausente em mailcow.conf"
  exit 1
fi

ALLOW="127.0.0.1,172.22.1.1,172.23.1.0/24"
docker compose exec -T mysql-mailcow mysql -u mailcow -p"${DBPASS}" mailcow -e "
DELETE FROM api;
INSERT INTO api (api_key, active, allow_from, access, skip_ip_check)
VALUES ('${KEY}', 1, '${ALLOW}', 'rw', 1);
" 2>/dev/null

HOST="${MAILCOW_HOSTNAME:?}"
VER=$(curl -sk "https://127.0.0.1/api/v1/get/status/version" \
  -H "Host: ${HOST}" \
  -H "X-API-Key: ${KEY}")
echo "API OK: ${VER}"
