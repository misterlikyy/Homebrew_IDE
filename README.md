# IDE-beta

A desktop editor, dashboard, and circuit visualization workspace for Arduino Uno projects on **Windows and Linux**.

> **Collaboration status:** no public online server is currently provided. Run your own server; the default setup shares with PCs on your local network.

[Latest release](https://github.com/misterlikyy/Homebrew_IDE/releases/tag/latest) · [Downloads](#downloads) · [Getting started](#getting-started) · [Build from source](#build-from-source)

## Downloads

All downloads below are for **64-bit x86 PCs**.

| System | Download | Format |
| --- | --- | --- |
| Windows | [Portable app](https://github.com/misterlikyy/Homebrew_IDE/releases/download/latest/IDE-beta.exe) | `.exe` |
| Windows | [ZIP bundle](https://github.com/misterlikyy/Homebrew_IDE/releases/download/latest/IDE-beta.zip) | `.zip` |
| Ubuntu / Debian | [Installer](https://github.com/misterlikyy/Homebrew_IDE/releases/download/latest/IDE-beta-linux-amd64.deb) | `.deb` |
| Fedora | [Installer](https://github.com/misterlikyy/Homebrew_IDE/releases/download/latest/IDE-beta-linux-x86_64.rpm) | `.rpm` |
| Linux — portable | [AppImage](https://github.com/misterlikyy/Homebrew_IDE/releases/download/latest/IDE-beta-linux-x86_64.AppImage) | `.AppImage` |
| Linux — portable | [Archive](https://github.com/misterlikyy/Homebrew_IDE/releases/download/latest/IDE-beta-linux-x64.tar.gz) | `.tar.gz` |

See the [release page](https://github.com/misterlikyy/Homebrew_IDE/releases/tag/latest) for release notes and the source commit used for the build.

## Installation

### Windows

Run `IDE-beta.exe`, or extract the ZIP and run the EXE inside.

### Ubuntu / Debian

From the folder containing the downloaded DEB:

```sh
sudo apt install ./IDE-beta-linux-amd64.deb
```

### Fedora

From the folder containing the downloaded RPM:

```sh
sudo dnf install ./IDE-beta-linux-x86_64.rpm
```

After installing either package, open **IDE-beta** from your application menu or run `ide-beta`. Dependencies are installed through your package manager. To uninstall, use `sudo apt remove ide-beta` or `sudo dnf remove ide-beta`.

### Portable Linux

Make the AppImage executable, then launch it:

```sh
chmod +x IDE-beta-linux-x86_64.AppImage
./IDE-beta-linux-x86_64.AppImage
```

If FUSE 2 is unavailable, add `--appimage-extract-and-run` to the launch command. Alternatively, extract the `.tar.gz` archive and run `ide-beta` from the extracted folder. A graphical Linux desktop is required.

**Linux serial access:** if connection or upload reports permission denied, follow [Arduino's port-access instructions](https://support.arduino.cc/hc/en-us/articles/360016495679-Fix-port-access-on-Linux).

## Getting started

1. Launch the app and choose which workspace tabs you want.
2. Open a sketch or `.ideproj` project, continue your previous workspace, or create a new project.
3. Connect your Uno over USB, select **Arduino Uno**, and choose its serial port.
4. Use **Tools → Set Up Upload Tools** to install Arduino CLI and Uno support if needed.
5. Write your sketch, then use **Run → Build** or **Run → Upload**.

| Shortcut | Action |
| --- | --- |
| `Ctrl+Shift+B` | Build |
| `Ctrl+Shift+U` | Upload |
| `Ctrl+S` | Save; saves the whole project when it contains multiple files |

## Projects and tools

### Multi-file projects

A project can contain multiple sketch files. Keep `setup()` and `loop()` in `main.ino`, with supporting code in the other files; the `.ino` files form one Arduino program.

**File → Save Project** stores your code, open file tabs, workspace tab choices, and visualization together in an `.ideproj` file. Reopen it with **File → New / Open Project**.

### Visualization and workspace

Open **Visualization** from the top bar for a separate circuit window. Use **Build from code** to create a diagram from your project's files, or add and wire components from the parts library.

- **Dashboard, Board, Serial Monitor, and Serial Log** are available as workspace views.
- **View → Choose Workspace Tabs** changes which views appear.
- **Tools → Boards Manager / Library Manager** manages board packages and libraries.

### Live collaboration

Use **Share project** in the top bar to create a private session or join with an invitation code. Editors can work on code and files together, with coloured cursors and participant names. Viewers can read the project. Concurrent edits merge, and an open app reconnects after a temporary connection loss.

The owner gets separate editor, viewer, and private owner-recovery codes, and can replace guest invitations or end the session. Code is saved on the collaboration server; each person keeps their own open tabs, layout, visualization, and Arduino controls. The first version shares **code and files**, not circuit diagrams or serial data. It does not let another user upload to your board or send it commands.

**Public server status: there is currently no public online collaboration server operated by this project.** Collaboration uses your own server. The default setup, option **1**, is for PCs on the same local network; it does not configure internet access.

Download the [Linux server setup ZIP](https://github.com/misterlikyy/Homebrew_IDE/releases/download/latest/IDE-beta-collaboration-server-linux.zip), extract it on **Ubuntu, Debian, Fedora or Linux Mint**, and run `bash setup-server.sh`. See the [Linux hosting guide](source/hosting/linux/README.md) for setup, status checks, firewall instructions and optional internet hosting. The old Mint ZIP link and `setup-mint.sh` remain compatibility shortcuts.

Invitations grant access to anyone who has them. Credentials stay in app memory and are not included in `.ideproj` files; keep your owner recovery code if you want to reopen the same session later. Local drafts are backed up before joining, and **Open recovered local draft** can restore a draft after leaving. Project limits are 100 files, 256 KB per file, 1 MB of current text, and 12 connected participants. Server storage is readable by its administrator; transport uses HTTPS for public servers.

### Firmware backups

Select **Arduino Uno**, then choose **Run → Download Firmware from Board** to save a `.hex` flash backup and open it in a read-only viewer. The IDE validates the HEX checksums and keeps your editor files unchanged.

The backup contains **compiled firmware**; it cannot recover the original `.ino` source, comments, or variable names. EEPROM is not included, and the backup may contain bootloader bytes.

Readback supports the classic **ATmega328P Uno over USB** on Windows and Linux. Reading briefly resets the board without erasing or writing flash. Read protection or an incompatible bootloader may prevent readback.

## Build from source

Use **Node.js 22 or newer**. Build output is written to `source/dist/`.

| Platform | Build script | Output |
| --- | --- | --- |
| Windows | Double-click [source/build.bat](source/build.bat) | Portable EXE |
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

## Repository layout

| Path | Contents |
| --- | --- |
| [source/](source/) | App code, icons, fonts, tests, and build scripts |
| [downloads/latest/](downloads/latest/) | Current download links and usage notes |
| [downloads/archive/](downloads/archive/) | Older published builds, grouped by version |
| [.github/workflows/](.github/workflows/) | Build, test, and release automation |
| [GitHub Releases](https://github.com/misterlikyy/Homebrew_IDE/releases/tag/latest) | Current Windows and Linux packages |

## License

[MIT](LICENSE) © 2026 misterlikyy. Bundled fonts include their own licenses in [source/fonts/](source/fonts/).
