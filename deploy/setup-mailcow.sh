#!/usr/bin/env bash
set -euo pipefail

MAILCOW_DIR="${MAILCOW_DIR:-/opt/mailcow-dockerized}"
MAILCOW_HOSTNAME="${MAILCOW_HOSTNAME:?MAILCOW_HOSTNAME obrigatório}"
MAILCOW_TZ="${MAILCOW_TZ:-America/Sao_Paulo}"
MAILCOW_BRANCH="${MAILCOW_BRANCH:-master}"

echo "==> Mailcow setup: ${MAILCOW_HOSTNAME}"

if ! command -v docker >/dev/null; then
  echo "Docker não encontrado. Instale Docker antes de continuar."
  exit 1
fi

if [[ ! -d "${MAILCOW_DIR}/.git" ]]; then
  echo "==> Clonando mailcow-dockerized..."
  git clone --depth 1 -b "${MAILCOW_BRANCH}" \
    https://github.com/mailcow/mailcow-dockerized.git "${MAILCOW_DIR}"
fi

cd "${MAILCOW_DIR}"

if [[ ! -f mailcow.conf ]]; then
  echo "==> Gerando mailcow.conf..."
  export MAILCOW_HOSTNAME MAILCOW_TZ
  ./generate_config.sh <<EOF
${MAILCOW_HOSTNAME}
${MAILCOW_TZ}
EOF
fi

echo "==> Ajustando mailcow.conf para VPS 8GB..."
touch mailcow.conf

set_conf() {
  local key="$1"
  local value="$2"
  if grep -q "^${key}=" mailcow.conf; then
    sed -i "s|^${key}=.*|${key}=${value}|" mailcow.conf
  else
    echo "${key}=${value}" >> mailcow.conf
  fi
}

# Economiza ~1.5 GB RAM; antivírus opcional em produção enxuta
set_conf SKIP_CLAMD y
set_conf SKIP_SOLR y
set_conf SKIP_SOGO n
set_conf HTTP_PORT 80
set_conf HTTPS_PORT 443
set_conf MAILCOW_TZ "${MAILCOW_TZ}"
set_conf ADDITIONAL_SAN ""

if [[ -n "${MAILCOW_PASS:-}" ]]; then
  set_conf MAILCOW_PASS "${MAILCOW_PASS}"
fi

if [[ -n "${MAILCOW_API_KEY:-}" ]]; then
  set_conf API_KEY "${MAILCOW_API_KEY}"
fi

echo "==> Baixando imagens Docker (pode levar vários minutos)..."
docker compose pull

echo "==> Subindo stack Mailcow..."
docker compose up -d

echo "==> Aguardando containers ficarem healthy..."
sleep 30
docker compose ps

echo ""
echo "Setup concluído."
echo "Painel: https://${MAILCOW_HOSTNAME}/admin"
echo "Webmail: https://${MAILCOW_HOSTNAME}/SOGo"
echo ""
echo "Próximos passos:"
echo "  1. node deploy/configure-dns.mjs"
echo "  2. Configurar PTR/rDNS no hPanel Hostinger: ${MAILCOW_HOSTNAME}"
echo "  3. Adicionar domínios extras no painel admin"
