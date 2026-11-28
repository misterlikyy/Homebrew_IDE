# Collaborate on code

[← Guides](README.md) · [Server setup](../server/README.md)

> No public online server is provided. Use your own server; option 1 is for your local network.

1. Start your server and note its address and creation key.
2. Open **Share project** in IDE-beta and create a session.
3. Copy an **editor** or **viewer** invitation to your friend.
4. They open **Share project → Join session** and paste the code.

Everyone needs IDE-beta. For local-network mode, use the server PC’s network address, not `localhost`.

<details>
<summary>Permissions, recovery and limits</summary>

Use **Share project** in the top bar to create a private session or join with an invitation code. Editors can work on code and files together, with coloured cursors and participant names. Viewers can read the project. Concurrent edits merge, and an open app reconnects after a temporary connection loss.

The owner gets separate editor, viewer, and private owner-recovery codes, and can replace guest invitations or end the session. Code is saved on the collaboration server; each person keeps their own open tabs, layout, visualization, and Arduino controls. The first version shares **code and files**, not circuit diagrams or serial data. It does not let another user upload to your board or send it commands.

**Public server status: there is currently no public online collaboration server operated by this project.** Collaboration uses your own server. The default setup, option **1**, is for PCs on the same local network; it does not configure internet access.

Download the [Linux server setup ZIP](https://github.com/misterlikyy/Homebrew_IDE/releases/download/latest/IDE-beta-collaboration-server-linux.zip), extract it on **Ubuntu, Debian, Fedora or Linux Mint**, and run `bash setup-server.sh`. See the [Linux hosting guide](../source/hosting/linux/README.md) for setup, status checks, firewall instructions and optional internet hosting. The old Mint ZIP link and `setup-mint.sh` remain compatibility shortcuts.

Invitations grant access to anyone who has them. Credentials stay in app memory and are not included in `.ideproj` files; keep your owner recovery code if you want to reopen the same session later. Local drafts are backed up before joining, and **Open recovered local draft** can restore a draft after leaving. Project limits are 100 files, 256 KB per file, 1 MB of current text, and 12 connected participants. Server storage is readable by its administrator; transport uses HTTPS for public servers.


</details>
