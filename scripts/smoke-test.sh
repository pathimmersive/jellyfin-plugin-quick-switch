#!/usr/bin/env bash
# Smoke test: build the plugin, load it into a real Jellyfin 12.x container,
# and check what the server reports and serves, without File Transformation,
# with it, and under a BaseUrl. Exits non-zero on the first failed check and
# always removes the container.
#
# Needs: bash, curl, docker, unzip, md5sum, the .NET 10 SDK.
# Override the image with JELLYFIN_IMAGE=jellyfin/jellyfin:<tag>.
set -euo pipefail

IMAGE="${JELLYFIN_IMAGE:-jellyfin/jellyfin:12.2.20261005-225228}"
PLUGIN_NAME="Quick Switch"
PLUGIN_VERSION="0.1.0.0"
PLUGIN_DIR="QuickSwitch_$PLUGIN_VERSION"
ADMIN_USER="smoke"
ADMIN_PW="smoke-$RANDOM$RANDOM"
CLIENT_HEADER='MediaBrowser Client="quickswitch-smoke", Device="smoke", DeviceId="quickswitch-smoke", Version="1.0.0"'
SCRIPT_PATH="QuickSwitch/quick-switch.js"

# The pinned File Transformation release, built for the image's server version.
# The MD5 is the one in its publisher's plugin repository manifest.
FT_VERSION="3.0.2.0"
FT_SERVER_VERSION="12.2.0"
FT_URL="https://github.com/IAmParadox27/jellyfin-plugin-file-transformation/releases/download/$FT_VERSION/Release-$FT_SERVER_VERSION.zip"
FT_MD5="76eae3b09a42dba7992820fa8f6a4584"

repo="$(cd "$(dirname "$0")/.." && pwd)"
work="$(mktemp -d)"
container="quickswitch-smoke-$$"

cleanup() {
    docker rm -f "$container" >/dev/null 2>&1 || true
    rm -rf "$work"
}
trap cleanup EXIT

fail() { echo "FAIL: $*" >&2; exit 1; }
pass() { echo "PASS: $*"; }

# Docker Desktop on Windows needs a Windows path for bind mounts.
hostpath() { if command -v cygpath >/dev/null 2>&1; then cygpath -m "$1"; else echo "$1"; fi; }

# First value of a string field in a JSON body. Enough for the flat
# responses checked here; not a JSON parser.
json_str() { grep -o "\"$1\":\"[^\"]*\"" | head -1 | sed "s/^\"$1\":\"\(.*\)\"$/\1/" || true; }

# --- build -----------------------------------------------------------------

project="$repo/src/Jellyfin.Plugin.QuickSwitch/Jellyfin.Plugin.QuickSwitch.csproj"
plugin_dir="$work/plugins/$PLUGIN_DIR"
dotnet publish "$project" -c Release -o "$plugin_dir" --nologo -v quiet >/dev/null || fail "dotnet publish"
[ -f "$plugin_dir/Jellyfin.Plugin.QuickSwitch.dll" ] || fail "plugin assembly missing from publish output"
grep -q '"targetAbi": *"12.0.0.0"' "$plugin_dir/meta.json" || fail "meta.json does not declare targetAbi 12.0.0.0"
pass "plugin built; meta.json declares targetAbi 12.0.0.0"

ft_cache="${XDG_CACHE_HOME:-$HOME/.cache}/quick-switch/FileTransformation-$FT_VERSION.zip"
if [ ! -f "$ft_cache" ] || [ "$(md5sum "$ft_cache" | cut -d' ' -f1)" != "$FT_MD5" ]; then
    mkdir -p "$(dirname "$ft_cache")"
    curl -sSfL -o "$ft_cache" "$FT_URL" || fail "download File Transformation $FT_VERSION"
fi
[ "$(md5sum "$ft_cache" | cut -d' ' -f1)" = "$FT_MD5" ] || fail "File Transformation $FT_VERSION does not match its published MD5"
mkdir -p "$work/ft"
unzip -q -o "$ft_cache" -d "$work/ft"

# --- server ----------------------------------------------------------------

MSYS_NO_PATHCONV=1 docker run -d --name "$container" \
    -p 127.0.0.1::8096 \
    -v "$(hostpath "$plugin_dir"):/config/plugins/$PLUGIN_DIR" \
    -v "$(hostpath "$work/ft"):/quickswitch-ft:ro" \
    "$IMAGE" >/dev/null || fail "docker run $IMAGE"

base_url() { echo "http://127.0.0.1:$(docker port "$container" 8096/tcp | head -1 | sed 's/.*://')$1"; }

wait_ready() {
    local url="$1"
    # While starting, the server answers with an HTML holding page, so a
    # status code alone is not enough; wait for the JSON system info.
    for _ in $(seq 1 120); do
        if curl -sf "$url/System/Info/Public" 2>/dev/null | grep -q '"StartupWizardCompleted"'; then
            return 0
        fi
        sleep 1
    done
    docker logs "$container" 2>&1 | tail -40 >&2
    fail "server at $url did not become ready"
}

restart() {
    docker restart "$container" >/dev/null || fail "docker restart"
    wait_ready "$(base_url "$1")"
}

base="$(base_url "")"
wait_ready "$base"
pass "server ready on $IMAGE"

post_json() { curl -sf -X POST -H 'Content-Type: application/json' -H "Authorization: $CLIENT_HEADER" "$@"; }
post_json "$base/Startup/Configuration" -d '{"UICulture":"en-US","MetadataCountryCode":"US","PreferredMetadataLanguage":"en"}' >/dev/null || fail "startup configuration"
curl -sf -H "Authorization: $CLIENT_HEADER" "$base/Startup/User" >/dev/null || fail "startup user (get)"
post_json "$base/Startup/User" -d "{\"Name\":\"$ADMIN_USER\",\"Password\":\"$ADMIN_PW\"}" >/dev/null || fail "startup user (set)"
post_json "$base/Startup/RemoteAccess" -d '{"EnableRemoteAccess":true}' >/dev/null || fail "startup remote access"
post_json "$base/Startup/Complete" >/dev/null || fail "startup complete"

token="$(post_json "$base/Users/AuthenticateByName" -d "{\"Username\":\"$ADMIN_USER\",\"Pw\":\"$ADMIN_PW\"}" | json_str AccessToken)"
[ -n "$token" ] || fail "no access token from /Users/AuthenticateByName"
token_header="$CLIENT_HEADER, Token=\"$token\""

get_status() { curl -s -o "$work/body" -w '%{http_code}' "$@"; }

# --- checks ----------------------------------------------------------------

check_plugin_active() {
    local prefix="$1" name="$2"
    code="$(get_status -H "Authorization: $token_header" "$prefix/Plugins")"
    [ "$code" = "200" ] || { docker logs "$container" 2>&1 | grep -A8 -E "ERR|Error" | tail -30 >&2; fail "GET /Plugins returned $code"; }
    entry="$(sed 's/},{/}\n{/g' "$work/body" | grep "\"Name\":\"$name\"" || true)"
    [ -n "$entry" ] || fail "$name not listed by /Plugins"
    status="$(echo "$entry" | json_str Status)"
    [ "$status" = "Active" ] || fail "$name status is '$status', expected Active"
    pass "/Plugins lists $name as Active"
}

check_no_create_error() {
    # Read the whole log first: grep -q stops early, and under pipefail the cut-off
    # docker logs would fail the check.
    docker logs "$container" > "$work/server.log" 2>&1
    if grep -q 'Error creating Jellyfin.Plugin.QuickSwitch' "$work/server.log"; then
        fail "the server log has an error creating the plugin"
    fi
    pass "the server log has no error creating the plugin"
}

check_script_served() {
    local prefix="$1"
    code="$(curl -s -D "$work/headers" -o "$work/script" -w '%{http_code}' "$prefix/$SCRIPT_PATH")"
    [ "$code" = "200" ] || fail "anonymous GET $prefix/$SCRIPT_PATH returned $code"
    grep -i -q '^content-type: *text/javascript' "$work/headers" || fail "GET $prefix/$SCRIPT_PATH is not text/javascript"
    cmp -s "$work/script" "$repo/src/switcher/quick-switch.js" || fail "GET $prefix/$SCRIPT_PATH is not src/switcher/quick-switch.js"
    grep -i -q '^cache-control: *no-cache' "$work/headers" || fail "GET $prefix/$SCRIPT_PATH has no Cache-Control: no-cache"
    etag="$(grep -i '^etag:' "$work/headers" | sed 's/^[^:]*: *//' | tr -d '\r')"
    [ -n "$etag" ] || fail "GET $prefix/$SCRIPT_PATH has no ETag"
    # curl creates the output file only when a body arrives, so start from none.
    rm -f "$work/not-modified"
    code="$(curl -s -o "$work/not-modified" -w '%{http_code}' -H "If-None-Match: $etag" "$prefix/$SCRIPT_PATH")"
    [ "$code" = "304" ] || fail "GET $prefix/$SCRIPT_PATH with its ETag returned $code, expected 304"
    [ ! -s "$work/not-modified" ] || fail "the 304 for $prefix/$SCRIPT_PATH has a body"
    pass "anonymous GET $prefix/$SCRIPT_PATH serves src/switcher/quick-switch.js as text/javascript, no-cache, with an ETag that gets 304"
}

check_web_stock() {
    local prefix="$1"
    curl -sf -o "$work/served" "$prefix/web/index.html" || fail "GET $prefix/web/index.html"
    MSYS_NO_PATHCONV=1 docker exec "$container" cat /jellyfin/jellyfin-web/index.html > "$work/stock" || fail "read the stock index.html"
    cmp -s "$work/served" "$work/stock" || fail "$prefix/web/index.html differs from the stock file without File Transformation"
    pass "without File Transformation, $prefix/web/index.html is byte-for-byte the stock file"
}

check_web_patched() {
    local prefix="$1"
    curl -sf -o "$work/served" "$prefix/web/index.html" || fail "GET $prefix/web/index.html"
    local tag="<script src=\"../QuickSwitch/quick-switch.js?v=$PLUGIN_VERSION\"></script>"
    count="$(grep -o '<script src="../QuickSwitch/quick-switch.js[^"]*"></script>' "$work/served" | wc -l | tr -d ' ')"
    [ "$count" = "1" ] || fail "$prefix/web/index.html carries $count switcher script tags, expected 1"
    grep -q -F "$tag</head>" "$work/served" || fail "$prefix/web/index.html does not carry $tag right before </head>"
    pass "with File Transformation, $prefix/web/index.html carries one switcher tag for version $PLUGIN_VERSION before </head>"
}

# Without File Transformation: the plugin loads, serves its script, and leaves jellyfin-web alone.
check_plugin_active "$base" "$PLUGIN_NAME"
check_no_create_error
check_script_served "$base"
check_web_stock "$base"
grep -q 'File Transformation 3.x is not installed' "$work/server.log" \
    || fail "without File Transformation the plugin did not log that the switcher is not added"
pass "without File Transformation the plugin logs that the switcher is not added"

# With File Transformation.
MSYS_NO_PATHCONV=1 docker exec "$container" cp -r /quickswitch-ft "/config/plugins/FileTransformation_$FT_VERSION" || fail "install File Transformation"
restart ""
base="$(base_url "")"
check_plugin_active "$base" "File Transformation"
check_plugin_active "$base" "$PLUGIN_NAME"
check_no_create_error
check_web_patched "$base"

# Under a BaseUrl.
code="$(get_status -H "Authorization: $token_header" "$base/System/Configuration/network")"
[ "$code" = "200" ] || fail "GET network configuration returned $code"
sed 's/"BaseUrl":"[^"]*"/"BaseUrl":"\/jf"/' "$work/body" > "$work/network.json"
grep -q '"BaseUrl":"/jf"' "$work/network.json" || fail "could not set BaseUrl in network configuration"
curl -sf -X POST -H 'Content-Type: application/json' -H "Authorization: $token_header" \
    --data-binary "@$work/network.json" "$base/System/Configuration/network" >/dev/null || fail "POST network configuration"
restart "/jf"
base="$(base_url "/jf")"
check_script_served "$base"
check_web_patched "$base"

echo "smoke-test: all checks passed"
