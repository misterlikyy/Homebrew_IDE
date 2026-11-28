#!/usr/bin/env bash
# Compatibility entry point for the original Mint server package.
set -euo pipefail
exec bash "$(dirname "$0")/setup-server.sh" "$@"
