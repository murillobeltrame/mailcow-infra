#!/usr/bin/env bash
set -euo pipefail

MAILCOW_DIR="${MAILCOW_DIR:-/opt/mailcow-dockerized}"
cd "${MAILCOW_DIR}"

set_conf() {
  local key="$1"
  local value="$2"
  if grep -q "^${key}=" mailcow.conf; then
    sed -i "s|^${key}=.*|${key}=${value}|" mailcow.conf
  else
    echo "${key}=${value}" >> mailcow.conf
  fi
}

echo "==> Otimizações de performance Mailcow"

# Antivírus de anexos Office — pesado e raramente necessário em VPS enxuto
set_conf SKIP_OLEFY y

# Swap evita travadas quando RAM enche (VPS compartilhado com ERP/Corely/etc.)
if ! swapon --show | grep -q .; then
  if [[ ! -f /swapfile ]]; then
    echo "==> Criando swap 2GB..."
    fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
    chmod 600 /swapfile
    mkswap /swapfile
  fi
  swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  echo "Swap ativo:"
  swapon --show
fi

echo "==> Recriando containers leves (olefy)..."
docker compose up -d

echo ""
echo "Config aplicada:"
grep -E 'SKIP_OLEFY|SKIP_CLAMD|SKIP_SOGO|SKIP_SOLR' mailcow.conf
