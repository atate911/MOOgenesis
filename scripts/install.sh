#!/usr/bin/env bash
# Install Master of Orion — Reborn on an Ubuntu/Debian server behind nginx.
#
# Run from the root of the git clone:
#   sudo bash scripts/install.sh [--domain moo.dhlab.us] [--email you@example.com]
#                                [--root /opt/moogenesis] [--no-tls] [--staging]
#                                [--no-healthwatch]
#
# Idempotent: re-running is safe. Never overwrites a live nginx site conf.
# The game is static files — no service user, no database. Player saves live
# in each player's browser, so there is nothing server-side to lose.
set -euo pipefail

INSTALL_ROOT="/opt/moogenesis"
DOMAIN="moo.dhlab.us"
EMAIL=""
WANT_TLS=true
CERT_STAGING=false
WANT_HEALTHWATCH=true
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
        --domain) DOMAIN="$2"; shift 2 ;;
        --email)  EMAIL="$2"; shift 2 ;;
        --root)   INSTALL_ROOT="$2"; shift 2 ;;
        --no-tls) WANT_TLS=false; shift ;;
        --staging) CERT_STAGING=true; shift ;;
        --no-healthwatch) WANT_HEALTHWATCH=false; shift ;;
        --no-nginx) SKIP_NGINX=true; WANT_TLS=false; WANT_HEALTHWATCH=false; shift ;;
        -h|--help)
            cat <<USAGE
Usage: sudo bash $0 [options]
  --domain NAME      public host name (default: ${DOMAIN})
  --email ADDR       Let's Encrypt contact (recommended; expiry notices go here)
  --root PATH        install root (default: ${INSTALL_ROOT})
  --no-tls           HTTP only — skip the Let's Encrypt certificate
  --staging          use the Let's Encrypt staging CA (test without rate limits)
  --no-healthwatch   don't install the daily doctor timer
USAGE
            exit 0 ;;
        *) die "Unknown option: $1  (use --help)" ;;
    esac
done

[[ $EUID -eq 0 ]] || die "Run with sudo:  sudo bash $0"
[[ -f "${REPO_DIR}/index.html" && -f "${REPO_DIR}/js/manifest.js" ]] \
    || die "Run this from a MOOgenesis checkout (index.html / js/manifest.js not found in ${REPO_DIR})."
[[ "$DOMAIN" =~ ^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?$ ]] || die "Not a valid host name: ${DOMAIN}"

VERSION=$(tr -d '[:space:]' < "${REPO_DIR}/VERSION" 2>/dev/null || echo "?")
echo -e "\n${BOLD}╔══════════════════════════════════════════════════╗"
echo    "║   Master of Orion — Reborn — Installer           ║"
echo -e "╚══════════════════════════════════════════════════╝${NC}"
echo    "   Repo    : ${REPO_DIR}  (v${VERSION})"
echo    "   Target  : ${INSTALL_ROOT}"
echo    "   Domain  : ${DOMAIN}"
echo    "   TLS     : $($WANT_TLS && echo "Let's Encrypt" || echo "off")"

if ! $SKIP_NGINX; then
    step "Checking prerequisites"
    command -v apt-get >/dev/null || die "apt-get not found — this installer targets Ubuntu/Debian."
    NEED=()
    command -v nginx   >/dev/null || NEED+=(nginx)
    command -v curl    >/dev/null || NEED+=(curl)
    command -v certbot >/dev/null || { $WANT_TLS && NEED+=(certbot python3-certbot-nginx); }
    if $WANT_TLS && ! dpkg -s python3-certbot-nginx >/dev/null 2>&1; then
        [[ " ${NEED[*]} " == *" python3-certbot-nginx "* ]] || NEED+=(python3-certbot-nginx)
    fi
    if [[ ${#NEED[@]} -gt 0 ]]; then
        info "Installing: ${NEED[*]}"
        DEBIAN_FRONTEND=noninteractive apt-get update -qq
        DEBIAN_FRONTEND=noninteractive apt-get install -y -qq "${NEED[@]}"
    fi
    ok "nginx, curl$($WANT_TLS && echo ', certbot') present"
fi

step "Directory tree"
mkdir -p "${INSTALL_ROOT}/releases" "${INSTALL_ROOT}/backups" "${INSTALL_ROOT}/scripts"
ok "${INSTALL_ROOT}/{releases,backups,scripts}"

step "Publishing the game"
REL=$(moo_make_release "${REPO_DIR}" "${INSTALL_ROOT}") || die "Could not build a release from ${REPO_DIR}."
PREV=$(moo_current "${INSTALL_ROOT}" || true)
moo_switch "${INSTALL_ROOT}" "$REL"
moo_prune "${INSTALL_ROOT}"
ok "Release ${REL} is live  (previous: ${PREV:-none})"

info "Installing operator scripts ..."
cp "${REPO_DIR}/scripts/"*.sh "${INSTALL_ROOT}/scripts/"
chmod 755 "${INSTALL_ROOT}/scripts/"*.sh
mkdir -p "${INSTALL_ROOT}/deploy/nginx"
cp "${REPO_DIR}/deploy/nginx/moogenesis.conf.template" "${INSTALL_ROOT}/deploy/nginx/"
cp "${REPO_DIR}/VERSION" "${INSTALL_ROOT}/VERSION"

moo_conf_set "${INSTALL_ROOT}" domain "$DOMAIN"
[[ -n "$EMAIL" ]] && moo_conf_set "${INSTALL_ROOT}" email "$EMAIL"
moo_conf_set "${INSTALL_ROOT}" repo "$REPO_DIR"
moo_conf_set "${INSTALL_ROOT}" tls "no"

if $SKIP_NGINX; then
    ok "Skipped nginx (--no-nginx)."
    exit 0
fi

step "nginx site"
SITE_AVAIL="/etc/nginx/sites-available/${MOO_SITE_NAME}.conf"
SITE_ENABLED="/etc/nginx/sites-enabled/${MOO_SITE_NAME}.conf"
if [[ -f "$SITE_AVAIL" ]]; then
    ok "Site conf already present — leaving it alone (certbot may have edited it)"
    if ! diff -q <(moo_render_nginx "${REPO_DIR}/deploy/nginx/moogenesis.conf.template" "$DOMAIN" "$INSTALL_ROOT") "$SITE_AVAIL" >/dev/null 2>&1; then
        info "It differs from the template (normal after certbot). To regenerate from scratch:"
        echo "        sudo rm ${SITE_AVAIL} ${SITE_ENABLED} && sudo bash ${REPO_DIR}/scripts/install.sh --domain ${DOMAIN}"
    fi
else
    moo_render_nginx "${REPO_DIR}/deploy/nginx/moogenesis.conf.template" "$DOMAIN" "$INSTALL_ROOT" > "$SITE_AVAIL"
    ok "Wrote ${SITE_AVAIL}"
fi
ln -sfn "$SITE_AVAIL" "$SITE_ENABLED"
nginx -t 2>&1 | sed 's/^/        /' || die "nginx config test failed — see above. Nothing was reloaded."
systemctl enable nginx >/dev/null 2>&1 || true
systemctl reload nginx 2>/dev/null || systemctl restart nginx
ok "nginx reloaded"

if command -v ufw >/dev/null && ufw status 2>/dev/null | grep -q "Status: active"; then
    ufw allow 'Nginx Full' >/dev/null 2>&1 && ok "ufw: allowed Nginx Full (80/443)" \
        || warn "ufw is active — allow ports 80 and 443 yourself"
fi

step "Health check (plain HTTP)"
HEALTHY=false
for i in 1 2 3; do
    if moo_health "${INSTALL_ROOT}" "$DOMAIN" "$REL"; then HEALTHY=true; break; fi
    [[ $i -lt 3 ]] && { info "Waiting for nginx ..."; sleep 2; }
done
$HEALTHY && ok "Serving ${REL} on http://${DOMAIN}/" \
         || die "nginx is not serving the new release. See: sudo tail /var/log/nginx/moogenesis.error.log"

TLS_NOTE=""
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
        warn "Certificate request failed — the site is up over plain HTTP."
        echo "     Usual causes: DNS not pointing here yet, or router port 80/443 not forwarded."
        echo "     Fix, then re-run:  sudo bash ${REPO_DIR}/scripts/install.sh --domain ${DOMAIN} --email you@example.com"
    fi
fi

if $WANT_HEALTHWATCH; then
    step "Daily health check"
    for u in moogenesis-doctor.service moogenesis-doctor.timer; do
        sed "s|/opt/moogenesis|${INSTALL_ROOT}|g" "${REPO_DIR}/systemd/${u}" > "/etc/systemd/system/${u}"
    done
    systemctl daemon-reload
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
echo    "   Health    : sudo bash ${INSTALL_ROOT}/scripts/doctor.sh"
echo    "   Upgrade   : cd ${REPO_DIR} && sudo bash scripts/upgrade.sh --pull"
echo    "   Rollback  : sudo bash ${INSTALL_ROOT}/scripts/rollback.sh"
echo    "   Backup    : sudo bash ${INSTALL_ROOT}/scripts/backup.sh"
echo    "   Uninstall : sudo bash ${INSTALL_ROOT}/scripts/uninstall.sh"
echo
echo    "   Home network checklist (docs/DEPLOYMENT.md has the details):"
echo    "     • DNS: an A record for ${DOMAIN} → your home's public IP (or a DDNS name)"
echo    "     • Router: forward TCP 80 and 443 to this server's LAN IP"
echo    "     • Saves are stored in each player's browser, not on this server"
echo
