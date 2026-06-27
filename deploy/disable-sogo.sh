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

echo "==> Desativando SOGo (calendário/contatos/webmail)..."
set_conf SKIP_SOGO y

echo "==> Recriando stack..."
docker compose up -d

sleep 15
echo ""
echo "Containers Mailcow:"
docker ps --format '{{.Names}}' | grep mailcow | sort

echo ""
grep -E 'SKIP_SOGO|SKIP_CLAMD|SKIP_OLEFY' mailcow.conf
echo ""
echo "Painel admin (config SMTP/caixas): https://${MAILCOW_HOSTNAME:-mail.nivesistemas.com.br}/admin"
echo "Leitura/envio: use cliente IMAP/SMTP (Thunderbird, Outlook, celular)"
echo "  IMAP: mail.nivesistemas.com.br:993 (SSL)"
echo "  SMTP: smtp.nivesistemas.com.br:587 (STARTTLS) ou :465 (SSL)"
