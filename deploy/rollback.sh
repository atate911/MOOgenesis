#!/usr/bin/env bash
# Switch back to the previous release (or a named one):  sudo ./deploy/rollback.sh [release-id]
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$HERE/config.sh"
need_root
if [ $# -ge 1 ]; then TARGET="$APP_ROOT/releases/$1"
else TARGET="$(cat "$APP_ROOT/previous" 2>/dev/null || true)"; fi
[ -n "$TARGET" ] && [ -d "$TARGET" ] || { ls -1 "$APP_ROOT/releases"; die "no such release; pick one from the list above."; }
CUR="$(readlink -f "$APP_ROOT/current")"
ln -sfn "$TARGET" "$APP_ROOT/current.new"; mv -Tf "$APP_ROOT/current.new" "$APP_ROOT/current"
[ "$CUR" != "$(readlink -f "$TARGET")" ] && echo "$CUR" > "$APP_ROOT/previous"
log "Now serving $(basename "$TARGET") (was $(basename "$CUR"))."
