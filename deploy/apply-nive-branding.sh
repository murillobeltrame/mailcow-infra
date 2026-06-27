#!/usr/bin/env bash
# Aplica identidade visual Nive Sistemas ao Mailcow (logo, textos, CSS, favicon, SOGo).
set -euo pipefail

MAILCOW_DIR="${MAILCOW_DIR:-/opt/mailcow-dockerized}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BRANDING_DIR="${SCRIPT_DIR}/../branding"
SOGO_BRANDING="${BRANDING_DIR}/sogo"
WEB="${MAILCOW_DIR}/data/web"
IMG="${WEB}/img"
CSS="${WEB}/css/build/0081-custom-mailcow.css"
SOGO_CONF_DIR="${MAILCOW_DIR}/data/conf/sogo"
OVERRIDE_FILE="${MAILCOW_DIR}/docker-compose.override.yml"
OVERRIDE_MARKER="# Nive Mail — SOGo custom theme CSS"

if [[ ! -d "${MAILCOW_DIR}" ]]; then
  echo "Mailcow não encontrado em ${MAILCOW_DIR}" >&2
  exit 1
fi

if [[ ! -d "${BRANDING_DIR}" ]]; then
  echo "Pasta branding não encontrada: ${BRANDING_DIR}" >&2
  exit 1
fi

echo "==> Copiando assets Nive (painel)..."
install -m 0644 "${BRANDING_DIR}/nive-icon.svg" "${IMG}/"
install -m 0644 "${BRANDING_DIR}/nive-icon-light.svg" "${IMG}/"
install -m 0644 "${BRANDING_DIR}/nive-logo.svg" "${IMG}/"
install -m 0644 "${BRANDING_DIR}/nive-logo-dark.svg" "${IMG}/"
install -m 0644 "${BRANDING_DIR}/nive-sidebar-brand.svg" "${IMG}/"
install -m 0644 "${BRANDING_DIR}/0081-custom-mailcow.css" "${CSS}"

if [[ -d "${SOGO_BRANDING}" ]]; then
  echo "==> Copiando assets Nive (SOGo)..."
  mkdir -p "${SOGO_CONF_DIR}"
  install -m 0644 "${SOGO_BRANDING}/custom-theme.js" "${SOGO_CONF_DIR}/custom-theme.js"
  install -m 0644 "${SOGO_BRANDING}/custom-theme.css" "${SOGO_CONF_DIR}/custom-theme.css"
  install -m 0644 "${SOGO_BRANDING}/custom-fulllogo.svg" "${SOGO_CONF_DIR}/custom-fulllogo.svg"
  install -m 0644 "${SOGO_BRANDING}/custom-shortlogo.svg" "${SOGO_CONF_DIR}/custom-shortlogo.svg"

  if command -v convert >/dev/null 2>&1; then
    convert -background none "${SOGO_BRANDING}/custom-fulllogo.svg" \
      -resize 256x256 "${SOGO_CONF_DIR}/custom-fulllogo.png"
    convert -background none "${BRANDING_DIR}/nive-icon.svg" \
      -resize 64x64 "${SOGO_CONF_DIR}/custom-favicon.ico"
  elif docker ps --format '{{.Names}}' | grep -q 'php-fpm-mailcow'; then
    PHP_CONTAINER="$(docker ps --format '{{.Names}}' | grep -E 'php-fpm-mailcow' | head -1)"
    docker exec "${PHP_CONTAINER}" convert -background none \
      "/web/img/nive-logo-dark.svg" -resize 256x256 "/etc/sogo/custom-fulllogo.png" 2>/dev/null || \
      cp "${SOGO_CONF_DIR}/custom-fulllogo.svg" "${SOGO_CONF_DIR}/custom-fulllogo.png" 2>/dev/null || true
    docker exec "${PHP_CONTAINER}" convert -background none \
      "/web/img/nive-icon.svg" -resize 64x64 "/etc/sogo/custom-favicon.ico" 2>/dev/null || true
  fi

  # Garante PNG/ICO mínimos se convert não existir
  if [[ ! -f "${SOGO_CONF_DIR}/custom-fulllogo.png" ]]; then
    cp "${SOGO_CONF_DIR}/custom-fulllogo.svg" "${SOGO_CONF_DIR}/custom-fulllogo.png" 2>/dev/null || true
  fi
  if [[ ! -f "${SOGO_CONF_DIR}/custom-favicon.ico" ]]; then
    cp "${BRANDING_DIR}/nive-icon.svg" "${SOGO_CONF_DIR}/custom-favicon.ico" 2>/dev/null || true
  fi

  echo "==> Configurando docker-compose.override.yml (SOGo CSS)..."
  SOGO_CSS_MOUNT="./data/conf/sogo/custom-theme.css:/usr/local/lib/GNUstep/SOGo/WebServerResources/css/theme-default.css:z"

  if [[ -f "${OVERRIDE_FILE}" ]] && grep -qF "${OVERRIDE_MARKER}" "${OVERRIDE_FILE}"; then
    echo "    Override Nive já presente — mantendo."
  elif [[ -f "${OVERRIDE_FILE}" ]] && grep -q 'custom-theme.css' "${OVERRIDE_FILE}"; then
    echo "    Override existente com custom-theme.css — não alterado."
  elif [[ -f "${OVERRIDE_FILE}" ]] && grep -q 'sogo-mailcow:' "${OVERRIDE_FILE}"; then
    python3 - "${OVERRIDE_FILE}" "${SOGO_CSS_MOUNT}" <<'PY' 2>/dev/null || true
import sys
path, mount = sys.argv[1], sys.argv[2]
with open(path) as f:
    content = f.read()
if mount.split(":")[0] in content:
    sys.exit(0)
lines = content.splitlines()
out, in_sogo, in_volumes, inserted = [], False, False, False
for line in lines:
    out.append(line)
    if line.strip().startswith("sogo-mailcow:"):
        in_sogo, in_volumes = True, False
    elif in_sogo and line.strip().startswith("volumes:"):
        in_volumes = True
    elif in_sogo and in_volumes and not inserted and line.startswith("      - "):
        out.append(f"      - {mount}")
        inserted = True
    elif in_sogo and in_volumes and line.strip() and not line.startswith(" ") and not line.startswith("-"):
        in_sogo, in_volumes = False, False
if not inserted:
    out.extend(["", "# Nive Mail — SOGo custom theme CSS", "services:", "  sogo-mailcow:", "    volumes:", f"      - {mount}"])
with open(path, "w") as f:
    f.write("\n".join(out) + "\n")
PY
    echo "    Volume SOGo CSS adicionado ao override existente."
  elif [[ -f "${OVERRIDE_FILE}" ]]; then
    cat >> "${OVERRIDE_FILE}" <<EOF

${OVERRIDE_MARKER}
services:
  sogo-mailcow:
    volumes:
      - ${SOGO_CSS_MOUNT}
EOF
    echo "    Bloco SOGo adicionado ao override existente."
  else
    cat > "${OVERRIDE_FILE}" <<EOF
${OVERRIDE_MARKER}
services:
  sogo-mailcow:
    volumes:
      - ${SOGO_CSS_MOUNT}
EOF
    echo "    Override criado."
  fi
fi

echo "==> Idioma padrão: português (Brasil)..."
install -m 0644 "${BRANDING_DIR}/vars.local.inc.php" "${WEB}/inc/vars.local.inc.php"

SOGO_CONF="${SOGO_CONF_DIR}/sogo.conf"
if [[ -f "${SOGO_CONF}" ]]; then
  sed -i '/^SOGoLanguage = .*;$/d' "${SOGO_CONF}"
  if grep -q 'SOGoLanguage' "${SOGO_CONF}"; then
    sed -i 's/SOGoLanguage = .*/SOGoLanguage = BrazilianPortuguese;/' "${SOGO_CONF}"
  else
    sed -i '0,/^{/s//{\n    SOGoLanguage = BrazilianPortuguese;/' "${SOGO_CONF}" 2>/dev/null || true
  fi
  echo "    SOGoLanguage = BrazilianPortuguese"
fi

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
redis_cli SET "APPS_NAME" "Seus serviços" >/dev/null
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

if docker ps --format '{{.Names}}' | grep -qE 'sogo-mailcow'; then
  echo "==> Aplicando override SOGo e reiniciando containers..."
  cd "${MAILCOW_DIR}"
  if [[ -f "${OVERRIDE_FILE}" ]] && grep -qF "${OVERRIDE_MARKER}" "${OVERRIDE_FILE}"; then
    docker compose up -d sogo-mailcow 2>/dev/null || docker-compose up -d sogo-mailcow 2>/dev/null || true
  fi
  docker compose restart sogo-mailcow memcached-mailcow 2>/dev/null || \
    docker-compose restart sogo-mailcow memcached-mailcow 2>/dev/null || true
fi

echo "==> Branding Nive aplicado com sucesso."
echo "    Admin: https://${MAILCOW_HOSTNAME:-mail.nivesistemas.com.br}/admin"
echo "    Webmail: https://${MAILCOW_HOSTNAME:-mail.nivesistemas.com.br}/SOGo"
echo "    Idioma: pt-br (painel) + BrazilianPortuguese (SOGo)"
