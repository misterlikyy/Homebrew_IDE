#!/bin/sh
# RPM calls postun with a positive count while another version remains installed.
# Keep the command registered during upgrades; remove it on final uninstall.
case "$1" in
  [1-9]*) exit 0 ;;
esac
if command -v update-alternatives >/dev/null 2>&1; then
  update-alternatives --remove '${executable}' '/opt/${sanitizedProductName}/${executable}' || true
else
  rm -f '/usr/bin/${executable}'
fi
exit 0
