# Host IDE-beta collaboration on Linux Mint

This package runs the collaboration server on a Linux Mint PC using Docker. Windows and Linux IDE-beta clients connect to it; the Mint PC does not need an Arduino attached. Keep the PC powered on while people are collaborating.

## Set up

1. Extract the whole server ZIP into a folder, for example `~/IDE-beta-server`.
2. Open a terminal in that folder and run `bash setup-mint.sh`.
3. The script installs Docker/Compose if needed, generates a private creation key, and starts the service. It asks for your sudo password when installing packages or managing Docker.
4. Enter the displayed **server address** and **creation key** in IDE-beta → **Share project**. Set a display name, then choose **Share this project**.
5. Copy an **editor** or **viewer** invitation to the people you want to join. They paste it into **Share project → Join session**. Joining does not require your server creation key.

The setup targets Linux Mint 22.x (Ubuntu 24.04 based). The server container is built and checked in GitHub Actions; the setup script and internet routing still need to be run on your Mint PC.

## Local-network mode

Choose **1** in setup. Other PCs on the same trusted network connect using the Mint PC's private address, such as `http://192.168.1.20:1234`. Use the Mint address even when creating a session locally so invitations work on the other PCs. `localhost` invitations only work on the same PC.

If UFW is enabled, allow port 1234 from your actual local subnet, for example `sudo ufw allow from 192.168.1.0/24 to any port 1234 proto tcp`. Adjust that subnet to match your network. This mode uses HTTP; it is for your trusted local network.

## Internet mode

Choose **2** in setup and enter a domain you control, such as `collab.yourdomain.com`.

- Point its DNS A record at your network's public IPv4 address.
- Give the Mint PC a stable local address and forward **TCP 80 and 443** from your router to that PC. Allow those ports in its firewall.
- Caddy obtains and renews the HTTPS certificate and forwards WebSocket connections to the server. The raw server port is bound to localhost in this mode.
- Everyone uses `https://your-domain` in IDE-beta. Share newly generated invitations if you previously used a LAN address.

If your internet connection uses carrier-grade NAT or blocks inbound ports, router forwarding will not be enough. You will need a VPN/tunnel with an HTTPS endpoint or another reachable host. This package does not configure your router, DNS provider or a tunnel automatically.

## Daily use

```sh
# Status and recent logs
sudo docker compose ps
sudo docker compose logs --tail=100 collaboration

# Restart the server; shared projects remain stored
sudo docker compose restart collaboration

# Stop everything, keeping project data
bash stop-server.sh
```

To start again, use `sudo docker compose up -d` for LAN mode or `sudo docker compose --profile internet up -d` for internet mode. Docker starts the configured services again after a reboot.

## Storage, invitations and updates

- The persistent `projects` volume holds shared code and hashed access tokens. Keep its data and your `.env` file when updating. Do not use `docker compose down -v` if you want to keep projects.
- The server stores code on the Mint PC; HTTPS protects transport but is not end-to-end encryption. The server administrator can read stored code.
- Anyone holding an invitation gets its role. Keep the owner recovery code private. **Replace guest invitations** disconnects guests and invalidates old guest codes. **End session** deletes the server copy.
- Inactive sessions expire after 7 days without document changes. This first version allows at most 12 connected users per session, 100 files, 256 KB per file, and 1 MB of current project text.
- Updates: replace the extracted server code with the new ZIP while keeping `.env`, use the same folder (so Docker keeps the same named volumes), then run setup again. Save important projects locally in the IDE before server maintenance.

To back up server data, stop it and copy the Docker `projects` volume using your usual Docker volume backup method. The IDE can also save any shared workspace as a local `.ideproj` file. Invite tokens are kept in app memory, not in project files; save the owner recovery code yourself if you want to reopen the same session after closing the app.

## Development without Docker

From the repository's `source/` folder, install Node.js 22+, run `npm ci`, then `npm run collab:server`. It listens on `127.0.0.1:1234` by default. For network binding, set `HOST=0.0.0.0` and a random `COLLAB_CREATE_KEY` of at least 24 characters. Use `COLLAB_DATA_DIR` for persistent data and a reverse proxy for public HTTPS access.
