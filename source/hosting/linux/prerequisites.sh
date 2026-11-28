#!/usr/bin/env bash
# Sourced by setup and by the distribution dependency checks.
as_root() { if [ "$EUID" -eq 0 ]; then "$@"; else sudo "$@"; fi; }
detect_server_platform() {
  local release_file=${IDE_OS_RELEASE_FILE:-/etc/os-release}
  if [ ! -f "$release_file" ]; then echo 'Cannot identify Linux: /etc/os-release is missing.' >&2; return 1; fi
  local ID='' ID_LIKE='' PRETTY_NAME='Linux'
  . "$release_file"
  SERVER_DISTRO=$PRETTY_NAME
  case "$ID" in
    ubuntu|linuxmint) SERVER_FAMILY=ubuntu; SERVER_PACKAGES=(docker.io docker-compose-v2 docker-buildx openssl) ;;
    debian) SERVER_FAMILY=debian; SERVER_PACKAGES=(docker.io docker-compose docker-buildx openssl) ;;
    fedora) SERVER_FAMILY=fedora; SERVER_PACKAGES=(moby-engine docker-compose docker-buildx openssl) ;;
    *) echo "Automatic setup supports Ubuntu, Debian, Fedora and Linux Mint. Detected: $PRETTY_NAME. Install Docker Engine and Compose v2+ manually on other distributions." >&2; return 1 ;;
  esac
}
server_buildx_compatible() {
  local compose_version buildx_version compose_major compose_minor buildx_major buildx_minor
  compose_version=$(as_root docker compose version --short 2>/dev/null) || return 1
  buildx_version=$(as_root docker buildx version 2>/dev/null) || return 1
  [[ "$compose_version" =~ ^v?([0-9]+)\.([0-9]+) ]] || return 1
  compose_major=${BASH_REMATCH[1]}; compose_minor=${BASH_REMATCH[2]}
  [[ "$buildx_version" =~ v?([0-9]+)\.([0-9]+) ]] || return 1
  buildx_major=${BASH_REMATCH[1]}; buildx_minor=${BASH_REMATCH[2]}
  if [ "$compose_major" -gt 2 ] || { [ "$compose_major" = 2 ] && [ "$compose_minor" -ge 39 ]; }; then
    [ "$buildx_major" -gt 0 ] || [ "$buildx_minor" -ge 17 ]
  else
    return 0
  fi
}
install_server_dependencies() {
  local need_docker=0 need_compose=0 need_buildx=0 need_openssl=0
  command -v docker >/dev/null 2>&1 || need_docker=1
  command -v openssl >/dev/null 2>&1 || need_openssl=1
  if [ "$need_docker" = 0 ] && docker --version 2>/dev/null | grep -qi podman; then
    echo 'This setup needs Docker Engine, not the Podman docker-command wrapper. Install Docker Engine first; your existing container packages have not been changed.' >&2
    return 1
  fi
  as_root docker compose version >/dev/null 2>&1 || need_compose=1
  server_buildx_compatible || need_buildx=1
  if [ "$need_docker$need_compose$need_buildx$need_openssl" != 0000 ]; then
    local packages=() candidate major install_guide
    if [ "$SERVER_FAMILY" = fedora ]; then
      [ "$need_docker" = 0 ] || packages+=(moby-engine)
      [ "$need_compose" = 0 ] || packages+=(docker-compose)
      [ "$need_buildx" = 0 ] || packages+=(docker-buildx)
      [ "$need_openssl" = 0 ] || packages+=(openssl)
      echo "Installing dependencies for $SERVER_DISTRO: ${packages[*]}"
      as_root dnf install -y "${packages[@]}"
    else
      as_root apt-get update
      [ "$need_docker" = 0 ] || packages+=(docker.io)
      if [ "$need_compose" = 1 ]; then
        if dpkg-query -W -f='${Status}' docker-ce-cli 2>/dev/null | grep -q 'install ok installed' && apt-cache show docker-compose-plugin >/dev/null 2>&1; then
          packages+=(docker-compose-plugin)
        elif apt-cache show docker-compose-v2 >/dev/null 2>&1; then
          packages+=(docker-compose-v2)
        else
          candidate=$(apt-cache policy docker-compose | awk '/Candidate:/ {print $2; exit}')
          candidate=${candidate##*:}; major=${candidate%%.*}
          if [[ ! "$major" =~ ^[0-9]+$ ]] || [ "$major" -lt 2 ]; then
            install_guide="https://docs.docker.com/engine/install/$SERVER_FAMILY/"
            echo "Your repositories do not provide Compose v2+. Install Docker Engine and its Compose plugin from $install_guide then rerun setup. Existing Docker installations are not removed by this script." >&2
            return 1
          fi
          packages+=(docker-compose)
        fi
      fi
      if [ "$need_buildx" = 1 ]; then
        if dpkg-query -W -f='${Status}' docker-ce-cli 2>/dev/null | grep -q 'install ok installed'; then
          packages+=(docker-buildx-plugin)
        else
          packages+=(docker-buildx)
        fi
      fi
      [ "$need_openssl" = 0 ] || packages+=(openssl)
      echo "Installing dependencies for $SERVER_DISTRO: ${packages[*]}"
      as_root env DEBIAN_FRONTEND=noninteractive apt-get install -y "${packages[@]}"
    fi
  fi
  local compose_version
  compose_version=$(as_root docker compose version --short); compose_version=${compose_version#v}
  if [[ ! "$compose_version" =~ ^([0-9]+)\. ]] || [ "${BASH_REMATCH[1]}" -lt 2 ]; then
    echo 'Docker Compose v2 or newer is required.' >&2; return 1
  fi
  if ! server_buildx_compatible; then
    echo 'Docker Buildx is missing or too old for your Compose version. Update Docker and its Buildx/Compose packages, then rerun setup.' >&2
    return 1
  fi
}
