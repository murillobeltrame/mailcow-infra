#!/usr/bin/env bash
# Rode no VPS (NÃO use pipe — heredoc quebra com curl | bash):
#   curl -fsSL -o /tmp/fix-mail.sh URL && bash /tmp/fix-mail.sh
set -euo pipefail

die() { echo "ERRO: $*" >&2; exit 1; }

MAILCOW_DIR="${MAILCOW_DIR:-/opt/mailcow-dockerized}"
[[ -d "${MAILCOW_DIR}" ]] || die "Mailcow não encontrado em ${MAILCOW_DIR}"
cd "${MAILCOW_DIR}"

read_conf() {
  local key="$1"
  grep "^${key}=" mailcow.conf | cut -d= -f2- | tr -d '\r"' || true
}

MAILCOW_HOSTNAME=$(read_conf MAILCOW_HOSTNAME)
MAILCOW_PASS=$(read_conf MAILCOW_PASS)
DBPASS=$(read_conf DBPASS)
KEY=$(read_conf API_KEY)

[[ -n "${MAILCOW_HOSTNAME}" ]] || die "MAILCOW_HOSTNAME ausente em mailcow.conf"
[[ -n "${DBPASS}" ]] || die "DBPASS ausente em mailcow.conf"
[[ -n "${KEY}" ]] || die "API_KEY ausente em mailcow.conf"

echo "==> Hostname: ${MAILCOW_HOSTNAME}"

if ! grep -q '^API_ALLOW_FROM=' mailcow.conf; then
  echo 'API_ALLOW_FROM=127.0.0.1,172.22.1.1,172.23.1.1' >> mailcow.conf
fi

docker compose ps mysql-mailcow --format '{{.Status}}' | grep -qi up || die "mysql-mailcow não está rodando"

echo "==> Sync API key"
docker compose exec -T mysql-mailcow mysql -umailcow -p"${DBPASS}" mailcow \
  -e "DELETE FROM api; INSERT INTO api (api_key, active, allow_from, access) VALUES ('${KEY}', 1, '127.0.0.1,172.22.1.1,172.23.1.1', 'rw');"

echo "==> Teste API"
API_OUT=$(curl -sk "https://127.0.0.1/api/v1/get/status/version" \
  -H "Host: ${MAILCOW_HOSTNAME}" \
  -H "X-API-Key: ${KEY}")
echo "${API_OUT}"
echo "${API_OUT}" | grep -q '"version"' || die "API Mailcow falhou"

echo ""
echo "==> Caixas"
docker compose exec -T mysql-mailcow mysql -umailcow -p"${DBPASS}" mailcow \
  -e "SELECT username, active FROM mailbox ORDER BY username;"

if [[ -n "${MAILCOW_PASS}" ]]; then
  echo ""
  echo "==> Reset senhas"
  MB_JSON=$(curl -sk "https://127.0.0.1/api/v1/get/mailbox/all" \
    -H "Host: ${MAILCOW_HOSTNAME}" \
    -H "X-API-Key: ${KEY}")
  while IFS= read -r mb; do
    [[ -z "${mb}" ]] && continue
    echo "  ${mb}"
    PAYLOAD=$(python3 -c "import json,sys; print(json.dumps({'items':[sys.argv[1]],'attr':{'password':sys.argv[2],'password2':sys.argv[2],'force_pw_update':'0'}}))" "${mb}" "${MAILCOW_PASS}")
    curl -sk -X POST "https://127.0.0.1/api/v1/edit/mailbox" \
      -H "Host: ${MAILCOW_HOSTNAME}" \
      -H "Content-Type: application/json" \
      -H "X-API-Key: ${KEY}" \
      -d "${PAYLOAD}" > /dev/null
  done < <(echo "${MB_JSON}" | grep -o '"username": "[^"]*"' | cut -d'"' -f4)
else
  echo "AVISO: MAILCOW_PASS ausente — senhas não alteradas."
fi

echo ""
echo "==> DKIM"
for d in nivesistemas.com.br corelycommerce.com.br; do
  docker compose exec -T rspamd-mailcow rspamadm dkim_keygen -d "${d}" -s dkim 2>/dev/null || true
  echo "--- ${d} ---"
  docker compose exec -T rspamd-mailcow cat "/var/lib/rspamd/dkim/${d}.txt" 2>/dev/null | head -3 || true
done
docker compose restart rspamd-mailcow postfix-mailcow

echo "==> Aguardando Postfix..."
for i in $(seq 1 30); do
  if docker compose exec -T postfix-mailcow postfix status >/dev/null 2>&1; then
    echo "  Postfix pronto (${i}s)"
    break
  fi
  sleep 1
done
sleep 2

echo ""
echo "==> Teste IMAP/SMTP"
if [[ -n "${MAILCOW_PASS}" ]]; then
  export MAILCOW_PASS
  python3 -c "
import imaplib, smtplib, ssl, os, sys, time
pw = os.environ['MAILCOW_PASS']
accounts = ['contato@nivesistemas.com.br','contato@corelycommerce.com.br','noreply@nivesistemas.com.br','noreply@corelycommerce.com.br']
ok = True
for user in accounts:
    try:
        m = imaplib.IMAP4_SSL('127.0.0.1', 993)
        m.login(user, pw)
        m.logout()
        print(f'IMAP OK: {user}')
    except Exception as e:
        ok = False
        print(f'IMAP FAIL: {user} — {e}')
user = accounts[0]
for port, mode in [(465, 'ssl'), (587, 'starttls')]:
    for attempt in range(3):
        try:
            if mode == 'ssl':
                s = smtplib.SMTP_SSL('127.0.0.1', port, timeout=15)
            else:
                s = smtplib.SMTP('127.0.0.1', port, timeout=15)
                s.ehlo()
                s.starttls(context=ssl.create_default_context())
                s.ehlo()
            s.login(user, pw)
            s.quit()
            print(f'SMTP OK: {user} ({port})')
            break
        except Exception as e:
            if attempt == 2:
                ok = False
                print(f'SMTP FAIL {port}: {e}')
            else:
                time.sleep(2)
sys.exit(0 if ok else 1)
"
fi

echo ""
echo "==> PTR atual:"
dig +short -x 2.25.181.76 @8.8.8.8 2>/dev/null || true
echo ""
echo "PTR manual no hPanel: 2.25.181.76 -> mail.nivesistemas.com.br"
echo "Fix concluído."
