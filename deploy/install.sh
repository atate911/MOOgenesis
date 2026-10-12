#!/usr/bin/env bash
# One-time server setup for Master of Orion — Reborn (Debian/Ubuntu).
#   sudo CERT_EMAIL=you@example.com ./deploy/install.sh
# Idempotent: safe to re-run. Prerequisite: DNS A/AAAA record for moo.dhlab.us points at this server,
# ports 80 and 443 are open.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$HERE/config.sh"
need_root

command -v apt-get >/dev/null || die "this script targets Debian/Ubuntu (apt)."
log "Installing packages (nginx, certbot, git, rsync, curl)…"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq nginx certbot git rsync curl >/dev/null

mkdir -p "$APP_ROOT/releases" "$WEBROOT_ACME" /etc/moo

# --- first release (builds from this checkout if it is a git repo, else clones REPO_URL) ---
REPO_ROOT="$(cd "$HERE/.." && pwd)"
if [ -d "$REPO_ROOT/.git" ] && [ ! -e "$SRC_DIR" ]; then
  log "Linking source checkout $SRC_DIR -> $REPO_ROOT"
  ln -s "$REPO_ROOT" "$SRC_DIR"
fi
"$HERE/deploy.sh" --no-pull-if-missing

# --- nginx: HTTP bootstrap first, so certbot can validate the domain ---
SITE=/etc/nginx/sites-available/$DOMAIN
CERT=/etc/letsencrypt/live/$DOMAIN/fullchain.pem
if [ ! -f "$CERT" ]; then
  log "Installing HTTP bootstrap vhost…"
  install -m 644 "$HERE/nginx-http.conf" "$SITE"
  ln -sf "$SITE" /etc/nginx/sites-enabled/$DOMAIN
  rm -f /etc/nginx/sites-enabled/default
  nginx -t && systemctl reload nginx
  log "Requesting TLS certificate for $DOMAIN…"
  email_args=(--register-unsafely-without-email)
  [ -n "$CERT_EMAIL" ] && email_args=(-m "$CERT_EMAIL")
  certbot certonly --webroot -w "$WEBROOT_ACME" -d "$DOMAIN" --agree-tos --non-interactive "${email_args[@]}" \
    || die "certbot failed. Check that DNS for $DOMAIN points here and port 80 is reachable, then re-run."
fi

log "Installing HTTPS vhost…"
install -m 644 "$HERE/nginx.conf" "$SITE"
ln -sf "$SITE" /etc/nginx/sites-enabled/$DOMAIN
rm -f /etc/nginx/sites-enabled/default
nginx -t

# Reload nginx whenever certbot renews (the apt certbot package ships a systemd renewal timer).
install -d /etc/letsencrypt/renewal-hooks/deploy
cat > /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh <<'HOOK'
#!/bin/sh
systemctl reload nginx
HOOK
chmod 755 /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
systemctl enable --now nginx >/dev/null 2>&1 || true
systemctl enable --now certbot.timer >/dev/null 2>&1 || true
systemctl reload nginx

# --- daily health check (restarts nginx if down, warns if the cert is close to expiry) ---
install -d /usr/local/lib/moo
install -m 644 "$HERE/config.sh" /usr/local/lib/moo/config.sh
install -m 755 "$HERE/healthcheck.sh" /usr/local/sbin/moo-healthcheck
install -m 644 "$HERE/moo-healthcheck.service" /etc/systemd/system/moo-healthcheck.service
install -m 644 "$HERE/moo-healthcheck.timer"   /etc/systemd/system/moo-healthcheck.timer
systemctl daemon-reload
systemctl enable --now moo-healthcheck.timer >/dev/null

# --- firewall: open web ports if ufw is active ---
if command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then
  ufw allow 'Nginx Full' >/dev/null || true
fi

"$HERE/healthcheck.sh" || log "Health check reported problems (see above)."
log "Done. https://$DOMAIN/ should be live. Update later with: sudo $HERE/deploy.sh"
