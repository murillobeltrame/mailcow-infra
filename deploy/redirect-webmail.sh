#!/usr/bin/env bash
# Compat: delega para configure-mailcow-routes.sh
exec "$(dirname "$0")/configure-mailcow-routes.sh" "$@"
