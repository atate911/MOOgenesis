#!/usr/bin/env bash
# Verifies the site is up and healthy; exits non-zero on problems.
#   moo-healthcheck [--quiet]     (installed by install.sh, run daily by a systemd timer)
# Checks: nginx running (restarts it if not), index + manifest served over HTTPS, every file in the
# manifest resolves, TLS cert has >14 days left, disk space.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$HERE/config.sh" 2>/dev/null || . /usr/local/lib/moo/config.sh 2>/dev/null || { DOMAIN=moo.dhlab.us; APP_ROOT=/srv/moo; log(){ echo "$*"; }; }
QUIET=0; [ "${1:-}" = "--quiet" ] && QUIET=1
rc=0
fail() { echo "FAIL: $*" >&2; rc=1; }
ok()   { [ "$QUIET" -eq 1 ] || echo "ok:   $*"; }

if systemctl is-active --quiet nginx; then ok "nginx running"; else
  fail "nginx not running — restarting"; systemctl restart nginx && ok "nginx restarted"; fi

base="https://$DOMAIN"
code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$base/healthz" || echo 000)
[ "$code" = 200 ] && ok "healthz 200" || fail "healthz returned $code"

for p in / js/manifest.js js/loader.js css/base.css; do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$base/$p" || echo 000)
  [ "$code" = 200 ] && ok "$p 200" || fail "$p returned $code"
done

# Every file listed in the manifest must exist in the live release.
if [ -f "$APP_ROOT/current/js/manifest.js" ]; then
  missing=0
  while read -r f; do [ -f "$APP_ROOT/current/$f" ] || { fail "manifest file missing: $f"; missing=1; }; done \
    < <(grep -oE "'(js|css)/[^']+'" "$APP_ROOT/current/js/manifest.js" | tr -d "'")
  [ "$missing" -eq 0 ] && ok "all manifest files present ($(basename "$(readlink -f "$APP_ROOT/current")"))"
fi

end=$(echo | openssl s_client -servername "$DOMAIN" -connect "$DOMAIN:443" 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)
if [ -n "$end" ]; then
  days=$(( ( $(date -d "$end" +%s) - $(date +%s) ) / 86400 ))
  [ "$days" -gt 14 ] && ok "TLS cert valid for $days more days" || fail "TLS cert expires in $days days (try: certbot renew)"
else fail "could not read TLS certificate"; fi

use=$(df --output=pcent "$APP_ROOT" | tail -1 | tr -dc 0-9)
[ "${use:-0}" -lt 90 ] && ok "disk ${use}% used" || fail "disk ${use}% used"
exit $rc
