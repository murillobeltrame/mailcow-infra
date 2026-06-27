#!/usr/bin/env bash
# Fix completo de e-mail no VPS — roda direto via SSH (sem GitHub Actions).
set -euo pipefail

MAILCOW_DIR="${MAILCOW_DIR:-/opt/mailcow-dockerized}"
cd "${MAILCOW_DIR}"

echo "==> Status Mailcow"
docker compose ps --format 'table {{.Name}}\t{{.Status}}' | head -20

echo ""
echo "==> Domínios"
DBPASS=$(grep '^DBPASS=' mailcow.conf | cut -d= -f2- | tr -d '\r')
docker compose exec -T mysql-mailcow mysql -u mailcow -p"${DBPASS}" mailcow \
  -e "SELECT domain, active FROM domain;" 2>/dev/null

echo ""
echo "==> Caixas"
docker compose exec -T mysql-mailcow mysql -u mailcow -p"${DBPASS}" mailcow \
  -e "SELECT username, active FROM mailbox ORDER BY username;" 2>/dev/null

echo ""
echo "==> Sync API key"
KEY=$(grep '^API_KEY=' mailcow.conf | cut -d= -f2- | tr -d '\r')
grep -q '^API_ALLOW_FROM=' mailcow.conf || echo 'API_ALLOW_FROM=127.0.0.1,172.22.1.1,172.23.1.1' >> mailcow.conf
docker compose exec -T mysql-mailcow mysql -u mailcow -p"${DBPASS}" mailcow -e "
DELETE FROM api;
INSERT INTO api (api_key, active, allow_from, access) VALUES ('${KEY}', 1, '127.0.0.1,172.22.1.1,172.23.1.1', 'rw');
" 2>/dev/null
curl -sk "https://127.0.0.1/api/v1/get/status/version" \
  -H "Host: ${MAILCOW_HOSTNAME}" \
  -H "X-API-Key: ${KEY}"
echo ""

echo ""
echo "==> Reset senhas (MAILCOW_PASS)"
for mb in $(curl -sk "https://127.0.0.1/api/v1/get/mailbox/all" \
  -H "Host: ${MAILCOW_HOSTNAME}" \
  -H "X-API-Key: ${KEY}" | grep -o '"username": "[^"]*"' | cut -d'"' -f4); do
  echo "  ${mb}"
  curl -sk -X POST "https://127.0.0.1/api/v1/edit/mailbox" \
    -H "Host: ${MAILCOW_HOSTNAME}" \
    -H "Content-Type: application/json" \
    -H "X-API-Key: ${KEY}" \
    -d "{\"items\":[\"${mb}\"],\"attr\":{\"password\":\"${MAILCOW_PASS}\",\"password2\":\"${MAILCOW_PASS}\",\"force_pw_update\":\"0\"}}" \
    > /dev/null
done

echo ""
echo "==> Teste IMAP/SMTP"
export MAILCOW_PASS
python3 - <<'PY'
import imaplib, smtplib, os, sys
pw = os.environ["MAILCOW_PASS"]
accounts = [
    "contato@nivesistemas.com.br",
    "contato@corelycommerce.com.br",
    "noreply@nivesistemas.com.br",
    "noreply@corelycommerce.com.br",
]
ok = True
for user in accounts:
    try:
        m = imaplib.IMAP4_SSL("127.0.0.1", 993)
        m.login(user, pw)
        m.logout()
        print(f"IMAP OK: {user}")
    except Exception as e:
        ok = False
        print(f"IMAP FAIL: {user} — {e}")
try:
    s = smtplib.SMTP_SSL("127.0.0.1", 465, timeout=15)
    s.login(accounts[0], pw)
    s.quit()
    print(f"SMTP OK: {accounts[0]} (465)")
except Exception as e:
    ok = False
    print(f"SMTP FAIL: {e}")
sys.exit(0 if ok else 1)
PY

echo ""
echo "==> Portas mail"
ss -tlnp | grep -E ':25|:465|:587|:993' || true

echo ""
echo "==> PTR atual"
dig +short -x "$(curl -4 -s ifconfig.me 2>/dev/null || echo 2.25.181.76)" @8.8.8.8 || true

echo ""
echo "Fix concluído."
