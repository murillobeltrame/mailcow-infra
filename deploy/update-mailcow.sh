#!/usr/bin/env bash
set -euo pipefail

MAILCOW_DIR="${MAILCOW_DIR:-/opt/mailcow-dockerized}"

cd "${MAILCOW_DIR}"
git fetch origin
git checkout "${MAILCOW_BRANCH:-master}"
git pull

docker compose pull
docker compose up -d

echo "Mailcow atualizado."
docker compose ps
