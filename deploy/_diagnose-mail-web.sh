#!/usr/bin/env bash
set -euo pipefail
echo "==> Data/Hora: $(date -u)"
echo "==> Hostname: $(hostname -f 2>/dev/null || hostname)"
echo ""
echo "==> Portas 80/443"
ss -tlnp | grep -E ':80 |:443 ' || echo "NENHUMA porta 80/443 escutando!"
echo ""
echo "==> Docker mailcow"
cd /opt/mailcow-dockerized 2>/dev/null || { echo "Mailcow dir missing"; exit 1; }
docker compose ps nginx-mailcow acme-mailcow php-fpm-mailcow --format 'table {{.Name}}\t{{.Status}}\t{{.Ports}}'
echo ""
echo "==> nginx-mailcow logs (ultimas 15)"
docker compose logs nginx-mailcow --tail 15 2>&1
echo ""
echo "==> acme-mailcow logs (ultimas 10)"
docker compose logs acme-mailcow --tail 10 2>&1
echo ""
echo "==> Teste local HTTPS"
curl -skI --max-time 10 -H "Host: mail.nivesistemas.com.br" https://127.0.0.1/ | head -8 || echo "curl HTTPS local FALHOU"
curl -sI --max-time 10 -H "Host: mail.nivesistemas.com.br" http://127.0.0.1/ | head -8 || echo "curl HTTP local FALHOU"
echo ""
echo "==> Certificado"
if [[ -f data/assets/ssl/cert.pem ]]; then
  openssl x509 -in data/assets/ssl/cert.pem -noout -subject -issuer -dates 2>/dev/null
else
  echo "cert.pem AUSENTE"
fi
echo ""
echo "==> MAILCOW_HOSTNAME no conf"
grep -E '^(MAILCOW_HOSTNAME|HTTPS_PORT|HTTP_PORT|SKIP_HTTP)=' mailcow.conf || true
echo ""
echo "==> UFW/firewall"
ufw status 2>/dev/null || iptables -L INPUT -n 2>/dev/null | head -5 || true
