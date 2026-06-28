#!/usr/bin/env bash
# Verifica deploy do webmail e aplica se estiver desatualizado.
set -euo pipefail

EXPECTED="${EXPECTED_COMMIT:-e35e269}"
APP_DIR="${APP_DIR:-/var/www/mailcow-infra}"
MAILCOW_DIR="${MAILCOW_DIR:-/opt/mailcow-dockerized}"
HOST="${MAILCOW_HOSTNAME:-mail.nivesistemas.com.br}"

echo "=== VPS: $(hostname) — $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="

echo ""
echo "=== Repositório mailcow-infra ==="
if [[ -d "$APP_DIR/.git" ]]; then
  cd "$APP_DIR"
  git fetch origin master 2>/dev/null || git fetch origin main 2>/dev/null || true
  LOCAL="$(git rev-parse --short HEAD 2>/dev/null || echo none)"
  REMOTE="$(git rev-parse --short origin/master 2>/dev/null || git rev-parse --short origin/main 2>/dev/null || echo none)"
  echo "HEAD local:  $LOCAL $(git log -1 --format='%s' 2>/dev/null || true)"
  echo "HEAD remoto: $REMOTE"
  echo "Esperado:    $EXPECTED"
else
  echo "AVISO: $APP_DIR não é um repositório git"
  LOCAL=none
  REMOTE=none
fi

echo ""
echo "=== Container nive-mail-web ==="
docker ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}' | grep -E 'nive-mail|NAMES' || echo "Container não encontrado"

echo ""
echo "=== Código de sessão no container ==="
if docker ps --format '{{.Names}}' | grep -q '^nive-mail-web$'; then
  if docker exec nive-mail-web grep -q "resolveSessionFromCookie" /app/dist/session.js 2>/dev/null; then
    echo "OK: sessão server-side (resolveSessionFromCookie presente)"
  else
    echo "DESATUALIZADO: código antigo no container"
  fi
else
  echo "Container parado — não foi possível inspecionar código"
fi

echo ""
echo "=== HTTP (nginx local) ==="
curl -sk -o /dev/null -w "GET /mail/health -> HTTP %{http_code}\n" -H "Host: ${HOST}" "https://127.0.0.1/mail/health" || true
curl -sk -o /dev/null -w "GET /mail/login -> HTTP %{http_code}\n" -H "Host: ${HOST}" "https://127.0.0.1/mail/login" || true

echo ""
echo "=== Deploy necessário? ==="
NEED_DEPLOY=false
if [[ -d "$APP_DIR/.git" ]]; then
  cd "$APP_DIR"
  if ! git merge-base --is-ancestor "$EXPECTED" HEAD 2>/dev/null; then
    NEED_DEPLOY=true
    echo "Sim — commit $EXPECTED não está no HEAD local"
  else
    echo "Git OK — commit esperado já está no histórico"
  fi
fi

if docker ps --format '{{.Names}}' | grep -q '^nive-mail-web$'; then
  if ! docker exec nive-mail-web grep -q "resolveSessionFromCookie" /app/dist/session.js 2>/dev/null; then
    NEED_DEPLOY=true
    echo "Sim — container sem fix de sessão"
  fi
else
  NEED_DEPLOY=true
  echo "Sim — container não está rodando"
fi

if [[ "$NEED_DEPLOY" == true && "${RUN_DEPLOY:-1}" == "1" ]]; then
  echo ""
  echo "=== Executando deploy webmail ==="
  if [[ ! -d "$APP_DIR/.git" ]]; then
    echo "ERRO: repositório ausente; abortando deploy" >&2
    exit 1
  fi
  cd "$APP_DIR"
  git fetch origin master || git fetch origin main
  git reset --hard origin/master 2>/dev/null || git reset --hard origin/main
  cd deploy
  npm ci --silent 2>/dev/null || npm ci
  export DEPLOY_MODE=local_vps
  export ALLOW_LOCAL_DEPLOY=1
  if [[ ! -f .env.deploy ]]; then
    echo "ERRO: deploy/.env.deploy ausente no VPS" >&2
    exit 1
  fi
  node deploy.mjs webmail
  echo ""
  echo "=== Pós-deploy ==="
  docker ps --format '{{.Names}}: {{.Status}}' | grep nive-mail || true
  if docker exec nive-mail-web grep -q "resolveSessionFromCookie" /app/dist/session.js 2>/dev/null; then
    echo "OK: fix de sessão aplicado no container"
  else
    echo "AVISO: fix ainda não detectado após deploy" >&2
    exit 2
  fi
  curl -sk -o /dev/null -w "GET /mail/health -> HTTP %{http_code}\n" -H "Host: ${HOST}" "https://127.0.0.1/mail/health" || true
else
  echo "Deploy automático: ${NEED_DEPLOY} (RUN_DEPLOY=${RUN_DEPLOY:-1})"
fi

echo ""
echo "=== Concluído ==="
