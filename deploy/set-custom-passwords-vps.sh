#!/usr/bin/env bash
# Define senhas específicas nas caixas Nive/Corely (roda no VPS).
set -euo pipefail
cd /opt/mailcow-dockerized

MAILCOW_HOSTNAME=$(grep '^MAILCOW_HOSTNAME=' mailcow.conf | cut -d= -f2- | tr -d '\r"')
KEY=$(grep '^API_KEY=' mailcow.conf | cut -d= -f2- | tr -d '\r')
DBPASS=$(grep '^DBPASS=' mailcow.conf | cut -d= -f2- | tr -d '\r')

# Sync API
docker compose exec -T mysql-mailcow mysql -umailcow -p"${DBPASS}" mailcow \
  -e "DELETE FROM api; INSERT INTO api (api_key, active, allow_from, access) VALUES ('${KEY}', 1, '127.0.0.1,172.22.1.1,172.23.1.1', 'rw');" 2>/dev/null || true

set_pw() {
  local email="$1"
  local pass="$2"
  local domain="${email#*@}"
  local local_part="${email%@*}"

  echo "==> ${email}"
  EXISTS=$(curl -sk "https://127.0.0.1/api/v1/get/mailbox/all" \
    -H "Host: ${MAILCOW_HOSTNAME}" -H "X-API-Key: ${KEY}" \
    | grep -c "\"username\": \"${email}\"" || true)

  if [[ "${EXISTS}" -eq 0 ]]; then
    curl -sk -X POST "https://127.0.0.1/api/v1/add/mailbox" \
      -H "Host: ${MAILCOW_HOSTNAME}" \
      -H "Content-Type: application/json" \
      -H "X-API-Key: ${KEY}" \
      -d "$(python3 -c "import json,sys; print(json.dumps({'local_part':sys.argv[1],'domain':sys.argv[2],'name':sys.argv[1].title(),'quota':'3072','password':sys.argv[3],'password2':sys.argv[3],'active':'1','force_pw_update':'0'}))" "${local_part}" "${domain}" "${pass}")"
    echo "  criada"
  else
    curl -sk -X POST "https://127.0.0.1/api/v1/edit/mailbox" \
      -H "Host: ${MAILCOW_HOSTNAME}" \
      -H "Content-Type: application/json" \
      -H "X-API-Key: ${KEY}" \
      -d "$(python3 -c "import json,sys; print(json.dumps({'items':[sys.argv[1]],'attr':{'password':sys.argv[2],'password2':sys.argv[2],'force_pw_update':'0'}}))" "${email}" "${pass}")" \
      > /dev/null
    echo "  senha atualizada"
  fi
}

set_pw "contato@nivesistemas.com.br" "${PW_CONTATO_NIVE:?}"
set_pw "noreply@nivesistemas.com.br" "${PW_NOREPLY_NIVE:?}"
set_pw "contato@corelycommerce.com.br" "${PW_CONTATO_CORELY:?}"
set_pw "noreply@corelycommerce.com.br" "${PW_NOREPLY_CORELY:?}"

echo ""
echo "==> Verificação IMAP"
export PW_CONTATO_NIVE PW_NOREPLY_NIVE PW_CONTATO_CORELY PW_NOREPLY_CORELY
python3 -c "
import imaplib, os
pairs = [
  ('contato@nivesistemas.com.br', 'PW_CONTATO_NIVE'),
  ('noreply@nivesistemas.com.br', 'PW_NOREPLY_NIVE'),
  ('contato@corelycommerce.com.br', 'PW_CONTATO_CORELY'),
  ('noreply@corelycommerce.com.br', 'PW_NOREPLY_CORELY'),
]
ok = True
for email, env in pairs:
    pw = os.environ[env]
    try:
        m = imaplib.IMAP4_SSL('127.0.0.1', 993)
        m.login(email, pw)
        m.logout()
        print(f'OK: {email}')
    except Exception as e:
        ok = False
        print(f'FAIL: {email} — {e}')
exit(0 if ok else 1)
"
