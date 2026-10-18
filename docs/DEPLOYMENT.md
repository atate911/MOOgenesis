# Deploying to a home Ubuntu server (moo.dhlab.us)

The game is **static files** — `index.html`, `css/`, `js/`, `assets/art/` and
`assets/races/` (the list is `MOO_DEPLOY_PATHS` in `scripts/lib.sh`), plus one
small service, the **save server** (`server/moo-saves.py`, Python 3 standard
library, no database): it asks for a password before the game loads and keeps
the server save slots. A web server (nginx or Caddy) serves a symlinked release
directory, asks the save server before serving each request, and provides HTTPS. `install.sh` picks the web server for you: **Caddy** if it
is already running on the machine (it owns ports 80/443, so nginx could not
start), otherwise **nginx + Let's Encrypt (certbot)**. Force one with `--web`. Players can save to the server (Save screen → Server)
or, as before, in their browser.

```
/opt/moogenesis/
  releases/<v1.0.1-20261013-051219-a9a2741>/   one directory per deploy (newest 5 kept, version-aware order)
  current -> releases/...                      what nginx / Caddy serves (flipped atomically)
  install.conf                                 domain, email, web, tls, checkout path
  server/moo-saves.py                          the save server (outside releases: a rollback leaves it alone)
  scripts/  deploy/  VERSION  backups/
/etc/moogenesis/moo.conf                       save server settings: password, listen, data_dir (written once, yours to edit)
/var/lib/moogenesis/                           server saves (saves/<slot>.save + .json) and the login-cookie key
/etc/systemd/system/moogenesis-saves.service   the save server (user moogenesis, 127.0.0.1:8766)
/etc/nginx/sites-available/moogenesis.conf     nginx mode: rendered once; certbot adds the 443 block
/etc/nginx/snippets/moogenesis-saves.conf      nginx mode: password gate + /api/, rewritten by the scripts on every run
/etc/caddy/conf.d/moogenesis.caddy             caddy mode: one site block; Caddy handles TLS itself
/etc/caddy/moogenesis-saves.caddyfile          caddy mode: password gate + /api/, rewritten by the scripts on every run
```

## Password and server saves

The password is the `password` line of `/etc/moogenesis/moo.conf`:

```bash
sudo nano /etc/moogenesis/moo.conf      # password = something-else    (or `password =` to turn the gate off)
```

No restart is needed: the save server re-reads the file when it changes, and a
new password signs everyone out (they get the password page on their next
request; the login lasts 30 days otherwise). It is a deterrent for casual
visitors, not real security: one shared password, no accounts or rate limits.
`/version.txt` and `/.well-known/` are never gated (health checks, certificate
renewal).

How it fits together: every request first goes to the save server's
`/api/auth` (nginx `auth_request`, Caddy `forward_auth`): it answers 204 (serve
the file) or 401 (show the password page instead). `/api/*` goes straight to the
save server, which checks the login cookie itself for the save slots. The scripts
own the snippet that wires this in; when the save server is not answering they
write it comment-only, so the game keeps loading (without the gate or server
saves) instead of failing every request. `doctor.sh` says which state you are in.

Server saves are opaque gzipped files, one per slot (6 slots shared by everyone
who knows the password). There is no versioning: a save from a much older build
may simply fail to load. A long game on a colossal map is about 50 KB.

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
It also creates the `moogenesis` system user, writes `/etc/moogenesis/moo.conf`
(first run only), installs and starts `moogenesis-saves.service`, and writes the
nginx/Caddy snippet for it. It is idempotent and never overwrites a live nginx
site conf (on a site from before server saves it adds the one `include` line
for the snippet, after each `root …/current;`, and puts the file back if
`nginx -t` fails). A re-run (for
example after fixing DNS so the certificate step can succeed) reads `--domain`,
`--email` and `--web` from `install.conf` when they are not given, keeps the
live release when the checkout is unchanged (`--force` builds a new one), and
leaves `tls=yes` alone once a certificate is installed — the health check
follows certbot's http→https redirect. certbot may be the snap or the apt
package; the installer only adds `python3-certbot-nginx` for the apt one.

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
release it flips back by itself. Identical game files are a no-op for the
release (`--force` to redeploy), but the operator scripts, deploy templates,
systemd units and `VERSION` are refreshed on every run — so a commit that only
touches those still lands. Running it from `/opt/moogenesis/scripts` is safe:
new scripts are renamed over the old ones, never written in place. Every run
also restarts the save server and rewrites its snippet (adding the `include`
line to an nginx site that lacks it; the Caddy site file is re-rendered). The
nginx site conf is otherwise left alone, so certbot's edits survive.

**First upgrade to a version with server saves:** an upgrade runs the script
that was installed *before* `--pull` fetched the new one, so the save server is
set up on the *next* run. Either run `upgrade.sh --pull` twice, or
`git pull` first and then `sudo bash scripts/upgrade.sh`.

Caching: each release stamps `window.MOO_BUILD = '<release>'` into its
`js/manifest.js` (and `M.VERSION` from `VERSION` into `js/core/ns.js`), and
`js/loader.js` appends `?v=<release>` to every css/js URL. The web server
sends `Cache-Control: public, max-age=31536000, immutable` only for URLs that
carry that `?v=`; `index.html`, `js/manifest.js`, `js/loader.js`, `version.txt`
and un-fingerprinted assets (world art) stay `no-cache` (ETag revalidation). A
new release therefore means new URLs: players get it on their next page load
and never mix old and new files. A plain checkout has no stamp and busts with a
timestamp, as before.

## Everyday operations

| Task | Command |
| --- | --- |
| Health report | `sudo bash /opt/moogenesis/scripts/doctor.sh` |
| List / roll back releases | `sudo bash /opt/moogenesis/scripts/rollback.sh --list` · `… rollback.sh [RELEASE]` |
| Server-side backup | `sudo bash /opt/moogenesis/scripts/backup.sh` |
| Logs | nginx: `sudo tail -f /var/log/nginx/moogenesis.{access,error}.log` · Caddy: `sudo journalctl -u caddy -f` · save server: `sudo journalctl -u moogenesis-saves -f` |
| Change the password | edit `password =` in `/etc/moogenesis/moo.conf` (blank = no password); takes effect at once |
| Save server | `sudo systemctl status moogenesis-saves` · slots: `ls /var/lib/moogenesis/saves` |
| Certificate renewal | automatic — Caddy renews by itself; nginx mode uses `certbot.timer` (test: `sudo certbot renew --dry-run`) |
| Remove everything | `sudo bash /opt/moogenesis/scripts/uninstall.sh` (`--purge-cert` also deletes the cert) |

`doctor.sh` exit codes: 0 all clear · 1 warnings · 2 broken. The
`moogenesis-doctor.timer` runs it daily at ~06:15; a broken result fails the
unit, visible in `systemctl --failed` and `journalctl -u moogenesis-doctor`.

## Backups and saves

`backup.sh` archives `install.conf`, `VERSION`, the `current` symlink (which
release was live), the nginx/Caddy site, the whole of `/etc/letsencrypt`
(accounts, renewal config, `live/` and `archive/` — so the certificate itself
can be restored; the archive is mode 600 because it holds private keys), the
save server settings (`/etc/moogenesis`) and the server saves with the
login-cookie key (`/var/lib/moogenesis`). The release tree is not included: it
is 20+ MB that git already holds, and `install.sh` rebuilds it.
Saves kept in a player's **browser** are not on the server: players keep a copy
with the in-game export; clearing site data or switching browsers loses those.
`uninstall.sh` removes the save server but keeps `/etc/moogenesis` and
`/var/lib/moogenesis` (it prints the command to delete them).

## Troubleshooting

| Symptom | Check |
| --- | --- |
| `nginx` won't start / port 80 in use | Something else (often Caddy) owns 80/443: `sudo ss -ltnp \| grep -E ':(80\|443)\b'`. Use `--web caddy`. |
| Certificate step fails | DNS points at your public IP? Router forwards 80/443? `doctor.sh` prints both IPs. |
| Works on the LAN, not from outside | Router port forwards; ISP blocking 80/443 (some residential plans do). |
| Old files after an upgrade | `curl -I https://moo.dhlab.us/js/manifest.js` should show `Cache-Control: no-cache` and its first line (`curl -s … \| head -1`) the live release; `curl -I 'https://moo.dhlab.us/js/loader.js?v=x'` must be `no-cache` too. Check a CDN/proxy in front isn't caching. |
| `doctor.sh` says "no build id" | The live release predates release stamping: `sudo bash /opt/moogenesis/scripts/upgrade.sh --force`. |
| `nginx -t` fails | `sudo nginx -t` names the line; the site conf is `/etc/nginx/sites-available/moogenesis.conf`. |
| Blank page | Browser console (F12). `doctor.sh` verifies every file in `js/manifest.js` is present in the live release. |
| Every page is a 500 error | The gate is wired in but the save server is down: `sudo systemctl restart moogenesis-saves`, `sudo journalctl -u moogenesis-saves -n 30`. If it will not start, `sudo bash /opt/moogenesis/scripts/upgrade.sh` writes the comment-only snippet so the game loads without it. |
| No password page / no Server toggle on the Save screen | `doctor.sh`: the save server is not running or its snippet is comment-only. Fix the service, then re-run `upgrade.sh`. A blank `password =` turns the page off on purpose. |
| Forgot the password | `sudo grep ^password /etc/moogenesis/moo.conf` |
