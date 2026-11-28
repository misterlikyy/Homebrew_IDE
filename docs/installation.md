# Install IDE-beta

[← Guides](README.md) · [Downloads](../downloads/README.md)

## Windows

Run `IDE-beta.exe`, or extract the ZIP and run the EXE inside.

## Ubuntu / Debian

From the folder containing the downloaded DEB:

```sh
sudo apt install ./IDE-beta-linux-amd64.deb
```

## Fedora

From the folder containing the downloaded RPM:

```sh
sudo dnf install ./IDE-beta-linux-x86_64.rpm
```

After installing either package, open **IDE-beta** from your application menu or run `ide-beta`. Dependencies are installed through your package manager. To uninstall, use `sudo apt remove ide-beta` or `sudo dnf remove ide-beta`.

## Portable Linux

Make the AppImage executable, then launch it:

```sh
chmod +x IDE-beta-linux-x86_64.AppImage
./IDE-beta-linux-x86_64.AppImage
```

If FUSE 2 is unavailable, add `--appimage-extract-and-run` to the launch command. Alternatively, extract the `.tar.gz` archive and run `ide-beta` from the extracted folder. A graphical Linux desktop is required.

**Linux serial access:** if connection or upload reports permission denied, follow [Arduino's port-access instructions](https://support.arduino.cc/hc/en-us/articles/360016495679-Fix-port-access-on-Linux).

The Linux serial monitor opens the actual device path used for upload, such as `/dev/ttyUSB0`, and retries while the board restarts. Close other serial monitors that use the same board. The Dashboard updates when the sketch sends data; after a connection loss it labels retained readings as last received data.
