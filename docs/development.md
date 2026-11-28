# Build and develop

[← Guides](README.md) · [App code](../source/)

## Build from source

Use **Node.js 22 or newer**. Build output is written to `source/dist/`.

| Platform | Build script | Output |
| --- | --- | --- |
| Windows | Double-click [source/build.bat](../source/build.bat) | Portable EXE |
| Linux | Run `sh source/build.sh` | AppImage, archive, DEB, and RPM |

For Linux RPM builds, install `rpm` on Ubuntu/Debian or `rpm-build` on Fedora first.

For manual builds, run `npm ci` inside `source/`, then `npm run dist:win` on Windows or `npm run dist:linux` on Linux.

## Releases and checks

App and workflow changes pushed to `main` start [**Build and publish Windows and Linux**](https://github.com/misterlikyy/Homebrew_IDE/actions/workflows/build-desktop.yml). It can also be started manually with **Run workflow**.

All six download formats are published together after these checks pass:

| Check | Environment |
| --- | --- |
| Firmware tests, collaboration server tests, and project / Visualization / live-session UI checks | Windows and Linux |
| Server container build, storage and WebSocket login | Linux |
| Server dependency installation and Compose configuration | Ubuntu 24.04, Debian 13 and Fedora 45; Mint detection is tested separately |
| Packaged app startup | Windows, Linux AppImage, and Linux archive |
| DEB installation, menu entry, launch, and removal | Ubuntu 24.04 and Debian 13 |
| RPM installation, menu entry, launch, and removal | Fedora 45 |

Linux builds run on Ubuntu 22.04; distribution installation checks run in CI containers. Other distribution versions and physical Arduino USB operations are outside those checks.

The Linux server ZIP is published alongside the desktop downloads. Download links stay the same across releases. This workflow publishes new builds; it does not automatically install updates on your computer or start a public server.

## Folder map

| Folder | Contents |
| --- | --- |
| [source/](../source/) | App code and build scripts |
| [server/](../server/) | Server download and hosting entry point |
| [docs/](README.md) | User and developer guides |
| [downloads/](../downloads/) | Current downloads and archived builds |
| [.github/workflows/](../.github/workflows/) | Build, test and release automation |

## License

[MIT](../LICENSE) © 2026 misterlikyy. Bundled fonts include their own licenses in [source/fonts/](../source/fonts/).
