#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"
if ! command -v npm >/dev/null 2>&1; then
  echo "Install Node.js 22 or newer, then run this script again."
  exit 1
fi
if ! command -v rpmbuild >/dev/null 2>&1; then
  echo "Building RPM needs rpmbuild: install rpm on Ubuntu/Debian, or rpm-build on Fedora."
  exit 1
fi
npm ci --no-audit --no-fund
npm run dist:linux
echo "Linux AppImage, tar.gz, DEB and RPM downloads are in source/dist."
