#!/usr/bin/env bash
# Cadastra domínios de e-mail no Mailcow e garante postmaster@ em cada um.
set -euo pipefail

MAILCOW_DIR="${MAILCOW_DIR:-/opt/mailcow-dockerized}"
MAILCOW_HOSTNAME="${MAILCOW_HOSTNAME:?}"
MAILCOW_PASS="${MAILCOW_PASS:?}"
MAIL_DOMAIN="${MAIL_DOMAIN:?nivesistemas.com.br}"
EXTRA_MAIL_DOMAIN="${EXTRA_MAIL_DOMAIN:-corelycommerce.com.br}"

cd "${MAILCOW_DIR}"

MAILCOW_API_KEY="$(grep '^API_KEY=' mailcow.conf | cut -d= -f2- | tr -d '\r')"

api() {
  local method="$1"
  local path="$2"
  local data="${3:-{}}"
  curl -sk -X "${method}" "https://127.0.0.1/api/v1/${path}" \
    -H "Host: ${MAILCOW_HOSTNAME}" \
    -H "Content-Type: application/json" \
    -H "X-API-Key: ${MAILCOW_API_KEY}" \
    -d "${data}"
}

add_domain() {
  local domain="$1"
  local desc="$2"
  echo "==> Domínio: ${domain}"
  api POST add/domain "{\"domain\":\"${domain}\",\"description\":\"${desc}\",\"active\":\"1\",\"aliases\":\"400\",\"mailboxes\":\"50\",\"defquota\":\"3072\",\"maxquota\":\"10240\",\"quota\":\"102400\",\"relayhost\":\"\",\"backupmx\":\"0\",\"gal\":\"1\"}"
  echo ""
}

add_postmaster() {
  local domain="$1"
  echo "==> postmaster@${domain}"
  api POST add/mailbox "{\"local_part\":\"postmaster\",\"domain\":\"${domain}\",\"name\":\"Postmaster\",\"quota\":\"1024\",\"password\":\"${MAILCOW_PASS}\",\"password2\":\"${MAILCOW_PASS}\",\"active\":\"1\",\"force_pw_update\":\"0\"}"
  echo ""
}

echo "==> Domínios atuais:"
api GET get/domain/all | head -c 2000
echo ""

for d in "${MAIL_DOMAIN}" "${EXTRA_MAIL_DOMAIN}"; do
  [[ -z "${d}" ]] && continue
  add_domain "${d}" "Nive Mail - ${d}"
  add_postmaster "${d}" || true
done

echo "==> Gerando DKIM..."
for d in "${MAIL_DOMAIN}" "${EXTRA_MAIL_DOMAIN}"; do
  [[ -z "${d}" ]] && continue
  docker compose exec -T rspamd-mailcow rspamadm dkim_keygen -d "${d}" -s dkim 2>/dev/null || true
done

docker compose restart rspamd-mailcow postfix-mailcow
sleep 5

echo "==> DKIM ${MAIL_DOMAIN}:"
docker compose exec -T rspamd-mailcow cat "/var/lib/rspamd/dkim/${MAIL_DOMAIN}.txt" 2>/dev/null | head -3 || true
echo "==> DKIM ${EXTRA_MAIL_DOMAIN}:"
docker compose exec -T rspamd-mailcow cat "/var/lib/rspamd/dkim/${EXTRA_MAIL_DOMAIN}.txt" 2>/dev/null | head -3 || true

echo "==> Concluído."
