#!/usr/bin/env bash
set -euo pipefail
SOGO_CONF="/opt/mailcow-dockerized/data/conf/sogo/sogo.conf"
echo "=== tail sogo.conf ==="
tail -15 "$SOGO_CONF"
echo "=== fix language line inside dict ==="
# Remove linha solta fora do bloco (append errado)
sed -i '/^SOGoLanguage = BrazilianPortuguese;$/d' "$SOGO_CONF"
# Substituir English ou qualquer valor existente dentro do arquivo
if grep -q 'SOGoLanguage' "$SOGO_CONF"; then
  sed -i 's/SOGoLanguage = .*/SOGoLanguage = BrazilianPortuguese;/' "$SOGO_CONF"
else
  # Inserir após abertura do dicionário
  sed -i '0,/^{/s//{\n    SOGoLanguage = BrazilianPortuguese;/' "$SOGO_CONF" 2>/dev/null || \
    sed -i '1a\    SOGoLanguage = BrazilianPortuguese;' "$SOGO_CONF"
fi
echo "=== after fix ==="
grep -n SOGoLanguage "$SOGO_CONF" || true
tail -5 "$SOGO_CONF"
cd /opt/mailcow-dockerized
docker compose restart sogo-mailcow memcached-mailcow
sleep 25
curl -sk -o /dev/null -w "SOGo/so -> %{http_code}\n" -H "Host: mail.nivesistemas.com.br" https://127.0.0.1/SOGo/so/
docker logs mailcowdockerized-sogo-mailcow-1 2>&1 | tail -5
