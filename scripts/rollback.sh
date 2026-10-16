#!/usr/bin/env bash
# Point the live site back at an earlier release (instant; no nginx reload).
#
#   sudo bash /opt/moogenesis/scripts/rollback.sh            # previous release
#   sudo bash /opt/moogenesis/scripts/rollback.sh --list     # show releases
#   sudo bash /opt/moogenesis/scripts/rollback.sh RELEASE    # a specific one
set -euo pipefail

INSTALL_ROOT="/opt/moogenesis"
TARGET=""; LIST=false
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; BOLD='\033[1m'; NC='\033[0m'
die()  { echo -e "\n${RED}✗ ERROR: $*${NC}\n" >&2; exit 1; }
info() { echo -e "   ${BLUE}→${NC} $*"; }
ok()   { echo -e "   ${GREEN}✓${NC} $*"; }
warn() { echo -e "   ${YELLOW}!${NC} $*"; }
step() { echo -e "\n${BOLD}▶  $*${NC}"; }
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh" || { echo "FATAL: lib.sh not found next to $0" >&2; exit 1; }

while [[ $# -gt 0 ]]; do
    case "$1" in
        --root) INSTALL_ROOT="$2"; shift 2 ;;
        --list) LIST=true; shift ;;
        -h|--help) echo "Usage: sudo bash $0 [--root ${INSTALL_ROOT}] [--list] [RELEASE]"; exit 0 ;;
        -*) die "Unknown option: $1" ;;
        *)  TARGET="$1"; shift ;;
    esac
done

[[ -d "${INSTALL_ROOT}/releases" ]] || die "${INSTALL_ROOT} is not installed."
CUR="$(moo_current "${INSTALL_ROOT}" || true)"

if $LIST; then
    moo_releases "${INSTALL_ROOT}" | while read -r r; do
        [[ "$r" == "$CUR" ]] && echo "  * $r   (live)" || echo "    $r"
    done
    exit 0
fi

[[ $EUID -eq 0 ]] || die "Run with sudo:  sudo bash $0"
if [[ -z "$TARGET" ]]; then
    # newest release other than the live one (moo_releases: version-aware order)
    TARGET=$(moo_releases "${INSTALL_ROOT}" | grep -v -x -- "$CUR" | head -1 || true)
    [[ -n "$TARGET" ]] || die "There is no earlier release to go back to."
fi
[[ -d "${INSTALL_ROOT}/releases/${TARGET}" ]] || die "No such release: ${TARGET}  (see --list)"
[[ "$TARGET" != "$CUR" ]] || die "${TARGET} is already live."

step "Rolling back"
info "${CUR:-none}  →  ${TARGET}"
moo_switch "${INSTALL_ROOT}" "$TARGET"
moo_sync_version "${INSTALL_ROOT}"
DOMAIN="$(moo_conf_get "${INSTALL_ROOT}" domain)"; DOMAIN="${DOMAIN:-$MOO_DEFAULT_DOMAIN}"
if command -v curl >/dev/null && moo_health "${INSTALL_ROOT}" "$DOMAIN" "$TARGET"; then
    ok "Live and serving ${TARGET}"
else
    warn "Switched, but the health check could not confirm it (nginx stopped? --root install?). Run doctor.sh."
fi
echo "   (The checkout is unchanged — 'upgrade.sh --pull' would move forward again.)"
