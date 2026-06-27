#!/usr/bin/env bash
set -euo pipefail
cd /opt/mailcow-dockerized
docker compose up -d
sleep 8
curl -sk -w "\nHTTP:%{http_code}\n" \
  "https://127.0.0.1/api/v1/get/status/version" \
  -H "Host: ${MAILCOW_HOSTNAME}" \
  -H "X-API-Key: ${MAILCOW_API_KEY}"
