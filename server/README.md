# Collaboration server

[← Home](../README.md)

> **No public online server is provided.** Run your own server; the default is local-network sharing.

Supports **Ubuntu, Debian, Fedora and Linux Mint**.

## Start here

1. [Download the server ZIP](https://github.com/misterlikyy/Homebrew_IDE/releases/download/latest/IDE-beta-collaboration-server-linux.zip).
2. Extract it and open a terminal in that folder.
3. Run `bash setup-server.sh` and choose **1** for your local network.
4. Enter the displayed address and creation key in **Share project** in the app.

To check it, run `bash status-server.sh` from the same folder.

**Updating an existing server?** Keep your original folder and `.env` to retain settings and shared projects. The old `setup-mint.sh` command still works.

[Full setup, troubleshooting and internet hosting](../source/hosting/linux/README.md) · [Sharing guide](../docs/collaboration.md)

<details>
<summary>Server source and configuration</summary>

- [Hosting scripts and Docker configuration](../source/hosting/linux/)
- [Server runtime](../source/collaboration/server.cjs)

</details>
