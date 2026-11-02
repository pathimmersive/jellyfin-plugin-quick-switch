#!/usr/bin/env bash
# Prints one version's section of CHANGELOG.md, without its heading, for the
# release notes and the plugin manifest's changelog.
#
# Usage: scripts/changelog.sh <version> [changelog-file]
#   version         x.y.z, with or without a leading v (a tag works)
#   changelog-file  defaults to CHANGELOG.md at the repository root
#
# Exits non-zero if the version has no section, or its section is empty.
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "usage: $0 <version> [changelog-file]" >&2
  exit 2
fi
version="${1#v}"
file="${2:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/CHANGELOG.md}"

section="$(awk -v want="## [$version]" '
  index($0, want) == 1 { found = 1; next }
  found && /^## \[/ { exit }
  found { print }
' "$file" | sed -e '/./,$!d' | sed -e ':a' -e '/^\n*$/{$d;N;ba' -e '}')"

if [[ -z "$section" ]]; then
  echo "CHANGELOG.md has no section for $version; add \"## [$version] - YYYY-MM-DD\" with its changes" >&2
  exit 1
fi
printf '%s\n' "$section"
