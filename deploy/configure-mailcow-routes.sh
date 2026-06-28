#!/usr/bin/env bash
# Rotas Mailcow: portal Nive Mail em /mail/ com cutover dos painéis PHP legados.
set -euo pipefail
MAILCOW_DIR="${MAILCOW_DIR:-/opt/mailcow-dockerized}"
cd "${MAILCOW_DIR}"

echo "==> Cutover portal: /user, /admin, /domainadmin → /mail/ ..."

python3 - <<'PY'
import re
from pathlib import Path

root = Path("data/web")

def patch_file(path: Path, replacements: list[tuple[str, str]]) -> bool:
    if not path.exists():
        return False
    text = path.read_text()
    orig = text
    for old, new in replacements:
        text = text.replace(old, new)
    if text != orig:
        path.write_text(text)
        print(f"    {path}")
        return True
    return False

# index.php — após login mailbox → webmail portal (minha conta integrada)
index = root / "index.php"
if index.exists():
    t = index.read_text()
    for old, new in [
        ('header("Location: /user");', 'header("Location: /mail/");'),
        ('header("Location: /SOGo/so/");', 'header("Location: /mail/");'),
    ]:
        t = t.replace(old, new)
    if t != index.read_text():
        index.write_text(t)
        print("    data/web/index.php")

patch_file(
    root / "inc/triggers.user.inc.php",
    [
        ('header("Location: /user");', 'header("Location: /mail/");'),
        ('header("Location: /SOGo/so/");', 'header("Location: /mail/");'),
    ],
)

# Admin / domainadmin triggers → portal
patch_file(
    root / "inc/triggers.admin.inc.php",
    [
        ('header("Location: /admin");', 'header("Location: /mail/admin");'),
    ],
)
patch_file(
    root / "inc/triggers.domainadmin.inc.php",
    [
        ('header("Location: /domainadmin");', 'header("Location: /mail/domain");'),
    ],
)

# sogo-auth.php — calendário/contactos permanecem em SOGo
sogo_auth = root / "sogo-auth.php"
if sogo_auth.exists():
    t = sogo_auth.read_text()
    t_new = t.replace('header("Location: /mail/");', 'header("Location: /SOGo/so/");')
    if t_new != t:
        sogo_auth.write_text(t_new)
        print("    data/web/sogo-auth.php")

PY

echo "==> Botão Webmail no painel do usuário → /mail/ ..."
TWIG="data/web/templates/user/tab-user-auth.twig"
if [[ -f "${TWIG}" ]]; then
  sed -i 's|href="/sogo-auth.php?login={{ mailcow_cc_username }}"|href="/mail/"|g' "${TWIG}"
  sed -i 's|href="/sogo-auth.php?login={{ mailcow_cc_username  }}"|href="/mail/"|g' "${TWIG}"
  sed -i 's|href="/SOGo/so/"|href="/mail/"|g' "${TWIG}"
  sed -i 's|href="/SOGo/so"|href="/mail/"|g' "${TWIG}"
fi

echo "==> Nginx: redirects painéis legados + SOGo Mail → portal ..."
mkdir -p data/conf/nginx
cat > data/conf/nginx/site.nive-mail-redirects.custom <<'NGINX'
# Portal Nive Mail — cutover painéis PHP e SOGo Mail
location = /user {
    return 302 /mail/account;
}
location ^~ /user/ {
    return 302 /mail/account;
}
location = /admin {
    return 302 /mail/admin;
}
location ^~ /admin/ {
    return 302 /mail/admin;
}
location = /domainadmin {
    return 302 /mail/domain;
}
location ^~ /domainadmin/ {
    return 302 /mail/domain;
}
# SOGo Mail legado → webmail React; calendário/contactos permanecem em /SOGo/
location ~ ^/SOGo/so/[^/]+/Mail(/|$) {
    return 302 /mail/;
}
# Calendário SOGo → portal quando estável
location ~ ^/SOGo/so/[^/]+/Calendar(/|$) {
    return 302 /mail/calendar;
}
location ~ ^/SOGo/so/[^/]+/Contacts(/|$) {
    return 302 /mail/contacts;
}
NGINX

echo "==> Limpando cache Twig..."
rm -rf data/web/templates/cache/* 2>/dev/null || true

echo "==> Recarregando nginx (rotas portal)..."
if docker compose exec nginx-mailcow nginx -t 2>/dev/null; then
  docker compose exec nginx-mailcow nginx -s reload 2>/dev/null || \
    docker compose restart nginx-mailcow 2>/dev/null || true
else
  docker compose restart nginx-mailcow 2>/dev/null || \
    docker-compose restart nginx-mailcow 2>/dev/null || true
fi

echo ""
echo "Rotas configuradas (portal unificado):"
echo "  Webmail:               https://mail.nivesistemas.com.br/mail/"
echo "  Minha conta:           https://mail.nivesistemas.com.br/mail/account"
echo "  Admin global:          https://mail.nivesistemas.com.br/mail/admin"
echo "  Admin de domínio:      https://mail.nivesistemas.com.br/mail/domain"
echo "  Calendário/contactos:  https://mail.nivesistemas.com.br/mail/calendar | /contacts"
echo "  Login Mailcow (FIDO2): https://mail.nivesistemas.com.br/"
