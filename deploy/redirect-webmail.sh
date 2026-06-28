#!/usr/bin/env bash
# Redireciona fluxos de e-mail para o webmail moderno (/mail/) em vez do SOGo Mail.
set -euo pipefail
MAILCOW_DIR="${MAILCOW_DIR:-/opt/mailcow-dockerized}"
cd "${MAILCOW_DIR}"

MAIL_DEST='header("Location: /mail/");'

echo "==> Atualizando links Webmail para /mail/ ..."

TWIG="data/web/templates/user/tab-user-auth.twig"
if [[ -f "${TWIG}" ]]; then
  sed -i 's|href="/sogo-auth.php?login={{ mailcow_cc_username }}"|href="/mail/"|g' "${TWIG}"
  sed -i 's|href="/sogo-auth.php?login={{ mailcow_cc_username  }}"|href="/mail/"|g' "${TWIG}"
  sed -i 's|href="/SOGo/so/"|href="/mail/"|g' "${TWIG}"
  sed -i 's|href="/SOGo/so"|href="/mail/"|g' "${TWIG}"
  grep -n 'href="/mail/\|sogo-auth\|SOGo/so' "${TWIG}" | head -10 || true
fi

python3 - <<'PY'
import os

root = "data/web"
replacements = [
    ('header("Location: /sogo-auth.php?login=" . urlencode($_SESSION["mailcow_cc_username"]));', 'header("Location: /mail/");'),
    ('header("Location: /SOGo/so/");', 'header("Location: /mail/");'),
]

for dirpath, _, files in os.walk(root):
    if "/templates/cache" in dirpath:
        continue
    for fn in files:
        if not fn.endswith((".php", ".inc.php")):
            continue
        path = os.path.join(dirpath, fn)
        with open(path) as f:
            content = f.read()
        original = content
        for old, new in replacements:
            content = content.replace(old, new)
        if content != original:
            with open(path, "w") as f:
                f.write(content)
            print(f"    {path}")
PY

echo "==> Nginx: redirect SOGo Mail -> /mail/ ..."
NGINX_MAIL="${MAILCOW_DIR}/data/conf/nginx/site.nive-mail-redirects.custom"
cat > "${NGINX_MAIL}" <<'NGINX'
# Redireciona módulo Mail do SOGo para webmail moderno (hash #!/Mail/ é tratado no JS)
location ~ ^/SOGo/so/[^/]+/Mail(/|$) {
    return 302 /mail/;
}
NGINX

echo "==> Limpando cache Twig..."
rm -rf data/web/templates/cache/* 2>/dev/null || true

docker compose restart php-fpm-mailcow nginx-mailcow 2>/dev/null || \
  docker-compose restart php-fpm-mailcow nginx-mailcow 2>/dev/null || true

echo "Concluído. Login e e-mail abrem https://mail.nivesistemas.com.br/mail/"
