# IDE-beta

A Windows and Linux desktop editor and dashboard for Arduino Uno projects.

## Download IDE-beta

- [Windows portable EXE](https://github.com/misterlikyy/Homebrew_IDE/releases/download/latest/IDE-beta.exe)
- [Windows ZIP](https://github.com/misterlikyy/Homebrew_IDE/releases/download/latest/IDE-beta.zip)
- [Linux x86-64 AppImage](https://github.com/misterlikyy/Homebrew_IDE/releases/download/latest/IDE-beta-linux-x86_64.AppImage)
- [Linux x86-64 portable archive](https://github.com/misterlikyy/Homebrew_IDE/releases/download/latest/IDE-beta-linux-x64.tar.gz)

On Windows, extract the ZIP and run `IDE-beta.exe`.

On Linux, make the AppImage executable and open it.

```sh
chmod +x IDE-beta-linux-x86_64.AppImage
./IDE-beta-linux-x86_64.AppImage
```

If your distribution has no FUSE 2 runtime, run the AppImage with `--appimage-extract-and-run`, or extract the portable archive and run `ide-beta` from the extracted folder. A graphical Linux desktop is required. Linux builds target x86-64 and are checked on Ubuntu 22.04.

Linux accounts need permission to access the Arduino serial port. Follow [Arduino's Linux port-access instructions](https://support.arduino.cc/hc/en-us/articles/360016495679-Fix-port-access-on-Linux) if connection or upload reports permission denied. Set up upload tools from the app to install the Linux Arduino CLI and Uno core.

## Projects and Visualization

Choose your tabs at startup, then open a sketch or `.ideproj` project, continue your workspace, or create a new project. New projects can contain multiple `.ino` files, with `setup()` and `loop()` in `main.ino` and supporting code in the other files.

**File → Save Project** saves the code, open file tabs, workspace tab choices, and diagram together. Use **File → New / Open Project** to reopen it.

Open **Visualization** from the top bar for a separate circuit window. **Build from code** reads the project's files, and the parts library lets you add and wire components. Boards Manager and Library Manager are available from **Tools**.

## Repository layout

| Folder | Contents |
| --- | --- |
| [source/](source/) | App code, icons, example sketch, and build scripts |
| [downloads/latest/](downloads/latest/) | Current download links and release notes |
| [GitHub Releases](https://github.com/misterlikyy/Homebrew_IDE/releases/tag/latest) | Current Windows and Linux binaries |
| [downloads/archive/](downloads/archive/) | Older published versions, grouped by alpha number |
| [.github/workflows/](.github/workflows/) | Windows build automation |

## Build from source

Install Node.js 22 or newer. On Windows, open [source/](source/) and double-click `build.bat`. On Linux, run `sh source/build.sh`.

Inside `source/`, run `npm ci`, then `npm run dist:win` on Windows or `npm run dist:linux` on Linux.

## Automatic updates

Every app or workflow change pushed to `main` starts **Actions → Build and publish Windows and Linux**. Both platforms must build and pass their UI and packaged-startup checks before the `latest` release downloads are updated. The workflow can also be started manually with **Run workflow**.

Downloads live in GitHub Releases so new builds update the same links without adding large binaries to every source commit. The release notes identify the source commit used for both platforms.
