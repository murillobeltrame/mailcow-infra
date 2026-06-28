#!/usr/bin/env bash
# Corrige certificado SMTP/IMAP: inclui mail.* e smtp.* nos SANs e força renovação ACME.
set -euo pipefail

MAILCOW_DIR="${MAILCOW_DIR:-/opt/mailcow-dockerized}"
MAILCOW_HOSTNAME="${MAILCOW_HOSTNAME:-mail.nivesistemas.com.br}"
SMTP_HOST="${CLIENT_MAIL_HOST:-${SMTP_HOST:-}}"

if [[ -z "${SMTP_HOST}" && "${MAILCOW_HOSTNAME}" == mail.* ]]; then
  SMTP_HOST="smtp.${MAILCOW_HOSTNAME#mail.}"
fi
SMTP_HOST="${SMTP_HOST:-smtp.nivesistemas.com.br}"

cd "${MAILCOW_DIR}"

set_conf() {
  local key="$1"
  local val="$2"
  if grep -q "^${key}=" mailcow.conf; then
    sed -i "s|^${key}=.*|${key}=${val}|" mailcow.conf
  else
    echo "${key}=${val}" >> mailcow.conf
  fi
}

echo "==> Mailcow cert fix"
echo "    MAILCOW_HOSTNAME=${MAILCOW_HOSTNAME}"
echo "    CLIENT_MAIL_HOST=${SMTP_HOST}"

set_conf MAILCOW_HOSTNAME "${MAILCOW_HOSTNAME}"
set_conf SKIP_HTTP_VERIFICATION y

SAN="${SMTP_HOST}"
if [[ "${SMTP_HOST}" != "${MAILCOW_HOSTNAME}" ]]; then
  SAN="${MAILCOW_HOSTNAME},${SMTP_HOST}"
fi
set_conf ADDITIONAL_SAN "${SAN}"
echo "    ADDITIONAL_SAN=${SAN}"

echo ""
echo "==> Certificado atual"
if [[ -f data/assets/ssl/cert.pem ]]; then
  openssl x509 -in data/assets/ssl/cert.pem -noout -subject -dates 2>/dev/null || true
  openssl x509 -in data/assets/ssl/cert.pem -noout -ext subjectAltName 2>/dev/null || true
else
  echo "    cert.pem ausente"
fi

echo ""
echo "==> Forçando renovação Let's Encrypt"
if [[ -f data/assets/ssl/cert.pem ]]; then
  cp -a data/assets/ssl/cert.pem "data/assets/ssl/cert.pem.bak.$(date +%s)"
fi
rm -f data/assets/ssl/cert.pem data/assets/ssl/key.pem

docker compose restart acme-mailcow unbound-mailcow
echo "    Aguardando ACME (90s)..."
sleep 90
docker compose logs acme-mailcow --tail 30

echo ""
echo "==> Certificado renovado"
if [[ -f data/assets/ssl/cert.pem ]]; then
  openssl x509 -in data/assets/ssl/cert.pem -noout -subject -dates 2>/dev/null || true
  openssl x509 -in data/assets/ssl/cert.pem -noout -ext subjectAltName 2>/dev/null || true
else
  echo "    ERRO: cert.pem ainda ausente — confira logs: docker compose logs acme-mailcow"
  echo "    Causa comum: mail.* proxied no Cloudflare. Rode antes: node deploy.mjs fix-mail-cert"
  exit 1
fi

echo ""
echo "==> Teste TLS (SMTP 587, SNI ${MAILCOW_HOSTNAME})"
if echo | openssl s_client -connect 127.0.0.1:587 -starttls smtp -servername "${MAILCOW_HOSTNAME}" 2>/dev/null \
  | openssl x509 -noout -ext subjectAltName 2>/dev/null; then
  echo "    OK"
else
  echo "    AVISO: teste local falhou — verifique postfix/dovecot"
fi

docker compose restart postfix-mailcow dovecot-mailcow nginx-mailcow
echo ""
echo "Concluído. Clientes externos: SMTP/IMAP em ${MAILCOW_HOSTNAME}"
