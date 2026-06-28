#!/usr/bin/env bash
# Rotas Mailcow: webmail em /mail/, painel preservado (/user, /admin, SOGo calendário).
set -euo pipefail
MAILCOW_DIR="${MAILCOW_DIR:-/opt/mailcow-dockerized}"
cd "${MAILCOW_DIR}"

echo "==> Restaurando pós-login do painel (/user, /admin, /domainadmin)..."

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

# index.php — usuário autenticado vai ao painel, não ao webmail
index = root / "index.php"
if index.exists():
    t = index.read_text()
    t_new = t.replace(
        'header("Location: /mail/");',
        'header("Location: /user");',
    )
    # Garante bloco user (upstream usa SOGo/so/ — painel primeiro)
    t_new = re.sub(
        r'header\("Location: /SOGo/so/"\);',
        'header("Location: /user");',
        t_new,
    )
    if t_new != t:
        index.write_text(t_new)
        print("    data/web/index.php")

# triggers.user.inc.php — após login de mailbox → /user
patch_file(
    root / "inc/triggers.user.inc.php",
    [
        ('header("Location: /mail/");', 'header("Location: /user");'),
        ('header("Location: /SOGo/so/");', 'header("Location: /user");'),
    ],
)

# triggers.global.inc.php — se existir redirect para mail
patch_file(
    root / "inc/triggers.global.inc.php",
    [
        ('header("Location: /mail/");', 'header("Location: /user");'),
    ],
)

# sogo-auth.php — SSO para calendário/contactos (não webmail)
sogo_auth = root / "sogo-auth.php"
if sogo_auth.exists():
    t = sogo_auth.read_text()
    t_new = t.replace('header("Location: /mail/");', 'header("Location: /SOGo/so/");')
    if 'header("Location: /SOGo/so/");' not in t_new and 'header("Location: /mail/");' in t:
        pass
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

echo "==> Nginx: módulo Mail do SOGo → /mail/ (webmail moderno)..."
mkdir -p data/conf/nginx
cat > data/conf/nginx/site.nive-mail-redirects.custom <<'NGINX'
# SOGo Mail legado → webmail React; calendário/contactos permanecem em /SOGo/
location ~ ^/SOGo/so/[^/]+/Mail(/|$) {
    return 302 /mail/;
}
NGINX

echo "==> Limpando cache Twig..."
rm -rf data/web/templates/cache/* 2>/dev/null || true

docker compose restart php-fpm-mailcow nginx-mailcow 2>/dev/null || \
  docker-compose restart php-fpm-mailcow nginx-mailcow 2>/dev/null || true

echo ""
echo "Rotas configuradas:"
echo "  Webmail (ler/enviar):  https://mail.nivesistemas.com.br/mail/"
echo "  Painel usuário:        https://mail.nivesistemas.com.br/user"
echo "  Admin (RAM, caixas):   https://mail.nivesistemas.com.br/admin"
echo "  Login Mailcow:         https://mail.nivesistemas.com.br/"
