#!/usr/bin/env bash
# Stops a release unless its tag is safe to publish: the tagged commit is on
# main, ci.yml succeeded for it on main, and the tag is the version in the
# tagged commit's csproj. The Release workflow runs it before packaging.
#
# Usage: scripts/check-release-tag.sh <tag>
#        scripts/check-release-tag.sh --dry-run [<revision>]
#   <tag>       a version tag, v1.2.3 or v1.2.3.4
#   --dry-run   checks <revision> (default origin/main) as if it were tagged
#               with its own csproj version
#
# Needs: git, and gh signed in or GH_TOKEN set. The repository comes from
# GITHUB_REPOSITORY, or else from the origin remote.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"
project="src/Jellyfin.Plugin.QuickSwitch/Jellyfin.Plugin.QuickSwitch.csproj"

fail() {
  echo "check-release-tag: $*" >&2
  exit 1
}

git fetch --quiet origin main
case "${1:-}" in
  --dry-run)
    commit="$(git rev-parse --verify "${2:-origin/main}^{commit}")" || fail "no revision ${2:-origin/main}"
    tag="v$(git show "$commit:$project" | grep -o '<Version>[^<]*' | head -n 1 | sed 's/<Version>//')"
    ;;
  v*)
    tag="$1"
    commit="$(git rev-parse --verify "$tag^{commit}")" || fail "no tag $tag"
    ;;
  *)
    echo "usage: $0 <tag> | --dry-run [<revision>]" >&2
    exit 2
    ;;
esac
short="${commit:0:7}"

# The version the tagged commit builds, against the tag without its v, as four parts.
version="$(git show "$commit:$project" | grep -o '<Version>[^<]*' | head -n 1 | sed 's/<Version>//')"
wanted="${tag#v}"
if [[ "$wanted" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  wanted="$wanted.0"
fi
[[ "$wanted" == "$version" ]] || fail "tag $tag is version $wanted, but $short's csproj says $version"

git merge-base --is-ancestor "$commit" origin/main || fail "$short is not on main"

# The newest finished ci.yml run for that commit on main.
repository="${GITHUB_REPOSITORY:-$(git remote get-url origin | sed -E 's#^.*github\.com[:/]##; s#\.git$##')}"
conclusion="$(gh api "repos/$repository/actions/workflows/ci.yml/runs?head_sha=$commit&branch=main&status=completed&per_page=1" \
  --jq '.workflow_runs[0].conclusion // "none"')" || fail "could not read ci.yml's runs for $short"
[[ "$conclusion" == "success" ]] || fail "ci.yml on main did not succeed for $short (newest run: $conclusion)"

echo "check-release-tag: $tag is $short on main, ci.yml passed for it, and its csproj says $version"
