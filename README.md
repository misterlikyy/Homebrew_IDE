# IDE-beta

A Windows desktop editor and dashboard for Arduino Uno projects.

## Download IDE-beta

- [Download the ZIP](https://github.com/misterlikyy/Homebrew_IDE/raw/refs/heads/main/downloads/latest/IDE-beta.zip)
- [Download the portable EXE](https://github.com/misterlikyy/Homebrew_IDE/raw/refs/heads/main/downloads/latest/IDE-beta.exe)

Extract the ZIP and run `IDE-beta.exe`. The portable app runs without an installer.

## Projects and Visualization

Choose your tabs at startup, then open a sketch or `.ideproj` project, continue your workspace, or create a new project. New projects can contain multiple `.ino` files, with `setup()` and `loop()` in `main.ino` and supporting code in the other files.

**File → Save Project** saves the code, open file tabs, workspace tab choices, and diagram together. Use **File → New / Open Project** to reopen it.

Open **Visualization** from the top bar for a separate circuit window. **Build from code** reads the project's files, and the parts library lets you add and wire components. Boards Manager and Library Manager are available from **Tools**.

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
