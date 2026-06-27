#!/usr/bin/env bash
# Redireciona botão Webmail do painel Mailcow para o webmail moderno (/mail/).
set -euo pipefail
MAILCOW_DIR="${MAILCOW_DIR:-/opt/mailcow-dockerized}"
cd "${MAILCOW_DIR}"

echo "==> Atualizando links Webmail para /mail/ ..."

TWIG="data/web/templates/user/tab-user-auth.twig"
if [[ -f "${TWIG}" ]]; then
  sed -i 's|href="/sogo-auth.php?login={{ mailcow_cc_username }}"|href="/mail/"|g' "${TWIG}"
  sed -i 's|href="/SOGo/so/"|href="/mail/"|g' "${TWIG}"
  sed -i 's|href="/SOGo/so"|href="/mail/"|g' "${TWIG}"
  grep -n 'mail/\|SOGo\|sogo-auth' "${TWIG}" || true
fi

# Redirect pós-login usuário
python3 - <<'PY'
import os
root = "data/web"
old_patterns = [
    'header("Location: /sogo-auth.php?login=" . urlencode($_SESSION["mailcow_cc_username"]));',
    'header("Location: /SOGo/so/");',
]
new = 'header("Location: /mail/");'
for dirpath, _, files in os.walk(root):
    if "/templates/cache" in dirpath:
        continue
    for fn in files:
        if not fn.endswith((".php", ".inc.php")):
            continue
        path = os.path.join(dirpath, fn)
        if fn == "sogo-auth.php":
            continue
        with open(path) as f:
            content = f.read()
        changed = False
        for old in old_patterns:
            if old in content:
                content = content.replace(old, new)
                changed = True
        if changed:
            with open(path, "w") as f:
                f.write(content)
            print(f"    {path}")
PY

echo "==> Limpando cache Twig..."
rm -rf data/web/templates/cache/* 2>/dev/null || true

docker compose restart php-fpm-mailcow nginx-mailcow 2>/dev/null || \
  docker-compose restart php-fpm-mailcow nginx-mailcow 2>/dev/null || true

echo "Concluído. Login de usuário agora abre https://mail.nivesistemas.com.br/mail/"
