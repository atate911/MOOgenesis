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

# moo_conf_has ROOT KEY — true when KEY is present in ROOT/install.conf.
moo_conf_has() {
    [[ -f "$1/install.conf" ]] && grep -q "^$2=" "$1/install.conf"
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

# moo_release_hash RELEASE_DIR — the checkout hash a release was built from
# (recorded in .treehash by moo_make_release). Empty for releases built before
# stamping existed: those never compare equal, so they get rebuilt once.
moo_release_hash() {
    [[ -f "$1/.treehash" ]] && tr -d '[:space:]' < "$1/.treehash"
    return 0
}

# moo_make_release REPO ROOT — copy the deployable paths into a new
# ROOT/releases/<name>, stamp the build id into the copy and write
# version.txt. Prints the release name.
#
# Stamping: the release's js/manifest.js gets `window.MOO_BUILD = '<name>'` on
# its first line (js/loader.js then appends ?v=<name> to every css/js URL, so
# the web server can cache those for a year while index.html and manifest.js
# stay no-cache), and js/core/ns.js's M.VERSION is set from the VERSION file.
# The checkout itself is never modified. .treehash records the checkout hash
# so install/upgrade can recognise an identical tree despite the stamps.
moo_make_release() {
    local repo="$1" root="$2" ver sha stamp name dest p hash
    ver=$(tr -d '[:space:]' < "${repo}/VERSION" 2>/dev/null || true)
    [[ "$ver" =~ ^[A-Za-z0-9][A-Za-z0-9.+-]*$ ]] || ver="0.0.0"
    sha=$(git -C "$repo" rev-parse --short HEAD 2>/dev/null || echo nogit)
    stamp=$(date -u +%Y%m%d-%H%M%S)
    name="v${ver}-${stamp}-${sha}"
    dest="${root}/releases/${name}"
    hash=$(moo_tree_hash "$repo")
    mkdir -p "$dest"
    for p in "${MOO_DEPLOY_PATHS[@]}"; do
        [[ -e "${repo}/${p}" ]] || { rm -rf "$dest"; echo "missing ${p} in ${repo}" >&2; return 1; }
        mkdir -p "${dest}/$(dirname "$p")"                    # keep nested paths (assets/art) where the game expects them
        cp -a "${repo}/${p}" "${dest}/${p}"
    done
    sed -i "1i window.MOO_BUILD = '${name}';  // release stamp (moo_make_release) — cache-busts every css/js URL" "${dest}/js/manifest.js" \
        || { rm -rf "$dest"; echo "could not stamp js/manifest.js" >&2; return 1; }
    [[ -f "${dest}/js/core/ns.js" ]] && sed -i -E "s/^(\s*M\.VERSION = )'[^']*'/\1'${ver}'/" "${dest}/js/core/ns.js"
    printf '%s\n' "$name" > "${dest}/version.txt"
    printf '%s\n' "$ver" > "${dest}/VERSION"
    printf '%s\n' "$hash" > "${dest}/.treehash"
    find "$dest" -type d -exec chmod 755 {} + ; find "$dest" -type f -exec chmod 644 {} +
    printf '%s\n' "$name"
}

# moo_current ROOT — name of the release the `current` symlink points at.
moo_current() { local l; l=$(readlink "$1/current" 2>/dev/null) && basename "$l"; }

# moo_releases ROOT — release names, newest first. Names are v<ver>-<stamp>-<sha>;
# `sort -V` orders v1.0.10 above v1.0.9 (plain sort would not) and, within one
# version, by the UTC stamp. Every place that lists releases must use this.
moo_releases() {
    ls -1 "$1/releases" 2>/dev/null | sort -rV
}

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
    done < <(moo_releases "$root")
}

# moo_install_scripts REPO ROOT — copy scripts/, deploy/ and VERSION from the
# checkout into the install root. Each script is written to a temporary name
# and renamed over the old one: a script that is RUNNING from ROOT/scripts
# (upgrade.sh, as documented) keeps reading its old inode — bash reads scripts
# by byte offset, so overwriting the file in place would execute garbage.
moo_install_scripts() {
    local repo="$1" root="$2" f tmp
    mkdir -p "${root}/scripts" "${root}/deploy"
    for f in "${repo}/scripts/"*.sh; do
        tmp="${root}/scripts/.$(basename "$f").new.$$"
        cp "$f" "$tmp" && chmod 755 "$tmp" && mv -f "$tmp" "${root}/scripts/$(basename "$f")"
    done
    cp -a "${repo}/deploy/." "${root}/deploy/"
    tmp="${root}/.VERSION.new.$$"
    cp "${repo}/VERSION" "$tmp" && mv -f "$tmp" "${root}/VERSION"
}

# moo_refresh_units REPO ROOT MODE — render the doctor timer units for ROOT into
# /etc/systemd/system. MODE "install" writes them; "refresh" only replaces units
# that are already installed and differ. Prints the names it changed.
# Returns 0; the caller runs `systemctl daemon-reload` when anything printed.
moo_refresh_units() {
    local repo="$1" root="$2" mode="$3" u tmp dst
    for u in moogenesis-doctor.service moogenesis-doctor.timer; do
        dst="/etc/systemd/system/${u}"
        [[ -f "${repo}/systemd/${u}" ]] || continue
        [[ "$mode" == install || -f "$dst" ]] || continue
        tmp=$(mktemp "/etc/systemd/system/.${u}.XXXXXX") || return 1
        sed "s|/opt/moogenesis|${root}|g" "${repo}/systemd/${u}" > "$tmp"
        if [[ -f "$dst" ]] && diff -q "$tmp" "$dst" >/dev/null; then rm -f "$tmp"; continue; fi
        chmod 644 "$tmp" && mv -f "$tmp" "$dst" && printf '%s\n' "$u"
    done
    return 0
}

# moo_cert_file DOMAIN — the Let's Encrypt certificate certbot would have issued.
moo_cert_file() { printf '/etc/letsencrypt/live/%s/fullchain.pem\n' "$1"; }

# moo_tls_live ROOT DOMAIN — "yes" when the live site answers over HTTPS:
# install.conf says so, or certbot has already put a certificate and a 443
# listener into the nginx site (install.sh re-runs use this to heal the flag).
moo_tls_live() {
    local root="$1" domain="$2"
    if [[ "$(moo_conf_get "$root" tls)" == "yes" ]]; then echo yes; return; fi
    if [[ -f "$(moo_cert_file "$domain")" ]] \
       && grep -qsE '^[[:space:]]*listen[[:space:]]+(\[::\]:)?443' "/etc/nginx/sites-available/${MOO_SITE_NAME}.conf"; then
        echo yes; return
    fi
    echo no
}

# moo_health ROOT DOMAIN EXPECT_RELEASE — returns 0 when the site answers with
# the expected release. Uses --resolve so it tests THIS machine's web server
# (and the real certificate when TLS is on) regardless of DNS or hairpin-NAT
# quirks. Follows redirects (-L): after `certbot --redirect`, plain http answers
# 301 → https, which must not read as "not serving".
moo_health() {
    local root="$1" domain="$2" expect="$3" scheme body
    scheme=http; [[ "$(moo_tls_live "$root" "$domain")" == yes ]] && scheme=https
    # MOO_CURL_OPTS is a test hook (e.g. "-k" against Caddy's local CA).
    local -a extra=() c
    [[ -z "${MOO_CURL_OPTS:-}" ]] || read -r -a extra <<<"${MOO_CURL_OPTS}"
    c=(curl -fsSL "${extra[@]}" --resolve "${domain}:80:127.0.0.1" --resolve "${domain}:443:127.0.0.1")
    body=$("${c[@]}" --max-time 10 "${scheme}://${domain}/version.txt" 2>/dev/null) || return 1
    [[ "$(tr -d '[:space:]' <<<"$body")" == "$expect" ]] || return 1
    "${c[@]}" --max-time 15 -o /dev/null "${scheme}://${domain}/js/manifest.js" 2>/dev/null
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
