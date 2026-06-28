#!/usr/bin/env bash
# Garante volumes CSS + JS do tema Nive no docker-compose.override.yml
set -euo pipefail

MAILCOW_DIR="${MAILCOW_DIR:-/opt/mailcow-dockerized}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ -f "${MAILCOW_DIR}/docker-compose.override.yml" ]] && \
   grep -q 'mapping key "services" already defined' <(docker compose -f "${MAILCOW_DIR}/docker-compose.yml" -f "${MAILCOW_DIR}/docker-compose.override.yml" config 2>&1 || true); then
  echo "Override YAML inválido — reparando..."
  bash "${SCRIPT_DIR}/repair-compose-override.sh"
  exit 0
fi

# Se override não existe ou está quebrado (múltiplos services:), reparar
if [[ -f "${MAILCOW_DIR}/docker-compose.override.yml" ]]; then
  count=$(grep -c '^services:' "${MAILCOW_DIR}/docker-compose.override.yml" || true)
  if [[ "${count}" -gt 1 ]]; then
    echo "Override com ${count} blocos services — reparando..."
    bash "${SCRIPT_DIR}/repair-compose-override.sh"
    exit 0
  fi
fi

OVERRIDE="${MAILCOW_DIR}/docker-compose.override.yml"
MARKER="# Nive Mail — SOGo custom theme"
CSS="./data/conf/sogo/custom-theme.css:/usr/local/lib/GNUstep/SOGo/WebServerResources/css/theme-default.css:z"
JS="./data/conf/sogo/custom-theme.js:/usr/local/lib/GNUstep/SOGo/WebServerResources/js/theme.js:z"

if [[ ! -f "${OVERRIDE}" ]] || ! grep -q 'custom-theme.css' "${OVERRIDE}" 2>/dev/null; then
  bash "${SCRIPT_DIR}/repair-compose-override.sh"
fi

echo "Volumes SOGo OK em ${OVERRIDE}"
