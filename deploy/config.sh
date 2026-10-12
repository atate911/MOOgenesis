# Shared settings for the deploy scripts (sourced, not executed). Override any value via the environment
# or /etc/moo/deploy.env.
DOMAIN="${DOMAIN:-moo.dhlab.us}"
APP_ROOT="${APP_ROOT:-/srv/moo}"                 # releases/ + current symlink live here
REPO_URL="${REPO_URL:-https://github.com/atate911/MOOgenesis.git}"
BRANCH="${BRANCH:-main}"
SRC_DIR="${SRC_DIR:-$APP_ROOT/src}"              # git checkout used for builds
KEEP_RELEASES="${KEEP_RELEASES:-5}"
CERT_EMAIL="${CERT_EMAIL:-}"                     # Let's Encrypt expiry notices (recommended)
WEBROOT_ACME="${WEBROOT_ACME:-/var/www/certbot}"
[ -f /etc/moo/deploy.env ] && . /etc/moo/deploy.env

log()  { printf '\033[1;34m[moo]\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31m[moo] ERROR:\033[0m %s\n' "$*" >&2; exit 1; }
need_root() { [ "$(id -u)" -eq 0 ] || die "run as root (sudo $0)"; }
