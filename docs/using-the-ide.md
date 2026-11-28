# Use IDE-beta

[← Guides](README.md)

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

### Firmware backups

Select **Arduino Uno**, then choose **Run → Download Firmware from Board** to save a `.hex` flash backup and open it in a read-only viewer. The IDE validates the HEX checksums and keeps your editor files unchanged.

The backup contains **compiled firmware**; it cannot recover the original `.ino` source, comments, or variable names. EEPROM is not included, and the backup may contain bootloader bytes.

Readback supports the classic **ATmega328P Uno over USB** on Windows and Linux. Reading briefly resets the board without erasing or writing flash. Read protection or an incompatible bootloader may prevent readback.

For shared coding, see the [collaboration guide](collaboration.md).
