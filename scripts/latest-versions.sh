#!/usr/bin/env bash
# Finds the newest Jellyfin and File Transformation to check the plugin
# against, and prints them as KEY=value lines:
#
#   JELLYFIN_VERSION    newest stable Jellyfin.Controller package on NuGet
#   JELLYFIN_IMAGE      jellyfin/jellyfin:latest, pinned by digest
#   JELLYFIN_SERVER     the image's server version (major.minor)
#   FT_VERSION          newest File Transformation release built for that server
#   FT_SERVER_VERSION   the server version that build targets
#   FT_URL, FT_MD5      where to download it and its MD5, from its publisher's manifest
#
# Usage: scripts/latest-versions.sh
#
# Needs: bash, curl, docker, Node.js. Pulls jellyfin/jellyfin:latest.
set -euo pipefail

NUGET_INDEX="https://api.nuget.org/v3-flatcontainer/jellyfin.controller/index.json"
FT_MANIFEST="https://www.iamparadox.dev/jellyfin/plugins/manifest.json"
FT_GUID="5e87cc92-571a-4d8d-8d98-d2d4147f9f90"

fail() { echo "FAIL: $*" >&2; exit 1; }

package="$(curl -sSf "$NUGET_INDEX" | node -e '
    let s = ""; process.stdin.on("data", (d) => { s += d; }).on("end", () => {
        const stable = JSON.parse(s).versions.filter((v) => /^\d+\.\d+\.\d+$/.test(v));
        const key = (v) => v.split(".").map(Number);
        stable.sort((a, b) => { const x = key(a), y = key(b); return x[0] - y[0] || x[1] - y[1] || x[2] - y[2]; });
        console.log(stable.pop() || "");
    });')" || fail "read the Jellyfin.Controller versions from NuGet"
[[ "$package" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || fail "no stable Jellyfin.Controller version on NuGet"

docker pull -q jellyfin/jellyfin:latest >/dev/null || fail "docker pull jellyfin/jellyfin:latest"
image="$(docker image inspect jellyfin/jellyfin:latest --format '{{index .RepoDigests 0}}')"
[[ "$image" =~ ^jellyfin/jellyfin@sha256:[0-9a-f]{64}$ ]] || fail "jellyfin/jellyfin:latest has no digest"
server="$(docker image inspect jellyfin/jellyfin:latest --format '{{index .Config.Labels "org.opencontainers.image.version"}}')"
[[ "$server" =~ ^[0-9]+\.[0-9]+$ ]] || fail "jellyfin/jellyfin:latest does not label its server version"

# The newest release with a build for this server version, or, failing that,
# its newest build for an older one.
ft="$(curl -sSf "$FT_MANIFEST" | node -e '
    const [guid, server] = process.argv.slice(1);
    let s = ""; process.stdin.on("data", (d) => { s += d; }).on("end", () => {
        const plugin = JSON.parse(s).find((p) => p.guid === guid);
        const key = (v) => v.split(".").map(Number);
        const cmp = (a, b) => { const x = key(a), y = key(b); for (let i = 0; i < 4; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); } return 0; };
        const fits = (plugin ? plugin.versions : []).filter((v) => cmp(v.targetAbi, server + ".0.0") <= 0);
        fits.sort((a, b) => cmp(b.version, a.version) || cmp(b.targetAbi, a.targetAbi));
        const v = fits[0];
        if (v) console.log([v.version, v.sourceUrl, v.checksum.toLowerCase()].join(" "));
    });' "$FT_GUID" "$server")" || fail "read File Transformation's manifest"
read -r ft_version ft_url ft_md5 <<< "$ft"
[[ "$ft_version" =~ ^[0-9.]+$ && "$ft_md5" =~ ^[0-9a-f]{32}$ ]] || fail "no File Transformation release for Jellyfin $server"
[[ "$ft_url" =~ ^https://github\.com/IAmParadox27/jellyfin-plugin-file-transformation/releases/download/[0-9.]+/Release-([0-9.]+)\.zip$ ]] \
    || fail "File Transformation $ft_version is not downloaded from its GitHub releases"
ft_server="${BASH_REMATCH[1]}"

echo "JELLYFIN_VERSION=$package"
echo "JELLYFIN_IMAGE=$image"
echo "JELLYFIN_SERVER=$server"
echo "FT_VERSION=$ft_version"
echo "FT_SERVER_VERSION=$ft_server"
echo "FT_URL=$ft_url"
echo "FT_MD5=$ft_md5"
