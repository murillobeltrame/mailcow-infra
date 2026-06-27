#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bash "${SCRIPT_DIR}/fix-sogo-access.sh"
bash "${SCRIPT_DIR}/fix-sogo-static-view.sh"
bash "${SCRIPT_DIR}/fix-sogo-sso-dovecot.sh"
bash "${SCRIPT_DIR}/fix-sogo-sso-redirect.sh"
