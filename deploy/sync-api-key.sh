#!/usr/bin/env bash
# Sincroniza API_KEY do mailcow.conf com a tabela api (obrigatório para a API funcionar).
set -euo pipefail

MAILCOW_DIR="${MAILCOW_DIR:-/opt/mailcow-dockerized}"
cd "${MAILCOW_DIR}"

if [[ -z "${MAILCOW_HOSTNAME:-}" ]] && [[ -f mailcow.conf ]]; then
  MAILCOW_HOSTNAME=$(grep '^MAILCOW_HOSTNAME=' mailcow.conf | cut -d= -f2- | tr -d '\r')
fi
export MAILCOW_HOSTNAME

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
STRICT="${SYNC_API_STRICT:-0}"
VERIFY_BFF="${SYNC_API_VERIFY_BFF:-${STRICT}}"
TRIES="${SYNC_API_RETRIES:-12}"
SLEEP="${SYNC_API_SLEEP:-5}"

if [[ "${VERIFY_BFF}" = "1" || "${STRICT}" = "1" ]]; then
  api_ready=false
  for ((i=1; i<=TRIES; i++)); do
    VER=$(curl -sk "https://127.0.0.1/api/v1/get/status/version" \
      -H "Host: ${HOST}" \
      -H "X-API-Key: ${KEY}" 2>/dev/null || true)
    if echo "${VER}" | grep -q '"version"'; then
      echo "API OK: ${VER}"
      api_ready=true
      break
    fi
    echo "Aguardando API Mailcow (${i}/${TRIES})..."
    sleep "${SLEEP}"
  done

  if [[ "${api_ready}" != true ]]; then
    echo "AVISO: API Mailcow ainda nao respondeu (nginx/php reiniciando?)" >&2
    if [[ "${STRICT}" = "1" ]]; then
      exit 1
    fi
  fi
else
  VER=$(curl -sk "https://127.0.0.1/api/v1/get/status/version" \
    -H "Host: ${HOST}" \
    -H "X-API-Key: ${KEY}" 2>/dev/null || true)
  if echo "${VER}" | grep -q '"version"'; then
    echo "API OK: ${VER}"
  else
    echo "API key sincronizada (verificacao completa no pos-deploy)"
  fi
fi

if [[ "${VERIFY_BFF}" = "1" ]] && docker ps --format '{{.Names}}' | grep -q '^nive-mail-web$'; then
  bff_ok=false
  for ((i=1; i<=TRIES; i++)); do
    if docker exec nive-mail-web node --input-type=module -e "
import { listDomains } from '/app/dist/mailcow-api.js';
const d = await listDomains();
if (!Array.isArray(d) || d.length < 1) throw new Error('listDomains vazio');
console.log('BFF API OK:', d.length, 'dominios');
" 2>/dev/null; then
      bff_ok=true
      break
    fi
    echo "Aguardando BFF portal (${i}/${TRIES})..."
    sleep "${SLEEP}"
  done
  if [[ "${bff_ok}" != true ]]; then
    echo "AVISO: portal ainda nao consegue listDomains (servicos reiniciando?)" >&2
    if [[ "${STRICT}" = "1" ]]; then
      exit 1
    fi
  fi
fi
