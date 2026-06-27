#!/usr/bin/env bash
# Habilita SOGo para todas as caixas e reconstrói a view de autenticação.
set -euo pipefail
MAILCOW_DIR="${MAILCOW_DIR:-/opt/mailcow-dockerized}"
cd "${MAILCOW_DIR}"
DBPASS=$(grep '^DBPASS=' mailcow.conf | cut -d= -f2- | tr -d '\r"')

echo "==> sogo_access=1 em todas as caixas ativas"
docker compose exec -T mysql-mailcow mysql -u mailcow -p"${DBPASS}" mailcow <<'SQL'
UPDATE mailbox
SET attributes = JSON_SET(
  COALESCE(NULLIF(attributes, ''), '{}'),
  '$.sogo_access', '1',
  '$.eas_access', '1',
  '$.dav_access', '1'
)
WHERE active = 1;
SQL

echo "==> vars.local.inc.php — SOGo habilitado por padrão"
VARS="${MAILCOW_DIR}/data/web/inc/vars.local.inc.php"
touch "${VARS}"
grep -q 'sogo_access' "${VARS}" || cat >> "${VARS}" <<'PHP'

$MAILBOX_DEFAULT_ATTRIBUTES['sogo_access'] = true;
$MAILBOX_DEFAULT_ATTRIBUTES['eas_access'] = true;
$MAILBOX_DEFAULT_ATTRIBUTES['dav_access'] = true;
PHP

echo "==> Reiniciando SOGo (recria sogo_view)..."
docker compose restart sogo-mailcow memcached-mailcow

echo "==> Aguardando bootstrap SOGo..."
for i in 1 2 3 4 5 6 7 8 9 10; do
  if docker exec mailcowdockerized-sogo-mailcow-1 ss -tln 2>/dev/null | grep -q 20000; then
    echo "    SOGo escutando na 20000"
    break
  fi
  sleep 5
done

sleep 5
curl -sk -o /dev/null -w "SOGo/so -> %{http_code}\n" -H "Host: mail.nivesistemas.com.br" https://127.0.0.1/SOGo/so/

echo "==> Amostra sogo_access"
docker compose exec -T mysql-mailcow mysql -u mailcow -p"${DBPASS}" mailcow -N -e \
  "SELECT username, JSON_EXTRACT(attributes, '$.sogo_access') FROM mailbox WHERE active=1 LIMIT 8;"

echo "Concluído. Login: https://mail.nivesistemas.com.br/ -> Webmail"
