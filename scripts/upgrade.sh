#!/usr/bin/env bash
# Upgrade the published game from a newer git checkout — atomically.
#
#   cd /path/to/MOOgenesis && sudo bash scripts/upgrade.sh [--pull] [--branch main]
#   sudo bash /opt/moogenesis/scripts/upgrade.sh --pull        # repo path from install.conf
#
# Builds a NEW release directory, flips the `current` symlink, health-checks
# the live site and flips back automatically if it is not serving the new
# release. Old releases are kept (newest 5) for scripts/rollback.sh.
# Never touches the nginx site conf, so certbot's edits survive upgrades.
set -euo pipefail

INSTALL_ROOT="/opt/moogenesis"
REPO_DIR=""
DO_PULL=false
BRANCH=""
FORCE=false
ALLOW_DOWNGRADE=false

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; BOLD='\033[1m'; NC='\033[0m'
die()  { echo -e "\n${RED}✗ ERROR: $*${NC}\n" >&2; exit 1; }
step() { echo -e "\n${BOLD}▶  $*${NC}"; }
info() { echo -e "   ${BLUE}→${NC} $*"; }
ok()   { echo -e "   ${GREEN}✓${NC} $*"; }
warn() { echo -e "   ${YELLOW}!${NC} $*"; }

. "$(dirname "${BASH_SOURCE[0]}")/lib.sh" \
    || { echo "FATAL: lib.sh not found next to $0" >&2; exit 1; }

REPO_DIR="$(moo_repo_dir "${BASH_SOURCE[0]}" || true)"
while [[ $# -gt 0 ]]; do
    case "$1" in
        --repo)   REPO_DIR="$2"; shift 2 ;;
        --root)   INSTALL_ROOT="$2"; shift 2 ;;
        --pull)   DO_PULL=true; shift ;;
        --branch) BRANCH="$2"; shift 2 ;;
        --force)  FORCE=true; shift ;;
        --allow-downgrade) ALLOW_DOWNGRADE=true; shift ;;
        -h|--help)
            cat <<USAGE
Usage: sudo bash $0 [--pull] [--branch NAME] [--repo PATH] [--root ${INSTALL_ROOT}] [--force] [--allow-downgrade]
  --pull      git pull --ff-only in the checkout first
  --branch    check out this branch before pulling (default: stay on the current one)
  --force     redeploy even when the content is identical to what is live
USAGE
            exit 0 ;;
        *) die "Unknown option: $1  (use --help)" ;;
    esac
done

[[ $EUID -eq 0 ]] || die "Run with sudo:  sudo bash $0"
[[ -d "${INSTALL_ROOT}/releases" ]] || die "${INSTALL_ROOT} is not installed. Run install.sh first."
[[ -n "$REPO_DIR" ]] || REPO_DIR="$(moo_conf_get "${INSTALL_ROOT}" repo)"
[[ -n "$REPO_DIR" && -f "${REPO_DIR}/index.html" ]] \
    || die "Cannot find the checkout. Pass --repo /path/to/MOOgenesis (or run from inside it)."
DOMAIN="$(moo_conf_get "${INSTALL_ROOT}" domain)"; DOMAIN="${DOMAIN:-$MOO_DEFAULT_DOMAIN}"

if $DO_PULL; then
    step "Updating the checkout"
    # The checkout may be owned by the operator; git refuses root on foreign
    # repos ("dubious ownership"), so run git as the owner.
    OWNER=$(stat -c %U "${REPO_DIR}/.git" 2>/dev/null || echo root)
    G() { if [[ "$OWNER" != root ]]; then sudo -u "$OWNER" git -C "$REPO_DIR" "$@"; else git -C "$REPO_DIR" "$@"; fi; }
    [[ -z "$(G status --porcelain --untracked-files=no)" ]] \
        || die "The checkout has local changes — commit or stash them first (git -C ${REPO_DIR} status)."
    G fetch --quiet origin
    [[ -z "$BRANCH" ]] || G checkout --quiet "$BRANCH"
    G pull --ff-only --quiet || die "git pull --ff-only failed (diverged history?). Resolve it in ${REPO_DIR}."
    ok "Checkout at $(G rev-parse --short HEAD) on $(G rev-parse --abbrev-ref HEAD)"
fi

OLD_REL="$(moo_current "${INSTALL_ROOT}" || true)"
OLD_VERSION="$(tr -d '[:space:]' < "${INSTALL_ROOT}/VERSION" 2>/dev/null || echo unknown)"
NEW_VERSION="$(tr -d '[:space:]' < "${REPO_DIR}/VERSION" 2>/dev/null || echo unknown)"

if [[ "$OLD_VERSION" != unknown && "$NEW_VERSION" != unknown && "$OLD_VERSION" != "$NEW_VERSION" && "$ALLOW_DOWNGRADE" != true ]]; then
    older=$(printf '%s\n%s\n' "$OLD_VERSION" "$NEW_VERSION" | sort -V | head -1)
    [[ "$older" != "$NEW_VERSION" ]] \
        || die "Target v${NEW_VERSION} is OLDER than the live v${OLD_VERSION}. Use scripts/rollback.sh to go back, or pass --allow-downgrade."
fi

echo -e "\n${BOLD}╔══════════════════════════════════════════════════╗"
echo    "║   Master of Orion — Reborn — Upgrade             ║"
echo -e "╚══════════════════════════════════════════════════╝${NC}"
echo    "   From : v${OLD_VERSION}  (${OLD_REL:-no release})"
echo    "   To   : v${NEW_VERSION}"
echo    "   Repo : ${REPO_DIR}"

if [[ -n "$OLD_REL" && "$FORCE" != true ]]; then
    NEW_HASH="$(moo_tree_hash "${REPO_DIR}")"
    OLD_HASH="$(moo_tree_hash "${INSTALL_ROOT}/releases/${OLD_REL}")"
    if [[ -n "$NEW_HASH" && "$NEW_HASH" == "$OLD_HASH" ]]; then
        ok "Already up to date — the live files are identical to the checkout (use --force to redeploy anyway)."
        exit 0
    fi
fi

step "Pre-upgrade backup"
if [[ -x "${INSTALL_ROOT}/scripts/backup.sh" ]]; then
    B=$(bash "${INSTALL_ROOT}/scripts/backup.sh" --root "${INSTALL_ROOT}" --quiet 2>/dev/null) \
        && ok "Backup: ${B}" || warn "Backup failed — continuing (the previous release is kept for rollback)"
fi

step "Building the new release"
REL=$(moo_make_release "${REPO_DIR}" "${INSTALL_ROOT}") || die "Could not build a release."
ok "${REL}"

step "Going live"
moo_switch "${INSTALL_ROOT}" "$REL"
ok "current → ${REL}"

step "Health check"
HEALTHY=false
for _ in 1 2 3 4 5; do
    if moo_health "${INSTALL_ROOT}" "$DOMAIN" "$REL"; then HEALTHY=true; break; fi
    sleep 2
done
if ! $HEALTHY; then
    echo -e "\n${RED}${BOLD}  ✗ The site is not serving ${REL} — rolling back.${NC}"
    if [[ -n "$OLD_REL" && -d "${INSTALL_ROOT}/releases/${OLD_REL}" ]]; then
        moo_switch "${INSTALL_ROOT}" "$OLD_REL"
        moo_sync_version "${INSTALL_ROOT}"
        if moo_health "${INSTALL_ROOT}" "$DOMAIN" "$OLD_REL"; then warn "Back on ${OLD_REL}; the site is healthy."
        else warn "Rolled back, but the health check still fails — see: sudo tail /var/log/nginx/moogenesis.error.log"; fi
    else
        warn "No previous release to return to."
    fi
    rm -rf "${INSTALL_ROOT}/releases/${REL}"
    exit 1
fi
ok "Serving ${REL}"

step "Refreshing operator scripts"
cp "${REPO_DIR}/scripts/"*.sh "${INSTALL_ROOT}/scripts/"
chmod 755 "${INSTALL_ROOT}/scripts/"*.sh
mkdir -p "${INSTALL_ROOT}/deploy/nginx"
cp "${REPO_DIR}/deploy/nginx/moogenesis.conf.template" "${INSTALL_ROOT}/deploy/nginx/"
cp "${REPO_DIR}/VERSION" "${INSTALL_ROOT}/VERSION"
moo_conf_set "${INSTALL_ROOT}" repo "$REPO_DIR"
for u in moogenesis-doctor.service moogenesis-doctor.timer; do
    if [[ -f "/etc/systemd/system/${u}" && -f "${REPO_DIR}/systemd/${u}" ]]; then
        sed "s|/opt/moogenesis|${INSTALL_ROOT}|g" "${REPO_DIR}/systemd/${u}" > "/tmp/${u}.new"
        if ! diff -q "/tmp/${u}.new" "/etc/systemd/system/${u}" >/dev/null; then
            mv "/tmp/${u}.new" "/etc/systemd/system/${u}"; systemctl daemon-reload; ok "Refreshed ${u}"
        else rm -f "/tmp/${u}.new"; fi
    fi
done
ok "Scripts and VERSION updated"

moo_prune "${INSTALL_ROOT}"
echo
echo -e "${GREEN}${BOLD}   Upgrade complete: v${OLD_VERSION} → v${NEW_VERSION}  (${REL})${NC}"
echo    "   Players pick up the new files on their next page load (no-cache + ETag)."
echo    "   Undo with: sudo bash ${INSTALL_ROOT}/scripts/rollback.sh"
echo
