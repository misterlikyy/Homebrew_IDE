# IDE-beta

A Windows desktop editor and dashboard for Arduino Uno projects.

## Download IDE-beta

- [Download the ZIP](https://github.com/misterlikyy/ide-for-aldruino-homebrew-/raw/refs/heads/main/downloads/latest/IDE-beta.zip)
- [Download the portable EXE](https://github.com/misterlikyy/ide-for-aldruino-homebrew-/raw/refs/heads/main/downloads/latest/IDE-beta.exe)

Extract the ZIP and run `IDE-beta.exe`. The portable app runs without an installer.

## Repository layout

| Folder | Contents |
| --- | --- |
| [source/](source/) | App code, icons, example sketch, and Windows build script |
| [downloads/latest/](downloads/latest/) | Current Windows EXE, ZIP, and release notes |
| [downloads/archive/](downloads/archive/) | Older published versions, grouped by alpha number |
| [.github/workflows/](.github/workflows/) | Windows build automation |

## Build from source

Install Node.js, open [source/](source/), and double-click `build.bat`. The script builds the EXE in `source/dist/` and copies it to your Desktop.

To build from a terminal, run `npm ci` followed by `npm run dist` inside `source/`.

The repository's **Actions → Build Windows app → Run workflow** also produces a downloadable Windows build.
