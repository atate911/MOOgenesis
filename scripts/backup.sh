#!/usr/bin/env bash
# Snapshot the server-side state: install.conf, the nginx site, the Let's Encrypt
# account/cert config, and the current release. Players' SAVES are not here —
# they live in each browser (localStorage); players can use the in-game
# Save → Export to keep a copy.
#
#   sudo bash /opt/moogenesis/scripts/backup.sh [--root DIR] [--keep N] [--quiet]
# Prints the archive path as its last stdout line.
set -euo pipefail
umask 077

INSTALL_ROOT="/opt/moogenesis"; KEEP=10; QUIET=false
RED='\033[0;31m'; GREEN='\033[0;32m'; BLUE='\033[0;34m'; NC='\033[0m'
die()  { echo -e "\n${RED}✗ ERROR: $*${NC}\n" >&2; exit 1; }
info() { $QUIET || echo -e "   ${BLUE}→${NC} $*"; }
ok()   { $QUIET || echo -e "   ${GREEN}✓${NC} $*"; }
warn() { echo "   !  $*" >&2; }
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh" || { echo "FATAL: lib.sh not found next to $0" >&2; exit 1; }

while [[ $# -gt 0 ]]; do
    case "$1" in
        --root) INSTALL_ROOT="$2"; shift 2 ;;
        --keep) KEEP="$2"; shift 2 ;;
        --quiet) QUIET=true; shift ;;
        -h|--help) echo "Usage: sudo bash $0 [--root ${INSTALL_ROOT}] [--keep N] [--quiet]"; exit 0 ;;
        *) die "Unknown option: $1" ;;
    esac
done
[[ "$KEEP" =~ ^[1-9][0-9]*$ ]] || die "--keep must be a positive integer"
[[ -d "$INSTALL_ROOT" ]] || die "${INSTALL_ROOT} does not exist."

mkdir -p "${INSTALL_ROOT}/backups"
DEST="${INSTALL_ROOT}/backups/moogenesis-$(date +%Y%m%d_%H%M%S).tgz"
CUR="$(moo_current "$INSTALL_ROOT" || true)"

MEMBERS=()
for m in install.conf VERSION; do [[ -e "${INSTALL_ROOT}/${m}" ]] && MEMBERS+=("$m"); done
[[ -n "$CUR" ]] && MEMBERS+=("releases/${CUR}")
[[ ${#MEMBERS[@]} -gt 0 ]] || die "Nothing to back up under ${INSTALL_ROOT}."

# System-side pieces are staged under system/ so the archive stays relocatable.
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
for p in /etc/nginx/sites-available/${MOO_SITE_NAME}.conf /etc/letsencrypt/renewal /etc/letsencrypt/accounts; do
    [[ -e "$p" ]] || continue
    mkdir -p "${TMP}/system$(dirname "$p")"; cp -a "$p" "${TMP}/system${p}"
done
TAR_EXTRA=(); [[ -d "${TMP}/system" ]] && TAR_EXTRA=(-C "$TMP" system)
tar -czf "$DEST" -C "$INSTALL_ROOT" "${MEMBERS[@]}" "${TAR_EXTRA[@]}" \
    || { rm -f "$DEST"; die "Backup failed."; }
tar -tzf "$DEST" >/dev/null 2>&1 || { rm -f "$DEST"; die "Backup archive is not readable."; }
chmod 600 "$DEST"
ok "Wrote ${DEST}"

# retention: newest $KEEP archives
n=0
while IFS= read -r f; do
    n=$((n + 1)); [[ $n -le $KEEP ]] || { rm -f "$f"; info "Pruned $(basename "$f")"; }
done < <(ls -1t "${INSTALL_ROOT}"/backups/moogenesis-*.tgz 2>/dev/null)
echo "$DEST"
