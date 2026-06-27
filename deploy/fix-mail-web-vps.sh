#!/usr/bin/env bash
# Corrige painel https://mail.nivesistemas.com.br (nginx + SSL + firewall + tunnel)
# VPS: curl -fsSL -o /tmp/fix-web.sh URL && bash /tmp/fix-web.sh
set -euo pipefail

MAILCOW_DIR="${MAILCOW_DIR:-/opt/mailcow-dockerized}"
MAIL_HOST="${MAILCOW_HOSTNAME:-mail.nivesistemas.com.br}"
TUNNEL_CFG="/etc/cloudflared/config.yml"

echo "==> 1. Mailcow nginx + SSL"
cd "${MAILCOW_DIR}"

grep -q '^SKIP_HTTP_VERIFICATION=' mailcow.conf \
  && sed -i 's/^SKIP_HTTP_VERIFICATION=.*/SKIP_HTTP_VERIFICATION=y/' mailcow.conf \
  || echo 'SKIP_HTTP_VERIFICATION=y' >> mailcow.conf

docker compose up -d nginx-mailcow php-fpm-mailcow acme-mailcow mysql-mailcow redis-mailcow
docker compose restart acme-mailcow
echo "   Aguardando ACME (45s)..."
sleep 45
docker compose restart nginx-mailcow
sleep 5

echo ""
echo "==> 2. Portas locais"
ss -tlnp | grep -E ':80 |:443 ' || echo "   AVISO: 80/443 não escutando!"

echo ""
echo "==> 3. Teste local"
curl -skI -H "Host: ${MAIL_HOST}" "https://127.0.0.1/" | head -5 || echo "   HTTPS local FALHOU"
curl -sI -H "Host: ${MAIL_HOST}" "http://127.0.0.1/" | head -3 || true

echo ""
echo "==> 4. Firewall UFW (se ativo)"
if command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then
  ufw allow 80/tcp
  ufw allow 443/tcp
  ufw allow 25/tcp
  ufw allow 465/tcp
  ufw allow 587/tcp
  ufw allow 993/tcp
  echo "   Regras UFW aplicadas"
else
  echo "   UFW inativo — abra 80/443 no hPanel Hostinger (Firewall do VPS)"
fi

echo ""
echo "==> 5. Cloudflare Tunnel (acesso web sem depender da porta 443 externa)"
if [[ -f "${TUNNEL_CFG}" ]]; then
  if ! grep -q "hostname: ${MAIL_HOST}" "${TUNNEL_CFG}"; then
    cp -a "${TUNNEL_CFG}" "${TUNNEL_CFG}.bak.$(date +%s)"
    python3 <<PY
from pathlib import Path
host = "${MAIL_HOST}"
path = Path("${TUNNEL_CFG}")
text = path.read_text()
block = f"""  - hostname: {host}
    service: https://127.0.0.1:443
    originRequest:
      noTLSVerify: true
      httpHostHeader: {host}
"""
if "ingress:" in text:
    text = text.replace("ingress:\n", "ingress:\n" + block, 1)
    path.write_text(text)
    print("   Rota tunnel adicionada:", host)
else:
    print("   AVISO: ingress: não encontrado em", path)
PY
    systemctl restart cloudflared
    sleep 3
    systemctl is-active cloudflared && echo "   cloudflared OK" || echo "   cloudflared FALHOU"
  else
    echo "   Rota ${MAIL_HOST} já existe no tunnel"
    systemctl restart cloudflared 2>/dev/null || true
  fi
else
  echo "   ${TUNNEL_CFG} não encontrado — pule tunnel ou instale cloudflared"
fi

echo ""
echo "==> 6. Certificado"
openssl x509 -in data/assets/ssl/cert.pem -noout -subject -issuer -dates 2>/dev/null || echo "   cert.pem ausente"

echo ""
echo "==> Concluído"
echo "   Teste direto:  https://${MAIL_HOST}/admin"
echo "   Se ainda falhar, use tunnel (DNS CNAME no Cloudflare Zero Trust):"
echo "   ${MAIL_HOST} -> tunnel sistemaloja (64a19cf4-2525-4244-9f25-39890c84b47e)"
echo ""
echo "   Hostinger hPanel: VPS -> Security -> Firewall -> permitir TCP 80 e 443"
