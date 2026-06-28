#!/usr/bin/env bash
# Registra runner self-hosted do mailcow-infra no VPS (mesmo padrão sistemaloja / whatsapp-gateway).
set -euo pipefail

RUNNER_DIR="${RUNNER_DIR:-/opt/gh-runner-mailcow-infra}"
RUNNER_NAME="${RUNNER_NAME:-vps-mailcow-infra}"
RUNNER_LABELS="${RUNNER_LABELS:-self-hosted,Linux,vps-hostinger}"
REPO="${REPO:-https://github.com/murillobeltrame/mailcow-infra}"
RUNNER_VERSION="${RUNNER_VERSION:-2.335.1}"

if [[ -z "${RUNNER_TOKEN:-}" ]]; then
  echo "Defina RUNNER_TOKEN (token de registro do GitHub, expira em ~1h)."
  echo ""
  echo "  GitHub → mailcow-infra → Settings → Actions → Runners → New self-hosted runner"
  echo "  Copie o token e rode:"
  echo ""
  echo "    RUNNER_TOKEN=XXXX bash deploy/setup-github-runner.sh"
  echo ""
  exit 1
fi

mkdir -p "$RUNNER_DIR"
cd "$RUNNER_DIR"

if [[ ! -f ./config.sh ]]; then
  ARCH="$(uname -m)"
  case "$ARCH" in
    x86_64) RUNNER_ARCH=x64 ;;
    aarch64|arm64) RUNNER_ARCH=arm64 ;;
    *) echo "Arquitetura não suportada: $ARCH"; exit 1 ;;
  esac
  TAR="actions-runner-linux-${RUNNER_ARCH}-${RUNNER_VERSION}.tar.gz"
  echo "==> Baixando actions-runner v${RUNNER_VERSION} (${RUNNER_ARCH})..."
  curl -fsSL -o "$TAR" "https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/${TAR}"
  tar xzf "$TAR"
  rm -f "$TAR"
fi

echo "==> Configurando runner $RUNNER_NAME ($RUNNER_LABELS)..."
RUNNER_ALLOW_RUNASROOT=1 ./config.sh \
  --url "$REPO" \
  --token "$RUNNER_TOKEN" \
  --name "$RUNNER_NAME" \
  --labels "$RUNNER_LABELS" \
  --unattended \
  --replace

echo "==> Instalando serviço systemd..."
RUNNER_ALLOW_RUNASROOT=1 ./svc.sh install
RUNNER_ALLOW_RUNASROOT=1 ./svc.sh start

SVC="actions.runner.murillobeltrame-mailcow-infra.${RUNNER_NAME}.service"
systemctl enable "$SVC" 2>/dev/null || true
systemctl status "$SVC" --no-pager || true

echo ""
echo "Runner instalado: $RUNNER_DIR"
echo "Labels: $RUNNER_LABELS"
echo "Verifique: GitHub → mailcow-infra → Settings → Actions → Runners"
