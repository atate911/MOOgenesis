# Hosting on moo.dhlab.us

The game is a **static site** (no backend, no build step, no database). Player saves and settings live in each
browser's `localStorage`, so the server holds nothing worth backing up beyond the git repo.

Target: Debian/Ubuntu with systemd, nginx + Let's Encrypt (certbot).

## First-time setup
1. DNS: create `A` (and `AAAA`) records for `moo.dhlab.us` pointing at the server; open ports 80 and 443.
2. On the server:
   ```
   git clone https://github.com/atate911/MOOgenesis.git && cd MOOgenesis
   git checkout main            # or whichever branch you want live
   sudo CERT_EMAIL=you@dhlab.us ./deploy/install.sh
   ```
   `install.sh` installs nginx/certbot/git/rsync, builds the first release, gets a TLS certificate, installs the
   vhost (`nginx.conf`), enables certificate auto-renewal and a daily health check. Re-running it is safe.

## Everyday maintenance
| Task | Command |
|---|---|
| Deploy latest `main` | `sudo ./deploy/deploy.sh` (runs `tools/check.js` first if node is installed) |
| Deploy current checkout as-is | `sudo ./deploy/deploy.sh --no-pull` |
| Deploy a tag/commit | `sudo ./deploy/deploy.sh --ref v1.2` |
| Roll back | `sudo ./deploy/rollback.sh` (previous release) or `rollback.sh <release-id>` |
| Health check | `sudo moo-healthcheck` (also runs daily via `moo-healthcheck.timer`) |
| Renew cert now | `sudo certbot renew` (nginx reloads automatically; `certbot.timer` does this twice daily) |
| Logs | `/var/log/nginx/moo.access.log`, `moo.error.log` (rotated by the stock nginx logrotate) |

## How it works
* Releases are copied to `/srv/moo/releases/<timestamp>-<sha>/` (only `index.html`, `css/`, `js/`), and
  `/srv/moo/current` is swapped atomically, so updates never serve a half-written site. The newest 5 are kept.
* Each release stamps its id into `index.html` (`<meta name="moo-build">`); `js/loader.js` appends it to every asset URL.
  nginx caches assets for a year (`immutable`) and always revalidates `index.html`, so a deploy reaches players
  immediately. In development the meta says `dev` and the loader cache-busts on every load, as before.
* The CSP in `nginx.conf` allows only same-origin scripts, `blob:` workers (the game's AI/combat worker pool) and
  Google Fonts (optional — the game falls back to system fonts). If you add a new external resource, update the CSP.
* Override defaults (domain, repo, branch, paths) with env vars or `/etc/moo/deploy.env` — see `config.sh`.

## Notes
* Because saves are per-browser, moving to the new server starts every player with empty slots (a different origin
  has a different `localStorage`). Export/import of saves, if wanted, would be a game feature.
* Not covered: a CDN or self-hosted fonts. To drop the Google Fonts dependency, download the three families into
  `css/fonts/`, replace the `<link>` in `index.html`, and tighten `style-src`/`font-src` in `nginx.conf`.
