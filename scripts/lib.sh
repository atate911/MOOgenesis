# shellcheck shell=bash disable=SC2034
# lib.sh — shared helpers for the Master of Orion — Reborn operator scripts.
# Sourced, never executed. Function definitions only: no `set` lines and no
# top-level side effects, so sourcing never changes a caller's shell options.
# Define die/step/info/ok/warn BEFORE sourcing (the fallbacks below are plain).

declare -F info >/dev/null || info() { echo "   -> $*"; }
declare -F ok   >/dev/null || ok()   { echo "   ok $*"; }
declare -F warn >/dev/null || warn() { echo "   !  $*" >&2; }

# What gets published: the game is static, so this is the whole deployable
# surface. research/, briefs/, tools/ and the *.md docs stay in the checkout.
MOO_DEPLOY_PATHS=(index.html css js assets/art assets/races)

MOO_DEFAULT_ROOT="/opt/moogenesis"
MOO_DEFAULT_DOMAIN="moo.dhlab.us"
MOO_SITE_NAME="moogenesis"
MOO_KEEP_RELEASES=5

# moo_repo_dir SCRIPT_PATH — the checkout containing this script, or empty.
moo_repo_dir() {
    local c; c="$(cd "$(dirname "$1")/.." && pwd)"
    [[ -f "${c}/index.html" && -f "${c}/js/manifest.js" ]] && printf '%s\n' "$c"
}

# moo_conf_get ROOT KEY — one KEY=value from ROOT/install.conf (empty if absent).
moo_conf_get() {
    local f="$1/install.conf"
    [[ -f "$f" ]] || return 0
    awk -F= -v k="$2" '{ sub(/\r$/, "") } $1 == k { sub(/^[^=]*=/, ""); print; exit }' "$f"
}

# moo_conf_set ROOT KEY VALUE — upsert one KEY=value into ROOT/install.conf.
moo_conf_set() {
    local f="$1/install.conf" tmp
    touch "$f"
    tmp=$(mktemp)
    grep -v "^$2=" "$f" > "$tmp" || true
    printf '%s=%s\n' "$2" "$3" >> "$tmp"
    cat "$tmp" > "$f"; rm -f "$tmp"
}

# moo_tree_hash DIR — content hash of the deployable paths in DIR (stable
# across mtimes), so an upgrade can tell "nothing changed" from "new code".
moo_tree_hash() {
    local d="$1" p
    (
        cd "$d" || exit 1
        for p in "${MOO_DEPLOY_PATHS[@]}"; do
            [[ -e "$p" ]] && find "$p" -type f -print0
        done | LC_ALL=C sort -z | xargs -0 sha256sum | sha256sum | cut -c1-16
    )
}

# moo_make_release REPO ROOT — copy the deployable paths into a new
# ROOT/releases/<name> and write version.txt. Prints the release name.
moo_make_release() {
    local repo="$1" root="$2" ver sha stamp name dest p
    ver=$(tr -d '[:space:]' < "${repo}/VERSION" 2>/dev/null || true); ver="${ver:-0.0.0}"
    sha=$(git -C "$repo" rev-parse --short HEAD 2>/dev/null || echo nogit)
    stamp=$(date -u +%Y%m%d-%H%M%S)
    name="v${ver}-${stamp}-${sha}"
    dest="${root}/releases/${name}"
    mkdir -p "$dest"
    for p in "${MOO_DEPLOY_PATHS[@]}"; do
        [[ -e "${repo}/${p}" ]] || { rm -rf "$dest"; echo "missing ${p} in ${repo}" >&2; return 1; }
        cp -a "${repo}/${p}" "${dest}/"
    done
    printf '%s\n' "$name" > "${dest}/version.txt"
    printf '%s\n' "$ver" > "${dest}/VERSION"
    find "$dest" -type d -exec chmod 755 {} + ; find "$dest" -type f -exec chmod 644 {} +
    printf '%s\n' "$name"
}

# moo_current ROOT — name of the release the `current` symlink points at.
moo_current() { local l; l=$(readlink "$1/current" 2>/dev/null) && basename "$l"; }

# moo_switch ROOT NAME — atomically point `current` at a release. nginx follows
# the symlink on every request, so no reload is needed.
moo_switch() {
    ln -sfn "$1/releases/$2" "$1/current.new" && mv -T "$1/current.new" "$1/current"
}

# moo_sync_version ROOT — make ROOT/VERSION match the release now live (the
# downgrade guard and the dashboard read it; a rollback must move it back).
moo_sync_version() {
    local root="$1" v
    v=$(tr -d '[:space:]' < "${root}/current/VERSION" 2>/dev/null || true)
    [[ -n "$v" ]] && printf '%s\n' "$v" > "${root}/VERSION"
    return 0
}

# moo_prune ROOT — keep the newest MOO_KEEP_RELEASES releases (never `current`).
moo_prune() {
    local root="$1" cur n=0 r
    cur=$(moo_current "$root")
    while IFS= read -r r; do
        n=$((n + 1))
        [[ $n -le $MOO_KEEP_RELEASES || "$r" == "$cur" ]] && continue
        rm -rf "${root}/releases/${r}"
    done < <(ls -1 "${root}/releases" 2>/dev/null | sort -r)
}

# moo_health ROOT DOMAIN EXPECT_RELEASE — returns 0 when the site answers with
# the expected release. Uses --resolve so it tests THIS machine's nginx (and the
# real certificate when TLS is on) regardless of DNS or hairpin-NAT quirks.
moo_health() {
    local root="$1" domain="$2" expect="$3" scheme body
    scheme=http; [[ "$(moo_conf_get "$root" tls)" == "yes" ]] && scheme=https
    local port=80; [[ "$scheme" == https ]] && port=443
    # MOO_CURL_OPTS is a test hook (e.g. "-k" against Caddy's local CA).
    # shellcheck disable=SC2086
    body=$(curl -fsS ${MOO_CURL_OPTS:-} --max-time 10 --resolve "${domain}:${port}:127.0.0.1" \
           "${scheme}://${domain}/version.txt" 2>/dev/null) || return 1
    [[ "$(tr -d '[:space:]' <<<"$body")" == "$expect" ]] || return 1
    # shellcheck disable=SC2086
    curl -fsS ${MOO_CURL_OPTS:-} --max-time 15 -o /dev/null --resolve "${domain}:${port}:127.0.0.1" \
         "${scheme}://${domain}/js/manifest.js" 2>/dev/null
}

# moo_render_nginx TEMPLATE DOMAIN ROOT — fill a web-server template on stdout
# (nginx and Caddy templates share the @DOMAIN@ / @ROOT@ placeholders).
moo_render_nginx() {
    sed -e "s|@DOMAIN@|$2|g" -e "s|@ROOT@|$3|g" "$1"
}

# moo_detect_web — which web server already fronts this machine: "caddy" when
# Caddy is running or listening on port 80/443 (it would block nginx from
# starting), else "nginx".
moo_detect_web() {
    if systemctl is-active --quiet caddy 2>/dev/null; then echo caddy; return; fi
    if ss -ltnp 2>/dev/null | grep -E ':(80|443)\b' | grep -q caddy; then echo caddy; return; fi
    echo nginx
}

# moo_caddyfile — path of the Caddyfile the running Caddy actually loads
# (read off its unit's --config), else /etc/caddy/Caddyfile.
moo_caddyfile() {
    local c
    c=$(systemctl show caddy -p ExecStart 2>/dev/null | grep -o -- '--config [^ ;]*' | head -1 | awk '{print $2}')
    printf '%s\n' "${c:-/etc/caddy/Caddyfile}"
}
