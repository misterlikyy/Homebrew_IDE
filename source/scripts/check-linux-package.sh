#!/usr/bin/env bash
# Runs only in disposable CI containers, as root, with /packages mounted read-only.
set -euo pipefail
kind=${1:?Pass deb or rpm}
case "$kind" in
  deb)
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -qq
    apt-get install -y /packages/IDE-beta-linux-amd64.deb xvfb desktop-file-utils
    test "$(dpkg-query -W -f='${Architecture}' ide-beta)" = amd64
    # The OSS compatibility shim also provides libasound2, but cannot run Electron.
    if dpkg-query -W -f='${Status}' liboss4-salsa-asound2 2>/dev/null | grep -q 'install ok installed'; then
      echo 'An incompatible ALSA compatibility shim was installed.' >&2
      exit 1
    fi
    ;;
  rpm)
    dnf install -y /packages/IDE-beta-linux-x86_64.rpm xorg-x11-server-Xvfb desktop-file-utils shadow-utils util-linux
    test "$(rpm -q --queryformat '%{ARCH}' ide-beta)" = x86_64
    ;;
  *) echo "Unsupported package type: $kind" >&2; exit 1 ;;
esac

test -x /usr/bin/ide-beta
test -f /usr/share/applications/ide-beta.desktop
desktop-file-validate /usr/share/applications/ide-beta.desktop
useradd --create-home ide-check
Xvfb :99 -screen 0 1280x800x24 -ac &
xvfb_pid=$!
trap 'kill "$xvfb_pid" 2>/dev/null || true' EXIT
sleep 1
# Chromium sandboxing is unavailable in these disposable Docker containers.
# This flag is limited to this test; installed desktop launchers retain sandboxing.
runuser -u ide-check -- env DISPLAY=:99 /usr/bin/ide-beta --no-sandbox --smoke-test

case "$kind" in
  deb) apt-get remove -y ide-beta ;;
  rpm) dnf remove -y ide-beta ;;
esac
test ! -e /usr/bin/ide-beta
test ! -e /usr/share/applications/ide-beta.desktop
echo "Package install, desktop entry, startup and removal passed."
