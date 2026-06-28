#!/usr/bin/env bash
# Rode UMA VEZ no VPS para clonar/ligar mailcow-infra ao GitHub (modelo sistemaloja).
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/mailcow-infra}"
GIT_REPO="${GIT_REPO:-https://github.com/murillobeltrame/mailcow-infra.git}"
BRANCH="${BRANCH:-master}"

mkdir -p "$(dirname "$APP_DIR")"

if [[ ! -d "$APP_DIR/.git" ]]; then
  echo "==> Clonando $GIT_REPO em $APP_DIR..."
  git clone "$GIT_REPO" "$APP_DIR"
fi

cd "$APP_DIR"

if ! git remote get-url origin >/dev/null 2>&1; then
  git remote add origin "$GIT_REPO"
fi

echo "==> Sincronizando $BRANCH..."
git fetch origin "$BRANCH"
git checkout -B "$BRANCH" "origin/$BRANCH" 2>/dev/null || git checkout -B "$BRANCH"
git reset --hard "origin/$BRANCH"

chmod +x deploy/deploy-on-vps.sh deploy/*.sh 2>/dev/null || true
echo "OK — $APP_DIR ligado ao GitHub ($BRANCH)."
echo "Próximo: configure deploy/.env.deploy e registre o runner self-hosted (label vps-hostinger)."
