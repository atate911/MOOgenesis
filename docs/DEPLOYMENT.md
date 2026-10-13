# Deploying to a home Ubuntu server (moo.dhlab.us)

The game is **static files** — `index.html`, `css/`, `js/`. There is no backend,
database or service account. A web server serves a symlinked release directory
and provides HTTPS. `install.sh` picks the web server for you: **Caddy** if it
is already running on the machine (it owns ports 80/443, so nginx could not
start), otherwise **nginx + Let's Encrypt (certbot)**. Force one with `--web`. Player saves live in each player's browser
(localStorage), so the server holds nothing a player would miss.

```
/opt/moogenesis/
  releases/<v1.0.0-20261013-051219-a9a2741>/   one directory per deploy (newest 5 kept)
  current -> releases/...                      what nginx serves (flipped atomically)
  install.conf                                 domain, email, tls, checkout path
  scripts/  deploy/  VERSION  backups/
/etc/nginx/sites-available/moogenesis.conf     nginx mode: rendered once; certbot adds the 443 block
/etc/caddy/conf.d/moogenesis.caddy             caddy mode: one site block; Caddy handles TLS itself
```

## One-time network setup

1. **DNS** — an `A` record for `moo.dhlab.us` → your home's public IP. Home IPs
   change; if yours does, point the record at a dynamic-DNS name (or update it
   with your DNS host's API) instead.
2. **Router** — forward TCP **80** and **443** to the server's LAN IP. Port 80
   must stay open: Let's Encrypt renewals use it.
3. **Server** — Ubuntu 22.04/24.04 with sudo. IPv6 is optional; if the host has
   IPv6 disabled, nginx rejects `listen [::]:80` — delete that line from the
   installed site conf and `sudo nginx -t && sudo systemctl reload nginx`.

## Install

```bash
git clone https://github.com/atate911/MOOgenesis ~/MOOgenesis
cd ~/MOOgenesis
sudo bash scripts/install.sh --email you@example.com          # domain defaults to moo.dhlab.us
```

Try `--staging` first if you want to test certificate issuance without
Let's Encrypt rate limits, `--no-tls` for HTTP only, `--domain` for another name.
The installer: installs nginx/certbot/curl via apt, publishes a release, writes
the nginx site, opens ufw (if active), runs a health check, requests the
certificate (`certbot --nginx --redirect`), and enables a daily doctor timer.
It is idempotent and never overwrites a live nginx site conf.

### Caddy mode

If Caddy is already your front door, the installer writes
`/etc/caddy/conf.d/moogenesis.caddy`, appends `import /etc/caddy/conf.d/*.caddy`
to your Caddyfile (path read from the caddy unit, or `--caddyfile PATH`; a
timestamped `.pre-moogenesis.*` backup is made first), runs `caddy validate`,
and only then reloads Caddy. If validation fails it restores your Caddyfile and
changes nothing. Caddy requests and renews the certificate for the domain
itself — no certbot, no `--email` needed (set the ACME email in your Caddyfile's
global options if you want expiry notices). Your other sites are untouched.

## Upgrade

```bash
cd ~/MOOgenesis && sudo bash scripts/upgrade.sh --pull
# or, from anywhere:  sudo bash /opt/moogenesis/scripts/upgrade.sh --pull
```

`--pull` does `git pull --ff-only` in the checkout first (it refuses if the
checkout has local changes). The upgrade backs up, builds a new release, flips
`current`, and health-checks the live site; if the site is not serving the new
release it flips back by itself. Identical content is a no-op (`--force` to
redeploy). It never touches the nginx site conf, so certbot's edits survive.
Browsers revalidate files on every load (no-cache + ETag), so players get the
new version on their next page load.

## Everyday operations

| Task | Command |
| --- | --- |
| Health report | `sudo bash /opt/moogenesis/scripts/doctor.sh` |
| List / roll back releases | `sudo bash /opt/moogenesis/scripts/rollback.sh --list` · `… rollback.sh [RELEASE]` |
| Server-side backup | `sudo bash /opt/moogenesis/scripts/backup.sh` |
| Logs | `sudo tail -f /var/log/nginx/moogenesis.{access,error}.log` |
| Certificate renewal | automatic — Caddy renews by itself; nginx mode uses `certbot.timer` (test: `sudo certbot renew --dry-run`) |
| Remove everything | `sudo bash /opt/moogenesis/scripts/uninstall.sh` (`--purge-cert` also deletes the cert) |

`doctor.sh` exit codes: 0 all clear · 1 warnings · 2 broken. The
`moogenesis-doctor.timer` runs it daily at ~06:15; a broken result fails the
unit, visible in `systemctl --failed` and `journalctl -u moogenesis-doctor`.

## Backups and saves

`backup.sh` archives `install.conf`, the live release, the nginx site and the
Let's Encrypt account/renewal config (the deployable code is also in git).
**Player saves are not on the server**: they live in each browser. Players keep
a copy with the in-game save export; clearing site data or switching browsers
loses saves.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| `nginx` won't start / port 80 in use | Something else (often Caddy) owns 80/443: `sudo ss -ltnp \| grep -E ':(80\|443)\b'`. Use `--web caddy`. |
| Certificate step fails | DNS points at your public IP? Router forwards 80/443? `doctor.sh` prints both IPs. |
| Works on the LAN, not from outside | Router port forwards; ISP blocking 80/443 (some residential plans do). |
| Old files after an upgrade | `curl -I https://moo.dhlab.us/js/manifest.js` should show `Cache-Control: no-cache`; check a CDN/proxy in front isn't caching. |
| `nginx -t` fails | `sudo nginx -t` names the line; the site conf is `/etc/nginx/sites-available/moogenesis.conf`. |
| Blank page | Browser console (F12). `doctor.sh` verifies every file in `js/manifest.js` is present in the live release. |
