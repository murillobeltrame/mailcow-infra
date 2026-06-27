#!/usr/bin/env bash
set -euo pipefail
cd /opt/mailcow-dockerized
DBPASS=$(grep '^DBPASS=' mailcow.conf | cut -d= -f2- | tr -d '\r"')

echo "=== Populando _sogo_static_view (SQL) ==="
docker compose exec -T mysql-mailcow mysql -u mailcow -p"${DBPASS}" mailcow <<'SQL'
INSERT INTO _sogo_static_view
  (`c_uid`, `domain`, `c_name`, `c_password`, `c_cn`, `mail`, `aliases`, `ad_aliases`, `ext_acl`, `kind`, `multiple_bookings`)
SELECT
  m.username,
  m.domain,
  m.username,
  '{SSHA256}K7tPeTzJc2R2LQ6+Jz8xVn3mP4wR9sT1uY0oI5hG7jF8k=',
  m.name,
  m.username,
  IFNULL(GROUP_CONCAT(ga.aliases ORDER BY ga.aliases SEPARATOR ' '), ''),
  IFNULL(gda.ad_alias, ''),
  IFNULL(external_acl.send_as_acl, ''),
  m.kind,
  m.multiple_bookings
FROM mailbox m
LEFT OUTER JOIN grouped_mail_aliases ga ON ga.username REGEXP CONCAT('(^|,)', m.username, '($|,)')
LEFT OUTER JOIN grouped_domain_alias_address gda ON gda.username = m.username
LEFT OUTER JOIN grouped_sender_acl_external external_acl ON external_acl.username = m.username
WHERE m.active = '1'
GROUP BY m.username
ON DUPLICATE KEY UPDATE
  `domain` = VALUES(`domain`),
  `c_name` = VALUES(`c_name`),
  `c_password` = VALUES(`c_password`),
  `c_cn` = VALUES(`c_cn`),
  `mail` = VALUES(`mail`),
  `aliases` = VALUES(`aliases`),
  `ad_aliases` = VALUES(`ad_aliases`),
  `ext_acl` = VALUES(`ext_acl`),
  `kind` = VALUES(`kind`),
  `multiple_bookings` = VALUES(`multiple_bookings`);
SQL

echo "=== Usuarios SOGo ==="
docker compose exec -T mysql-mailcow mysql -u mailcow -p"${DBPASS}" mailcow -e \
  "SELECT c_uid FROM _sogo_static_view ORDER BY c_uid;"

docker compose restart sogo-mailcow memcached-mailcow
sleep 10
echo "SOGo: $(docker compose exec -T mysql-mailcow mysql -u mailcow -p"${DBPASS}" mailcow -N -e 'SELECT COUNT(*) FROM _sogo_static_view;' 2>/dev/null) usuarios sincronizados."
