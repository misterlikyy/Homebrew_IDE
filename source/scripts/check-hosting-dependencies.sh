#!/usr/bin/env bash
# Run as root in a disposable distribution container; no Docker daemon is started.
set -euo pipefail
. /setup/prerequisites.sh
detect_server_platform
install_server_dependencies
bash /setup/setup-server.sh --check-platform
docker --version
docker compose version
COLLAB_CREATE_KEY=ci-configuration-validation-only docker compose -f /setup/compose.yaml --profile internet config --quiet
echo 'Distribution Docker/Compose dependencies and server configuration passed.'
