#!/usr/bin/env bash
# Aplica identidade visual Nive Sistemas ao Mailcow (logo, textos, CSS, favicon).
set -euo pipefail

MAILCOW_DIR="${MAILCOW_DIR:-/opt/mailcow-dockerized}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BRANDING_DIR="${SCRIPT_DIR}/../branding"
WEB="${MAILCOW_DIR}/data/web"
IMG="${WEB}/img"
CSS="${WEB}/css/build/0081-custom-mailcow.css"

if [[ ! -d "${MAILCOW_DIR}" ]]; then
  echo "Mailcow não encontrado em ${MAILCOW_DIR}" >&2
  exit 1
fi

if [[ ! -d "${BRANDING_DIR}" ]]; then
  echo "Pasta branding não encontrada: ${BRANDING_DIR}" >&2
  exit 1
fi

echo "==> Copiando assets Nive..."
install -m 0644 "${BRANDING_DIR}/nive-icon.svg" "${IMG}/"
install -m 0644 "${BRANDING_DIR}/nive-icon-light.svg" "${IMG}/"
install -m 0644 "${BRANDING_DIR}/nive-logo.svg" "${IMG}/"
install -m 0644 "${BRANDING_DIR}/nive-logo-dark.svg" "${IMG}/"
install -m 0644 "${BRANDING_DIR}/nive-sidebar-brand.svg" "${IMG}/"
install -m 0644 "${BRANDING_DIR}/0081-custom-mailcow.css" "${CSS}"

REDIS_PASS="$(grep -E '^REDISPASS=' "${MAILCOW_DIR}/mailcow.conf" | cut -d= -f2- | tr -d '\r')"
REDIS_CONTAINER="$(docker ps --format '{{.Names}}' | grep -E 'redis-mailcow' | head -1)"

if [[ -z "${REDIS_CONTAINER}" ]]; then
  echo "Container Redis Mailcow não encontrado." >&2
  exit 1
fi

redis_cli() {
  docker exec "${REDIS_CONTAINER}" redis-cli -a "${REDIS_PASS}" --no-auth-warning "$@"
}

set_logo_redis() {
  local key="$1"
  local file="$2"
  local mime="$3"
  local payload
  payload="data:${mime};base64,$(base64 -w0 "${file}" 2>/dev/null || base64 "${file}" | tr -d '\n')"
  redis_cli SET "${key}" "${payload}" >/dev/null
  echo "    Redis ${key} OK"
}

echo "==> Configurando logos no Redis..."
set_logo_redis "MAIN_LOGO" "${IMG}/nive-logo.svg" "image/svg+xml"
set_logo_redis "MAIN_LOGO_DARK" "${IMG}/nive-logo-dark.svg" "image/svg+xml"

echo "==> Configurando textos da interface..."
redis_cli SET "TITLE_NAME" "Nive Mail" >/dev/null
redis_cli SET "MAIN_NAME" "Nive Mail" >/dev/null
redis_cli SET "APPS_NAME" "Aplicativos" >/dev/null
redis_cli SET "UI_FOOTER" "© Nive Sistemas — Nive Mail" >/dev/null

echo "==> Gerando favicon..."
if command -v convert >/dev/null 2>&1; then
  convert -background none "${IMG}/nive-icon.svg" -resize 64x64 "${WEB}/favicon.png"
elif docker ps --format '{{.Names}}' | grep -q 'php-fpm-mailcow'; then
  PHP_CONTAINER="$(docker ps --format '{{.Names}}' | grep -E 'php-fpm-mailcow' | head -1)"
  docker exec "${PHP_CONTAINER}" convert -background none "/web/img/nive-icon.svg" -resize 64x64 "/web/favicon.png" 2>/dev/null || true
fi

echo "==> Limpando cache Twig..."
rm -rf "${WEB}/templates/cache/"* 2>/dev/null || true

PHP_CONTAINER="$(docker ps --format '{{.Names}}' | grep -E 'php-fpm-mailcow' | head -1 || true)"
if [[ -n "${PHP_CONTAINER}" ]]; then
  echo "==> Limpando cache CSS PHP..."
  docker exec "${PHP_CONTAINER}" find /tmp -maxdepth 1 -name '*.css' -delete 2>/dev/null || true
fi

echo "==> Branding Nive aplicado com sucesso."
echo "    Admin: https://${MAILCOW_HOSTNAME:-mail.nivesistemas.com.br}/admin"
