#!/usr/bin/env bash
# Remove Master of Orion — Reborn from this server.
#   sudo bash /opt/moogenesis/scripts/uninstall.sh [--root DIR] [--yes] [--purge-cert]
# Removes the nginx or Caddy site, the save server unit and snippets, the doctor timer and the
# install root. Leaves nginx, certbot and any other sites alone. The save server's settings
# (/etc/moogenesis) and server saves (/var/lib/moogenesis) are kept (and in the final backup).
# The Let's Encrypt certificate is kept unless you pass --purge-cert. Takes a final backup into /root first.
set -euo pipefail
INSTALL_ROOT="/opt/moogenesis"; YES=false; PURGE=false
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; BOLD='\033[1m'; NC='\033[0m'
die()  { echo -e "\n${RED}✗ ERROR: $*${NC}\n" >&2; exit 1; }
info() { echo -e "   ${BLUE}→${NC} $*"; }
ok()   { echo -e "   ${GREEN}✓${NC} $*"; }
warn() { echo -e "   ${YELLOW}!${NC} $*"; }
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh" || { echo "FATAL: lib.sh not found next to $0" >&2; exit 1; }
while [[ $# -gt 0 ]]; do
    case "$1" in
        --root) INSTALL_ROOT="$2"; shift 2 ;;
        --yes) YES=true; shift ;;
        --purge-cert) PURGE=true; shift ;;
        -h|--help) echo "Usage: sudo bash $0 [--root ${INSTALL_ROOT}] [--yes] [--purge-cert]"; exit 0 ;;
        *) die "Unknown option: $1" ;;
    esac
done
[[ $EUID -eq 0 ]] || die "Run with sudo:  sudo bash $0"
[[ -d "$INSTALL_ROOT" ]] || die "${INSTALL_ROOT} does not exist."
DOMAIN="$(moo_conf_get "$INSTALL_ROOT" domain)"; DOMAIN="${DOMAIN:-$MOO_DEFAULT_DOMAIN}"

if ! $YES; then
    echo -e "${BOLD}This removes ${INSTALL_ROOT}, the nginx site '${MOO_SITE_NAME}', the save server and the doctor timer for ${DOMAIN}.${NC}"
    read -r -p "Type 'remove' to continue: " a; [[ "$a" == remove ]] || die "Aborted."
fi

if [[ -x "${INSTALL_ROOT}/scripts/backup.sh" ]]; then
    B=$(bash "${INSTALL_ROOT}/scripts/backup.sh" --root "$INSTALL_ROOT" --quiet 2>/dev/null || true)
    if [[ -n "$B" && -f "$B" ]]; then cp -a "$B" /root/ && ok "Final backup: /root/$(basename "$B")"; fi
fi

systemctl disable --now moogenesis-doctor.timer "$MOO_SAVES_UNIT" >/dev/null 2>&1 || true
rm -f /etc/systemd/system/moogenesis-doctor.{service,timer} "/etc/systemd/system/${MOO_SAVES_UNIT}"; systemctl daemon-reload 2>/dev/null || true
rm -f "/etc/nginx/sites-enabled/${MOO_SITE_NAME}.conf" "/etc/nginx/sites-available/${MOO_SITE_NAME}.conf" "$MOO_NGINX_SNIPPET"
if [[ -f "/etc/caddy/conf.d/${MOO_SITE_NAME}.caddy" ]]; then
    rm -f "/etc/caddy/conf.d/${MOO_SITE_NAME}.caddy" "$MOO_CADDY_SNIPPET"
    # The 'import /etc/caddy/conf.d/*.caddy' line install.sh added is harmless with no matches; left in place.
    command -v caddy >/dev/null && caddy validate --config "$(moo_caddyfile)" --adapter caddyfile >/dev/null 2>&1 && systemctl reload caddy 2>/dev/null || true
    ok "Removed the Caddy site"
fi
if command -v nginx >/dev/null && nginx -t >/dev/null 2>&1; then systemctl reload nginx 2>/dev/null || true; fi
ok "Removed the nginx site and timer"
rm -rf "$INSTALL_ROOT"; ok "Removed ${INSTALL_ROOT}"
info "Kept $(dirname "$MOO_SAVES_CONF") and ${MOO_SAVES_DATA} (server saves). Remove them with: sudo rm -rf $(dirname "$MOO_SAVES_CONF") ${MOO_SAVES_DATA}; sudo userdel ${MOO_SAVES_USER}"
if $PURGE && command -v certbot >/dev/null; then certbot delete --cert-name "$DOMAIN" --non-interactive >/dev/null 2>&1 && ok "Deleted the certificate for ${DOMAIN}" || warn "Could not delete the certificate"
else info "Certificate for ${DOMAIN} kept (pass --purge-cert to delete it)."; fi
