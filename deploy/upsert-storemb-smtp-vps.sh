#!/usr/bin/env bash
# Atualiza SMTP da loja MB Importados no banco (roda no VPS).
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/corely-foundation-builders/backend}"
PG_PASS="${POSTGRES_PASSWORD:-SNg74BRpThZhkuGq_dHuHU8ZOpZzpNij}"
MAILCOW_PASS=$(grep '^MAILCOW_PASS=' /opt/mailcow-dockerized/mailcow.conf | cut -d= -f2- | tr -d '\r"')

export DATABASE_URL="postgresql://corely:${PG_PASS}@127.0.0.1:5434/storembimportados?schema=public"
export SMTP_PASSWORD="${MAILCOW_PASS}"
export SMTP_HOST="mail.nivesistemas.com.br"
export SMTP_CONTACT_EMAIL="contato@storembimportados.com.br"
export TENANT_SLUG="mbimportados"
export EMAIL_FROM_NAME="MB Importados"

[[ -d "${APP_DIR}" ]] || { echo "ERRO: ${APP_DIR} não encontrado"; exit 1; }
cd "${APP_DIR}"

echo "==> Atualizando SMTP storembimportados.com.br"
npx ts-node scripts/upsert-zoho-smtp-settings.ts
