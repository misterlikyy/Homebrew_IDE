#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
. ./prerequisites.sh
detect_server_platform
if [ "${1:-}" = --check-platform ]; then
  printf 'Distribution: %s\nPackage family: %s\nDefault packages: %s\n' "$SERVER_DISTRO" "$SERVER_FAMILY" "${SERVER_PACKAGES[*]}"
  exit 0
fi
if [ "${1:-}" = --help ]; then
  echo 'Run bash setup-server.sh to configure your own collaboration server.'
  echo 'Supported systems: Ubuntu, Debian, Fedora and Linux Mint. Default mode: local network.'
  echo 'No public online server is provided by this project.'
  exit 0
fi
install_server_dependencies
as_root systemctl enable --now docker
echo '1) Share with PCs on the same local network'
echo '2) Share over the internet using your domain and HTTPS'
read -r -p 'Choose 1 or 2 [1]: ' mode
mode=${mode:-1}
domain=localhost
bind=0.0.0.0
if [ "$mode" = 2 ]; then
  read -r -p 'Domain pointing to this network (example: collab.yourdomain.com): ' domain
  if [[ ! "$domain" =~ ^[a-zA-Z0-9][a-zA-Z0-9.-]+[a-zA-Z0-9]$ || "$domain" != *.* ]]; then
    echo 'Enter a domain name without https://, a path or a port.' >&2
    exit 1
  fi
  bind=127.0.0.1
elif [ "$mode" != 1 ]; then
  echo 'Choose 1 or 2.' >&2
  exit 1
fi
key=''
if [ -f .env ]; then key=$(sed -n 's/^COLLAB_CREATE_KEY=//p' .env | head -n 1); fi
if [[ ! "$key" =~ ^[a-f0-9]{64}$ ]]; then key=$(openssl rand -hex 32); fi
umask 077
printf 'COLLAB_CREATE_KEY=%s\nCOLLAB_DOMAIN=%s\nCOLLAB_BIND=%s\n' "$key" "$domain" "$bind" > .env
chmod 600 .env
as_root docker compose --profile internet config --quiet
if [ "$mode" = 2 ]; then
  as_root docker compose --profile internet up -d --build
  echo "Server address: https://$domain"
  echo 'Point the domain DNS at your public IP and forward TCP ports 80 and 443 to this Linux PC. The README explains this setup.'
else
  as_root docker compose up -d --build
  local_ip=$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="src") {print $(i+1); exit}}' || true)
  if [ -z "$local_ip" ]; then local_ip=$(hostname -I | awk '{print $1}'); fi
  echo "Server address for other PCs: http://$local_ip:1234"
  echo 'Local-network mode selected. This mode does not configure an internet endpoint.'
  echo 'If a firewall is enabled, allow TCP 1234 from your local subnet. See README for UFW and Fedora firewalld instructions.'
fi
echo "Server creation key (keep private; enter it only when creating sessions): $key"
echo 'Open IDE-beta → Share project, enter the address, your display name and creation key.'
echo 'Keep this PC powered on while collaborating. Shared projects are stored in a persistent Docker volume.'
