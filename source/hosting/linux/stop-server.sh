#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
. ./prerequisites.sh
as_root docker compose --profile internet down
echo 'Server stopped. Project and certificate volumes were kept.'
