IDE-beta — Windows and Linux

Extract the ZIP and run IDE-beta.exe.

Run > Download Firmware from Board saves the connected classic Uno's compiled flash as a .hex backup and opens a read-only viewer. This cannot recover the original .ino source, comments, or variable names. EEPROM is not included. Reading resets the board briefly but does not erase or write flash. The open editor files stay unchanged.

Ubuntu/Debian x86-64: sudo apt install ./IDE-beta-linux-amd64.deb
Fedora x86-64: sudo dnf install ./IDE-beta-linux-x86_64.rpm
After installation, open IDE-beta from the application menu or run ide-beta. Remove with sudo apt remove ide-beta or sudo dnf remove ide-beta.

Portable Linux x86-64: make IDE-beta-linux-x86_64.AppImage executable and run it. If FUSE 2 is unavailable, use --appimage-extract-and-run or the portable tar.gz archive. After extracting the archive, run ide-beta from the extracted folder.

Linux serial-port permission setup: https://support.arduino.cc/hc/en-us/articles/360016495679-Fix-port-access-on-Linux

Both versions are rebuilt and published automatically after app changes are pushed to main. Current downloads: https://github.com/misterlikyy/Homebrew_IDE/releases/tag/latest

At startup, choose your workspace tabs, then continue the last workspace, open a project/sketch, or create a new project. Choose the sketch file count when creating a project. Multiple .ino files share one Arduino program; setup() and loop() belong in main.ino.

File > Save Project saves an .ideproj file containing all sketch files, open file tabs, selected workspace tabs, and the visualization. File > New / Open Project opens it later. Ctrl+S saves the whole project when it contains multiple files.

Visualization opens in a separate window from the top bar or Window menu. Build from code creates a diagram from all project files; parts and wiring can also be edited there. Save project in the Visualization window saves through its editor window.

Boards Manager and Library Manager are in Tools. View > Choose Workspace Tabs changes the chosen tabs later.

The interface has a simpler Explorer, neutral dark colors, consistent spacing, and a quieter status bar. Explorer snippets have been removed.

The top bar combines the app icon, IDE-beta title, and File/Edit menus. Russo One is bundled for offline use, with its license in source/fonts/OFL-RussoOne.txt.
The unused gap below the top bar has been removed.

Fixed build and upload buttons staying disabled after errors, isolated temporary sketch folders for builds in multiple windows, and validation of incoming pin reports.

Existing projects, settings, and downloaded Arduino tools are reused from the previous app data folder.

Connect your Arduino and upload with Auto pin readings enabled for live pin readings and supported LCD print reporting.
