#!/usr/bin/env bash
# Deploy local no VPS — mesmo fluxo do sistemaloja (git pull + scripts, sem SSH externo).
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/mailcow-infra}"
BRANCH="${BRANCH:-master}"

cd "$APP_DIR"
echo "==> Repositório: $APP_DIR ($BRANCH)"

if [[ ! -d .git ]]; then
  echo "Git não inicializado. Rode: bash deploy/link-vps-to-github.sh" >&2
  exit 1
fi

git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"

cd deploy
npm ci

export DEPLOY_MODE=local_vps
export ALLOW_LOCAL_DEPLOY=1

if [[ ! -f .env.deploy ]]; then
  echo "Arquivo deploy/.env.deploy não encontrado no VPS." >&2
  echo "Copie do PC ou configure secrets no GitHub Actions (runner self-hosted)." >&2
  exit 1
fi

BASE="${DEPLOY_BASE_SHA:-HEAD~1}"
CHANGED="$(git -C .. diff --name-only "$BASE" HEAD 2>/dev/null || true)"
echo "Arquivos alterados:"
echo "$CHANGED"

RUN_WEBMAIL=false
RUN_BRANDING=false
echo "$CHANGED" | grep -q '^webmail/' && RUN_WEBMAIL=true || true
echo "$CHANGED" | grep -qE '^(branding/|deploy/)' && RUN_BRANDING=true || true

if [[ "$RUN_WEBMAIL" = false && "$RUN_BRANDING" = false ]]; then
  RUN_BRANDING=true
fi

if [[ "$RUN_WEBMAIL" = true ]]; then
  echo "==> Deploy webmail"
  node deploy.mjs webmail
fi
if [[ "$RUN_BRANDING" = true ]]; then
  echo "==> Deploy branding"
  node deploy.mjs branding
fi

echo "Deploy concluído."
