#!/usr/bin/env bash
# Checks that the repository carries its community files and that the README
# says the plugin is unofficial.
#
# Usage: scripts/check-community-files.sh
#
# Exits non-zero listing everything missing.
set -euo pipefail

repo="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo"
missing=0

fail() { echo "FAIL: $*" >&2; missing=$((missing + 1)); }
pass() { echo "PASS: $*"; }

for file in README.md LICENSE CONTRIBUTING.md CODE_OF_CONDUCT.md SECURITY.md THIRD_PARTY_NOTICES.md \
    .github/pull_request_template.md; do
    if [ -s "$file" ]; then pass "$file"; else fail "$file is missing or empty"; fi
done
if ls .github/ISSUE_TEMPLATE/*.md >/dev/null 2>&1; then
    pass ".github/ISSUE_TEMPLATE has an issue template"
else
    fail ".github/ISSUE_TEMPLATE has no issue template"
fi

if [ -f README.md ]; then
    if grep -q -i 'unofficial' README.md; then
        pass "README.md says the plugin is unofficial"
    else
        fail "README.md does not say the plugin is unofficial"
    fi
fi

if [ "$missing" -gt 0 ]; then
    echo "check-community-files: $missing missing" >&2
    exit 1
fi
echo "check-community-files: all present"
