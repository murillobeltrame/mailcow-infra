#!/usr/bin/env bash
# Aplica senhas individuais nas caixas storembimportados (roda UMA VEZ no VPS).
# Senhas definidas no momento da geração — não commitar este arquivo com valores reais.
set -euo pipefail
cd /opt/mailcow-dockerized

MAILCOW_HOSTNAME=$(grep '^MAILCOW_HOSTNAME=' mailcow.conf | cut -d= -f2- | tr -d '\r"')
KEY=$(grep '^API_KEY=' mailcow.conf | cut -d= -f2- | tr -d '\r')

set_pw() {
  local email="$1"
  local pass="$2"
  echo "==> ${email}"
  curl -sk -X POST "https://127.0.0.1/api/v1/edit/mailbox" \
    -H "Host: ${MAILCOW_HOSTNAME}" \
    -H "Content-Type: application/json" \
    -H "X-API-Key: ${KEY}" \
    -d "$(python3 -c "import json,sys; print(json.dumps({'items':[sys.argv[1]],'attr':{'password':sys.argv[2],'password2':sys.argv[2],'force_pw_update':'0'}}))" "${email}" "${pass}")"
  echo ""
}

# Preencha antes de rodar (ou exporte CONTATO_PW, NOREPLY_PW, POSTMASTER_PW)
CONTATO_PW="${CONTATO_PW:?}"
NOREPLY_PW="${NOREPLY_PW:?}"
POSTMASTER_PW="${POSTMASTER_PW:?}"

set_pw "contato@storembimportados.com.br" "${CONTATO_PW}"
set_pw "noreply@storembimportados.com.br" "${NOREPLY_PW}"
set_pw "postmaster@storembimportados.com.br" "${POSTMASTER_PW}"

echo "Senhas aplicadas."
