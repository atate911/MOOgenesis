#!/usr/bin/env bash
# Install Master of Orion — Reborn on an Ubuntu/Debian server behind nginx.
#
# Run from the root of the git clone:
#   sudo bash scripts/install.sh [--domain moo.dhlab.us] [--email you@example.com]
#                                [--root /opt/moogenesis] [--no-tls] [--staging]
#                                [--no-healthwatch]
#
# Idempotent: re-running is safe. Never overwrites a live nginx site conf.
# A re-run reads domain / email / web from the existing install.conf (flags
# still win), reuses the live release when the checkout is unchanged, and
# keeps tls=yes once a certificate is in place.
# The game is static files plus one small service: server/moo-saves.py (user
# moogenesis, unit moogenesis-saves) asks for a password before the game loads
# and keeps the server save slots in /var/lib/moogenesis. Its settings are in
# /etc/moogenesis/moo.conf (default password: moopassword; blank turns it off),
# written once and never overwritten. Browser saves still work as before.
set -euo pipefail

INSTALL_ROOT="/opt/moogenesis"
DOMAIN="moo.dhlab.us"
EMAIL=""
ARG_DOMAIN=""; ARG_EMAIL=""; ARG_WEB=""
WANT_TLS=true
CERT_STAGING=false
WANT_HEALTHWATCH=true
FORCE=false
WEB="auto"                # auto | nginx | caddy
CADDYFILE=""
SKIP_NGINX=false          # test hook: deploy the release only (no apt/nginx/certbot)
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; BOLD='\033[1m'; NC='\033[0m'
die()  { echo -e "\n${RED}✗ ERROR: $*${NC}\n" >&2; exit 1; }
step() { echo -e "\n${BOLD}▶  $*${NC}"; }
info() { echo -e "   ${BLUE}→${NC} $*"; }
ok()   { echo -e "   ${GREEN}✓${NC} $*"; }
warn() { echo -e "   ${YELLOW}!${NC} $*"; }

. "$(dirname "${BASH_SOURCE[0]}")/lib.sh" \
    || { echo "FATAL: lib.sh not found next to $0" >&2; exit 1; }

while [[ $# -gt 0 ]]; do
    case "$1" in
        --domain) ARG_DOMAIN="$2"; shift 2 ;;
        --email)  ARG_EMAIL="$2"; shift 2 ;;
        --root)   INSTALL_ROOT="$2"; shift 2 ;;
        --web)    ARG_WEB="$2"; shift 2 ;;
        --caddyfile) CADDYFILE="$2"; shift 2 ;;
        --no-tls) WANT_TLS=false; shift ;;
        --staging) CERT_STAGING=true; shift ;;
        --no-healthwatch) WANT_HEALTHWATCH=false; shift ;;
        --force)  FORCE=true; shift ;;
        --no-nginx) SKIP_NGINX=true; WANT_TLS=false; WANT_HEALTHWATCH=false; shift ;;
        -h|--help)
            cat <<USAGE
Usage: sudo bash $0 [options]
  --domain NAME      public host name (default: ${DOMAIN}, or the one in install.conf on a re-run)
  --email ADDR       Let's Encrypt contact (recommended; expiry notices go here)
  --root PATH        install root (default: ${INSTALL_ROOT})
  --web nginx|caddy  which web server to configure (default: auto — Caddy if it is
                     already running on this machine, otherwise nginx)
  --caddyfile PATH   Caddyfile to extend in caddy mode (default: read from the caddy unit)
  --no-tls           nginx mode only: HTTP only — skip the Let's Encrypt certificate (Caddy always uses HTTPS)
  --staging          use the Let's Encrypt staging CA (test without rate limits)
  --no-healthwatch   don't install the daily doctor timer
  --force            build a new release even when the live one matches the checkout
USAGE
            exit 0 ;;
        *) die "Unknown option: $1  (use --help)" ;;
    esac
done

# A re-run keeps what the first run was told, unless a flag says otherwise.
CONF_DOMAIN="$(moo_conf_get "$INSTALL_ROOT" domain)"
CONF_EMAIL="$(moo_conf_get "$INSTALL_ROOT" email)"
CONF_WEB="$(moo_conf_get "$INSTALL_ROOT" web)"
DOMAIN="${ARG_DOMAIN:-${CONF_DOMAIN:-$DOMAIN}}"
EMAIL="${ARG_EMAIL:-$CONF_EMAIL}"
if [[ -n "$ARG_WEB" ]]; then WEB="$ARG_WEB"; elif [[ "$CONF_WEB" =~ ^(nginx|caddy)$ ]]; then WEB="$CONF_WEB"; fi

[[ $EUID -eq 0 ]] || die "Run with sudo:  sudo bash $0"
[[ -f "${REPO_DIR}/index.html" && -f "${REPO_DIR}/js/manifest.js" ]] \
    || die "Run this from a MOOgenesis checkout (index.html / js/manifest.js not found in ${REPO_DIR})."
[[ "$DOMAIN" =~ ^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?$ ]] || die "Not a valid host name: ${DOMAIN}"

[[ "$WEB" =~ ^(auto|nginx|caddy)$ ]] || die "--web must be auto, nginx or caddy"
if [[ "$WEB" == auto ]]; then $SKIP_NGINX && WEB=nginx || WEB="$(moo_detect_web)"; fi
[[ "$WEB" == caddy ]] && WANT_TLS=true

VERSION=$(tr -d '[:space:]' < "${REPO_DIR}/VERSION" 2>/dev/null || echo "?")
echo -e "\n${BOLD}╔══════════════════════════════════════════════════╗"
echo    "║   Master of Orion — Reborn — Installer           ║"
echo -e "╚══════════════════════════════════════════════════╝${NC}"
echo    "   Repo    : ${REPO_DIR}  (v${VERSION})"
echo    "   Target  : ${INSTALL_ROOT}"
echo    "   Domain  : ${DOMAIN}$([[ -z "$ARG_DOMAIN" && -n "$CONF_DOMAIN" ]] && echo '  (from install.conf)')"
echo    "   Web     : ${WEB}"
echo    "   TLS     : $([[ $WEB == caddy ]] && echo "automatic (Caddy)" || { $WANT_TLS && echo "Let's Encrypt" || echo off; })"

if ! $SKIP_NGINX; then
    step "Checking prerequisites"
    command -v apt-get >/dev/null || die "apt-get not found — this installer targets Ubuntu/Debian."
    NEED=()
    command -v curl    >/dev/null || NEED+=(curl)
    if [[ "$WEB" == caddy ]]; then
        command -v caddy >/dev/null || die "--web caddy was requested but caddy is not installed."
    else
        command -v nginx   >/dev/null || NEED+=(nginx)
        if $WANT_TLS; then
            # Three ways certbot shows up: absent (install the apt pair), the snap
            # (it bundles the nginx plugin; the apt python3-certbot-nginx cannot be
            # loaded by it), or the apt package (needs the plugin package).
            CERTBOT_BIN="$(command -v certbot || true)"
            if [[ -z "$CERTBOT_BIN" ]]; then
                NEED+=(certbot python3-certbot-nginx)
            elif [[ "$CERTBOT_BIN" == /snap/bin/* || "$(readlink -f "$CERTBOT_BIN" 2>/dev/null)" == */snap* ]]; then
                info "certbot is the snap (${CERTBOT_BIN}); its nginx plugin is built in"
            elif ! dpkg -s python3-certbot-nginx >/dev/null 2>&1; then
                NEED+=(python3-certbot-nginx)
            fi
        fi
    fi
    if [[ ${#NEED[@]} -gt 0 ]]; then
        info "Installing: ${NEED[*]}"
        DEBIAN_FRONTEND=noninteractive apt-get update -qq
        DEBIAN_FRONTEND=noninteractive apt-get install -y -qq "${NEED[@]}"
    fi
    if [[ "$WEB" == nginx ]] && $WANT_TLS && ! certbot plugins --non-interactive 2>/dev/null | grep -qi nginx; then
        warn "certbot cannot load its nginx plugin — the certificate step will fail."
        warn "snap certbot: sudo snap install --classic certbot · apt certbot: sudo apt install python3-certbot-nginx"
    fi
    ok "${WEB}, curl$([[ $WEB == nginx ]] && $WANT_TLS && echo ', certbot') present"
fi

step "Directory tree"
mkdir -p "${INSTALL_ROOT}/releases" "${INSTALL_ROOT}/backups" "${INSTALL_ROOT}/scripts"
ok "${INSTALL_ROOT}/{releases,backups,scripts}"

step "Publishing the game"
PREV=$(moo_current "${INSTALL_ROOT}" || true)
REL=""
if [[ -n "$PREV" && "$FORCE" != true && -d "${INSTALL_ROOT}/releases/${PREV}" ]] \
   && [[ "$(moo_release_hash "${INSTALL_ROOT}/releases/${PREV}")" == "$(moo_tree_hash "${REPO_DIR}")" ]]; then
    REL="$PREV"
    ok "Release ${REL} already matches the checkout — keeping it (--force builds a new one)"
else
    REL=$(moo_make_release "${REPO_DIR}" "${INSTALL_ROOT}") || die "Could not build a release from ${REPO_DIR}."
    moo_switch "${INSTALL_ROOT}" "$REL"
    moo_prune "${INSTALL_ROOT}"
    ok "Release ${REL} is live  (previous: ${PREV:-none})"
fi

info "Installing operator scripts ..."
moo_install_scripts "${REPO_DIR}" "${INSTALL_ROOT}"

moo_conf_set "${INSTALL_ROOT}" domain "$DOMAIN"
[[ -n "$EMAIL" ]] && moo_conf_set "${INSTALL_ROOT}" email "$EMAIL"
moo_conf_set "${INSTALL_ROOT}" repo "$REPO_DIR"
# tls is set to "no" only on a fresh install; once certbot/Caddy has turned it
# on, a re-run must not flip it back (doctor.sh and upgrade.sh probe https then).
moo_conf_has "${INSTALL_ROOT}" tls || moo_conf_set "${INSTALL_ROOT}" tls "no"
moo_conf_set "${INSTALL_ROOT}" web "$WEB"

if $SKIP_NGINX; then
    ok "Skipped nginx (--no-nginx)."
    exit 0
fi

step "Save server and password gate"
SAVES_ON=no
if moo_saves_service "${REPO_DIR}" "${INSTALL_ROOT}"; then
    SAVES_ON=yes
    ok "${MOO_SAVES_UNIT} is answering on $(moo_saves_listen)"
else
    warn "Continuing without it: the game loads with no password and browser saves only. Fix it, then re-run this installer."
fi
moo_saves_snippet "${REPO_DIR}" "$WEB" "$SAVES_ON"

TLS_NOTE=""
if [[ "$WEB" == caddy ]]; then
    step "Caddy site"
    SNIPPET_DIR="/etc/caddy/conf.d"; SNIPPET="${SNIPPET_DIR}/moogenesis.caddy"
    [[ -n "$CADDYFILE" ]] || CADDYFILE="$(moo_caddyfile)"
    [[ -f "$CADDYFILE" ]] || die "Caddyfile not found at ${CADDYFILE} — pass --caddyfile PATH."
    mkdir -p "$SNIPPET_DIR"
    moo_render_nginx "${REPO_DIR}/deploy/caddy/moogenesis.caddy.template" "$DOMAIN" "$INSTALL_ROOT" > "$SNIPPET"
    chmod 644 "$SNIPPET"
    ok "Wrote ${SNIPPET}"
    BACKUP_CF=""
    if ! grep -Eq '^[[:space:]]*import[[:space:]]+/etc/caddy/conf\.d/' "$CADDYFILE"; then
        BACKUP_CF="${CADDYFILE}.pre-moogenesis.$(date +%Y%m%d%H%M%S)"
        cp -a "$CADDYFILE" "$BACKUP_CF"
        printf '\n# Master of Orion — Reborn (added by moogenesis install.sh)\nimport /etc/caddy/conf.d/*.caddy\n' >> "$CADDYFILE"
        ok "Added 'import /etc/caddy/conf.d/*.caddy' to ${CADDYFILE}  (backup: ${BACKUP_CF})"
    else
        ok "${CADDYFILE} already imports /etc/caddy/conf.d/"
    fi
    if ! VOUT=$(caddy validate --config "$CADDYFILE" --adapter caddyfile 2>&1); then
        echo "$VOUT" | tail -8 | sed 's/^/        /'
        if [[ -n "$BACKUP_CF" ]]; then cp -a "$BACKUP_CF" "$CADDYFILE"; warn "Restored your Caddyfile from ${BACKUP_CF}"; fi
        rm -f "$SNIPPET"
        die "Caddy rejected the configuration (see above). Nothing was changed; your Caddy is untouched."
    fi
    ok "caddy validate: configuration is valid"
    systemctl reload caddy || die "Could not reload Caddy — see: sudo journalctl -u caddy -n 30"
    ok "Caddy reloaded (it requests the certificate for ${DOMAIN} on first use)"

    step "Health check (https — the first request may wait for the certificate)"
    moo_conf_set "${INSTALL_ROOT}" tls "yes"
    HEALTHY=false
    for i in $(seq 1 18); do
        if moo_health "${INSTALL_ROOT}" "$DOMAIN" "$REL"; then HEALTHY=true; break; fi
        [[ $i -lt 18 ]] && { info "Waiting for Caddy / the certificate ... (${i}/18)"; sleep 5; }
    done
    if $HEALTHY; then ok "Serving ${REL} on https://${DOMAIN}/"
    else
        warn "Caddy is configured but ${DOMAIN} is not answering over HTTPS yet."
        echo "     Certificate issuance needs DNS for ${DOMAIN} → this server's public IP, and ports 80/443 forwarded."
        echo "     Watch it:  sudo journalctl -u caddy -f      Re-check:  sudo bash ${INSTALL_ROOT}/scripts/doctor.sh"
    fi
    TLS_NOTE="https"
else
step "nginx site"
SITE_AVAIL="/etc/nginx/sites-available/${MOO_SITE_NAME}.conf"
SITE_ENABLED="/etc/nginx/sites-enabled/${MOO_SITE_NAME}.conf"
SITE_BAK=""
if [[ -f "$SITE_AVAIL" ]]; then
    ok "Site conf already present — leaving it alone (certbot may have edited it)"
    SITE_BAK=$(mktemp); cp -a "$SITE_AVAIL" "$SITE_BAK"
    [[ "$(moo_nginx_include "$SITE_AVAIL")" == added ]] && ok "Added 'include ${MOO_NGINX_SNIPPET};' to it (save server / password gate)"
    if ! diff -q <(moo_render_nginx "${REPO_DIR}/deploy/nginx/moogenesis.conf.template" "$DOMAIN" "$INSTALL_ROOT") "$SITE_AVAIL" >/dev/null 2>&1; then
        info "It differs from the template (normal after certbot). To regenerate from scratch:"
        echo "        sudo rm ${SITE_AVAIL} ${SITE_ENABLED} && sudo bash ${REPO_DIR}/scripts/install.sh --domain ${DOMAIN}"
    fi
else
    moo_render_nginx "${REPO_DIR}/deploy/nginx/moogenesis.conf.template" "$DOMAIN" "$INSTALL_ROOT" > "$SITE_AVAIL"
    ok "Wrote ${SITE_AVAIL}"
fi
ln -sfn "$SITE_AVAIL" "$SITE_ENABLED"
if ! nginx -t 2>&1 | sed 's/^/        /'; then
    [[ -n "$SITE_BAK" ]] && cp -a "$SITE_BAK" "$SITE_AVAIL" && warn "Put ${SITE_AVAIL} back as it was"
    die "nginx config test failed — see above. Nothing was reloaded."
fi
[[ -z "$SITE_BAK" ]] || rm -f "$SITE_BAK"
systemctl enable nginx >/dev/null 2>&1 || true
if ! { systemctl reload nginx 2>/dev/null || systemctl restart nginx; }; then
    echo
    warn "nginx would not start. The usual cause is another program already listening on port 80/443:"
    ss -ltnp 2>/dev/null | grep -E ':(80|443)\b' | sed 's/^/        /' || true
    warn "Last nginx log lines:"
    journalctl -u nginx -n 12 --no-pager 2>/dev/null | sed 's/^/        /' || true
    die "nginx failed to start — fix the cause above, then re-run this installer (it is safe to re-run)."
fi
ok "nginx reloaded"

if command -v ufw >/dev/null && ufw status 2>/dev/null | grep -q "Status: active"; then
    ufw allow 'Nginx Full' >/dev/null 2>&1 && ok "ufw: allowed Nginx Full (80/443)" \
        || warn "ufw is active — allow ports 80 and 443 yourself"
fi

# A certificate certbot installed on an earlier run means the site already
# answers https (and redirects http) — record that before probing it.
if [[ "$(moo_conf_get "${INSTALL_ROOT}" tls)" != yes && "$(moo_tls_live "${INSTALL_ROOT}" "$DOMAIN")" == yes ]]; then
    moo_conf_set "${INSTALL_ROOT}" tls "yes"
    info "A certificate for ${DOMAIN} is already installed — TLS marked on"
fi
PROBE=http; [[ "$(moo_tls_live "${INSTALL_ROOT}" "$DOMAIN")" == yes ]] && PROBE=https
step "Health check (${PROBE})"
HEALTHY=false
for i in 1 2 3; do
    if moo_health "${INSTALL_ROOT}" "$DOMAIN" "$REL"; then HEALTHY=true; break; fi
    [[ $i -lt 3 ]] && { info "Waiting for nginx ..."; sleep 2; }
done
$HEALTHY && ok "Serving ${REL} on ${PROBE}://${DOMAIN}/" \
         || die "nginx is not serving the new release. See: sudo tail /var/log/nginx/moogenesis.error.log"

if $WANT_TLS; then
    step "TLS certificate (Let's Encrypt)"
    PUB_IP=$(curl -fsS --max-time 8 https://api.ipify.org 2>/dev/null || true)
    DNS_IP=$(getent ahostsv4 "$DOMAIN" 2>/dev/null | awk '{print $1; exit}' || true)
    info "This server's public IP: ${PUB_IP:-unknown}   ${DOMAIN} resolves to: ${DNS_IP:-nothing}"
    if [[ -n "$PUB_IP" && -n "$DNS_IP" && "$PUB_IP" != "$DNS_IP" ]]; then
        warn "DNS for ${DOMAIN} does not point at this server's public IP."
        warn "Let's Encrypt must reach http://${DOMAIN}/ on port 80 from the internet."
    fi
    CB=(certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --redirect)
    if [[ -n "$EMAIL" ]]; then CB+=(-m "$EMAIL"); else CB+=(--register-unsafely-without-email); fi
    $CERT_STAGING && CB+=(--staging)
    if "${CB[@]}"; then
        moo_conf_set "${INSTALL_ROOT}" tls "yes"
        ok "Certificate issued; nginx now serves https://${DOMAIN}/ and redirects http to it"
        systemctl list-timers 2>/dev/null | grep -q certbot \
            && ok "Renewal is automatic (certbot.timer)" \
            || warn "No certbot timer found — renew with: sudo certbot renew"
        TLS_NOTE="https"
    else
        if [[ "$(moo_conf_get "${INSTALL_ROOT}" tls)" == yes ]]; then
            warn "certbot failed, but a certificate is already installed — the site stays on https."
            TLS_NOTE="https"
        else
            warn "Certificate request failed — the site is up over plain HTTP."
            echo "     Usual causes: DNS not pointing here yet, or router port 80/443 not forwarded."
            echo "     Fix, then re-run:  sudo bash ${REPO_DIR}/scripts/install.sh --domain ${DOMAIN} --email you@example.com"
        fi
    fi
elif [[ "$(moo_conf_get "${INSTALL_ROOT}" tls)" == yes ]]; then
    info "--no-tls given, but a certificate is already installed — leaving https on (tls=yes)"
    TLS_NOTE="https"
fi

fi   # nginx / caddy

if $WANT_HEALTHWATCH; then
    step "Daily health check"
    CHANGED=$(moo_refresh_units "${REPO_DIR}" "${INSTALL_ROOT}" install) || die "Could not write the systemd units."
    [[ -z "$CHANGED" ]] || systemctl daemon-reload
    systemctl enable --now moogenesis-doctor.timer >/dev/null 2>&1 \
        && ok "moogenesis-doctor.timer enabled (runs doctor.sh daily; a failing run shows in 'systemctl --failed')" \
        || warn "Could not enable moogenesis-doctor.timer"
fi

SCHEME=http; [[ -n "$TLS_NOTE" ]] && SCHEME=https
echo
echo -e "${GREEN}${BOLD}╔══════════════════════════════════════════════════╗"
printf  "║   MOO Reborn v%-34s║\n" "${VERSION} installed!"
echo -e "╚══════════════════════════════════════════════════╝${NC}"
echo
echo    "   Play      : ${SCHEME}://${DOMAIN}/"
if [[ "$SAVES_ON" == yes ]]; then
    case "$(moo_saves_gate)" in
        default) echo "   Password  : moopassword (the default; change it in ${MOO_SAVES_CONF}, blank turns it off)" ;;
        custom)  echo "   Password  : as set in ${MOO_SAVES_CONF}" ;;
        off)     echo "   Password  : off (blank in ${MOO_SAVES_CONF})" ;;
    esac
else
    echo "   Password  : off (the save server is not running: sudo journalctl -u ${MOO_SAVES_UNIT} -n 30)"
fi
echo    "   Health    : sudo bash ${INSTALL_ROOT}/scripts/doctor.sh"
echo    "   Upgrade   : cd ${REPO_DIR} && sudo bash scripts/upgrade.sh --pull"
echo    "   Rollback  : sudo bash ${INSTALL_ROOT}/scripts/rollback.sh"
echo    "   Backup    : sudo bash ${INSTALL_ROOT}/scripts/backup.sh"
echo    "   Uninstall : sudo bash ${INSTALL_ROOT}/scripts/uninstall.sh"
echo
echo    "   Home network checklist (docs/DEPLOYMENT.md has the details):"
echo    "     • DNS: an A record for ${DOMAIN} → your home's public IP (or a DDNS name)"
echo    "     • Router: forward TCP 80 and 443 to this server's LAN IP"
echo    "     • Server saves are in ${MOO_SAVES_DATA}/saves (backup.sh includes them); browser saves stay in each browser"
echo
