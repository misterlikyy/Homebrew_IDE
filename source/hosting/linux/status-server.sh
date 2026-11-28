#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
. ./prerequisites.sh
as_root docker compose ps
as_root docker compose exec -T collaboration node -e "fetch('http://127.0.0.1:1234/health').then(async r=>{console.log(await r.text());process.exit(r.ok?0:1)}).catch(e=>{console.error(e.message);process.exit(1)})"
