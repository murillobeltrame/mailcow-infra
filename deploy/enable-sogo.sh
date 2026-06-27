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

echo "==> Ativando SOGo (webmail / calendário / contatos)..."
set_conf SKIP_SOGO n

echo "==> Recriando stack..."
docker compose up -d

echo "==> Aguardando SOGo..."
for i in 1 2 3 4 5 6; do
  if docker ps --format '{{.Names}}' | grep -q sogo-mailcow; then
    break
  fi
  sleep 10
done

sleep 10

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "==> SOGo: habilitar acesso nas caixas..."
bash "${SCRIPT_DIR}/fix-sogo-access.sh"
echo "==> SOGo: sincronizar usuarios (_sogo_static_view)..."
bash "${SCRIPT_DIR}/fix-sogo-static-view.sh"
echo "==> SOGo: SSO Dovecot + redirect..."
bash "${SCRIPT_DIR}/fix-sogo-sso-dovecot.sh"
bash "${SCRIPT_DIR}/fix-sogo-sso-redirect.sh"

echo ""
echo "Containers Mailcow:"
docker ps --format '{{.Names}}\t{{.Status}}' | grep mailcow | sort

echo ""
grep -E 'SKIP_SOGO|SKIP_CLAMD|SKIP_OLEFY' mailcow.conf
HOST="${MAILCOW_HOSTNAME:-mail.nivesistemas.com.br}"
echo ""
echo "Webmail: https://${HOST}/SOGo"
echo "Painel admin: https://${HOST}/admin"
echo "Login: https://${HOST}/ (usuário da caixa) -> botão Webmail"
echo "  ou admin -> caixa -> Editar -> Encaminhamento direto para SOGo"
