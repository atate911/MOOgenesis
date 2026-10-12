#!/usr/bin/env bash
# Build and activate a new release.
#   sudo ./deploy/deploy.sh                 # git pull the configured branch, then release
#   sudo ./deploy/deploy.sh --no-pull       # release exactly what is checked out in SRC_DIR
#   sudo ./deploy/deploy.sh --ref <sha|tag> # release a specific ref
# Layout: $APP_ROOT/releases/<id>/ (index.html css/ js/ only — no tools/docs), $APP_ROOT/current -> newest.
# The switch is an atomic symlink swap, so players never see a half-deployed site.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$HERE/config.sh"
need_root

PULL=1; REF=""
while [ $# -gt 0 ]; do
  case "$1" in
    --no-pull) PULL=0 ;;
    --no-pull-if-missing) [ -d "$SRC_DIR/.git" ] && PULL=0 || true ;;
    --ref) REF="${2:?--ref needs a value}"; shift ;;
    -h|--help) sed -n 2,8p "$0"; exit 0 ;;
    *) die "unknown option: $1" ;;
  esac; shift
done

if [ ! -d "$SRC_DIR/.git" ] && [ ! -L "$SRC_DIR" ]; then
  log "Cloning $REPO_URL ($BRANCH) into $SRC_DIR…"
  git clone --branch "$BRANCH" "$REPO_URL" "$SRC_DIR"
  PULL=0
fi
cd "$SRC_DIR"
git config --global --add safe.directory "$(readlink -f "$SRC_DIR")" 2>/dev/null || true

if [ -n "$REF" ]; then
  git fetch --tags origin; git checkout --quiet "$REF"
elif [ "$PULL" -eq 1 ]; then
  log "Updating $BRANCH from origin…"
  git fetch origin "$BRANCH"; git checkout --quiet "$BRANCH"; git merge --ff-only "origin/$BRANCH"
fi

# Sanity checks before anything goes live (skipped if node isn't installed on the server).
if command -v node >/dev/null && [ -f tools/check.js ]; then
  log "Syntax-checking modules…"; node tools/check.js >/dev/null || die "tools/check.js failed — not deploying."
fi
for f in index.html js/manifest.js js/loader.js js/main.js css/base.css; do [ -f "$f" ] || die "missing $f"; done

ID="$(date -u +%Y%m%d-%H%M%S)-$(git rev-parse --short HEAD)"
REL="$APP_ROOT/releases/$ID"
log "Building release $ID…"
mkdir -p "$REL"
rsync -a --exclude='*.tmp' --exclude='*.md' index.html css js "$REL/"
# Stamp the build id so browsers cache assets until the next deploy.
sed -i "s|<meta name=\"moo-build\" content=\"[^\"]*\">|<meta name=\"moo-build\" content=\"$ID\">|" "$REL/index.html"
grep -q "content=\"$ID\"" "$REL/index.html" || die "failed to stamp build id"
git rev-parse HEAD > "$REL/REVISION"
chown -R root:root "$REL"; find "$REL" -type d -exec chmod 755 {} +; find "$REL" -type f -exec chmod 644 {} +

PREV=""; [ -L "$APP_ROOT/current" ] && PREV="$(readlink -f "$APP_ROOT/current")"
ln -sfn "$REL" "$APP_ROOT/current.new"
mv -Tf "$APP_ROOT/current.new" "$APP_ROOT/current"      # atomic switch
[ -n "$PREV" ] && [ "$PREV" != "$REL" ] && echo "$PREV" > "$APP_ROOT/previous"
log "Live: $ID  (previous: ${PREV:-none})"

# Prune old releases, keeping the newest KEEP_RELEASES and whatever is live/previous.
ls -1dt "$APP_ROOT"/releases/*/ 2>/dev/null | tail -n +$((KEEP_RELEASES+1)) | while read -r d; do
  d="${d%/}"; [ "$(readlink -f "$d")" = "$(readlink -f "$APP_ROOT/current")" ] && continue
  [ "$(readlink -f "$d")" = "$(cat "$APP_ROOT/previous" 2>/dev/null || true)" ] && continue
  rm -rf "$d"
done
