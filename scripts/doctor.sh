#!/usr/bin/env bash
# Health report for the published game. Read-only; safe during an outage.
#   sudo bash /opt/moogenesis/scripts/doctor.sh [--root DIR] [--quiet]
# Exit: 0 all clear · 1 warnings · 2 broken.
set -uo pipefail

INSTALL_ROOT="/opt/moogenesis"; QUIET=false
while [[ $# -gt 0 ]]; do
    case "$1" in
        --root) INSTALL_ROOT="$2"; shift 2 ;;
        --quiet) QUIET=true; shift ;;
        -h|--help) echo "Usage: sudo bash $0 [--root ${INSTALL_ROOT}] [--quiet]"; exit 0 ;;
        *) echo "Unknown option: $1" >&2; exit 2 ;;
    esac
done
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh" || { echo "FATAL: lib.sh not found next to $0" >&2; exit 1; }

BAD=0; WARN=0
pass() { $QUIET || echo "  [ ok ] $*"; }
fail() { echo "  [FAIL] $*"; BAD=$((BAD + 1)); }
note() { echo "  [warn] $*"; WARN=$((WARN + 1)); }
hint() { echo "         ↳ $*"; }

$QUIET || echo "Master of Orion — Reborn — doctor"

if [[ ! -d "${INSTALL_ROOT}/releases" ]]; then fail "not installed at ${INSTALL_ROOT}"; hint "sudo bash scripts/install.sh"; exit 2; fi
DOMAIN="$(moo_conf_get "$INSTALL_ROOT" domain)"; DOMAIN="${DOMAIN:-$MOO_DEFAULT_DOMAIN}"
TLS="$(moo_conf_get "$INSTALL_ROOT" tls)"
CUR="$(moo_current "$INSTALL_ROOT" || true)"

if [[ -n "$CUR" && -f "${INSTALL_ROOT}/current/index.html" && -f "${INSTALL_ROOT}/current/js/manifest.js" ]]; then
    pass "release ${CUR} is live ($(tr -d '[:space:]' < "${INSTALL_ROOT}/VERSION" 2>/dev/null || echo '?'))"
else fail "no complete live release"; hint "sudo bash ${INSTALL_ROOT}/scripts/rollback.sh --list"; fi

# every file the manifest lists must exist in the live release
if [[ -f "${INSTALL_ROOT}/current/js/manifest.js" ]]; then
    MISSING=$(grep -o "'js/[^']*\.js'" "${INSTALL_ROOT}/current/js/manifest.js" | tr -d "'" | sort -u | while read -r f; do [[ -f "${INSTALL_ROOT}/current/$f" ]] || echo "$f"; done)
    if [[ -z "$MISSING" ]]; then pass "every file listed in js/manifest.js is present"
    else fail "files missing from the live release: $(echo $MISSING | tr '\n' ' ')"; hint "sudo bash ${INSTALL_ROOT}/scripts/upgrade.sh --force"; fi
fi

if command -v nginx >/dev/null; then
    if systemctl is-active --quiet nginx; then pass "nginx is running"; else fail "nginx is not running"; hint "sudo systemctl start nginx; journalctl -u nginx -n 30"; fi
    if nginx -t >/dev/null 2>&1; then pass "nginx config is valid"; else fail "nginx -t fails"; hint "sudo nginx -t"; fi
    [[ -e /etc/nginx/sites-enabled/${MOO_SITE_NAME}.conf ]] && pass "site ${MOO_SITE_NAME} is enabled" || fail "site ${MOO_SITE_NAME} is not enabled"
else fail "nginx is not installed"; fi

if command -v curl >/dev/null && [[ -n "$CUR" ]]; then
    if moo_health "$INSTALL_ROOT" "$DOMAIN" "$CUR"; then pass "${DOMAIN} serves the live release locally"
    else fail "${DOMAIN} is not serving ${CUR} locally"; hint "sudo tail /var/log/nginx/moogenesis.error.log"; fi
fi

DNS_IP=$(getent ahostsv4 "$DOMAIN" 2>/dev/null | awk '{print $1; exit}')
PUB_IP=$(curl -fsS --max-time 6 https://api.ipify.org 2>/dev/null || true)
if [[ -z "$DNS_IP" ]]; then note "${DOMAIN} does not resolve"; hint "add an A record for ${DOMAIN} at your DNS host"
elif [[ -n "$PUB_IP" && "$DNS_IP" != "$PUB_IP" ]]; then note "${DOMAIN} → ${DNS_IP}, but this network's public IP is ${PUB_IP}"; hint "update the A record (home IPs change; consider DDNS)"
else pass "DNS ${DOMAIN} → ${DNS_IP}${PUB_IP:+ (matches the public IP)}"; fi

if [[ "$TLS" == "yes" ]]; then
    CERT="/etc/letsencrypt/live/${DOMAIN}/fullchain.pem"
    if [[ -f "$CERT" ]]; then
        if openssl x509 -checkend $((14 * 86400)) -noout -in "$CERT" >/dev/null 2>&1; then
            pass "certificate valid for 14+ days ($(openssl x509 -enddate -noout -in "$CERT" | cut -d= -f2))"
        else note "certificate expires within 14 days (or is expired)"; hint "sudo certbot renew; systemctl list-timers | grep certbot"; fi
    else fail "TLS is enabled but ${CERT} is missing"; hint "sudo certbot --nginx -d ${DOMAIN}"; fi
else note "TLS is not enabled — traffic is plain HTTP"; hint "sudo bash scripts/install.sh --domain ${DOMAIN} --email you@example.com"; fi

FREE=$(df -Pm "$INSTALL_ROOT" | awk 'NR==2 {print $4}')
if [[ "${FREE:-0}" -lt 200 ]]; then note "only ${FREE} MB free on the install volume"; else pass "disk: ${FREE} MB free"; fi

LAST=$(ls -1t "${INSTALL_ROOT}"/backups/moogenesis-*.tgz 2>/dev/null | head -1)
[[ -n "$LAST" ]] && pass "last backup: $(basename "$LAST")" || note "no backup yet"

if [[ $BAD -gt 0 ]]; then echo "  => ${BAD} problem(s), ${WARN} warning(s)"; exit 2
elif [[ $WARN -gt 0 ]]; then $QUIET || echo "  => all essentials fine, ${WARN} warning(s)"; exit 1
else $QUIET || echo "  => all clear"; exit 0; fi
