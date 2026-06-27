#!/usr/bin/env bash
# Corrige Unauthorized no SOGo: todo redirect para webmail deve passar por /sogo-auth.php?login=
# (upstream mailcow PR #7085 — sessão sogo-sso-user-allowed não era criada no redirect direto).
set -euo pipefail
MAILCOW_DIR="${MAILCOW_DIR:-/opt/mailcow-dockerized}"
cd "${MAILCOW_DIR}"

OLD='header("Location: /SOGo/so/");'
NEW='header("Location: /sogo-auth.php?login=" . urlencode($_SESSION["mailcow_cc_username"]));'

echo "==> Patch redirects PHP (${OLD})"
python3 - "${OLD}" "${NEW}" <<'PY'
import sys, os
old, new = sys.argv[1], sys.argv[2]
root = "data/web"
changed = []
for dirpath, _, files in os.walk(root):
    if "/templates/cache" in dirpath:
        continue
    for fn in files:
        if not fn.endswith((".php", ".inc.php")):
            continue
        path = os.path.join(dirpath, fn)
        with open(path) as f:
            content = f.read()
        if old not in content:
            continue
        # sogo-auth.php redireciona para SOGo DEPOIS de registrar a sessão SSO — manter
        if fn == "sogo-auth.php":
            continue
        count = content.count(old)
        content = content.replace(old, new)
        with open(path, "w") as f:
            f.write(content)
        changed.append((path, count))
for path, count in changed:
    print(f"    {path}: {count}x")
if not changed:
    print("    Nenhum redirect direto restante (ou já corrigido).")
PY

TWIG="data/web/templates/user/tab-user-auth.twig"
if [[ -f "${TWIG}" ]]; then
  echo "==> Patch ${TWIG}"
  sed -i 's|href="/SOGo/so"|href="/sogo-auth.php?login={{ mailcow_cc_username }}"|g' "${TWIG}"
  sed -i 's|href="/SOGo/so/"|href="/sogo-auth.php?login={{ mailcow_cc_username }}"|g' "${TWIG}"
  grep -n 'SOGo/so\|sogo-auth.php' "${TWIG}" || true
fi

echo "==> Verificação — redirects diretos restantes:"
grep -rn 'Location: /SOGo/so/' data/web/ 2>/dev/null | grep -v templates/cache | grep -v sogo-auth.php || echo "    (nenhum — OK)"

echo "==> Limpando cache Twig..."
rm -rf data/web/templates/cache/* 2>/dev/null || true
PHP="$(docker ps --format '{{.Names}}' | grep -E 'php-fpm-mailcow' | head -1)"
if [[ -n "${PHP}" ]]; then
  docker exec "${PHP}" sh -c 'rm -rf /web/templates/cache/* 2>/dev/null; mkdir -p /web/templates/cache' || true
fi

echo "==> Reiniciando php-fpm, sogo, memcached..."
docker compose restart php-fpm-mailcow sogo-mailcow memcached-mailcow

echo ""
echo "Concluído. Faça logout em https://mail.nivesistemas.com.br/ e login de novo."
