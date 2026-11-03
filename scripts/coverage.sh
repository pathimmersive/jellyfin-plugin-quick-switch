#!/usr/bin/env bash
# Runs the plugin and switcher tests with coverage and prints a summary of
# each. It reports coverage; it does not fail on a percentage. It fails if a
# test fails or a report is missing.
#
# Usage: scripts/coverage.sh [--browser]
#
# --browser also runs the browser tests (npm run test:browser) and prints
# their coverage of the switcher; CI does this in its browser job.
#
# Needs: bash, the .NET 10 SDK, Node.js 22 or later; Docker, npm ci and a
# Chromium-based browser for --browser.
set -euo pipefail

case "${1:-}" in
    "") browser=0 ;;
    --browser) browser=1 ;;
    *) echo "usage: $0 [--browser]" >&2; exit 2 ;;
esac

repo="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo"
out="$(mktemp -d)"
trap 'rm -rf "$out"' EXIT

fail() { echo "FAIL: $*" >&2; exit 1; }

dotnet test --collect "Code Coverage;Format=cobertura" --results-directory "$out"
report="$(find "$out" -name '*.cobertura.xml' | head -1)"
[ -n "$report" ] || fail "dotnet test wrote no coverage report"

# The plugin's package only, not the test assembly's.
package="$(grep -o '<package [^>]*name="Jellyfin.Plugin.QuickSwitch"[^>]*>' "$report" || true)"
[ -n "$package" ] || fail "the coverage report has no Jellyfin.Plugin.QuickSwitch package"
rate() { echo "$package" | sed -E "s/.* $1=\"([0-9.]+)\".*/\1/" | awk '{ printf "%.1f%%", $1 * 100 }'; }

node --test --experimental-test-coverage "tests/switcher/*.test.js" | tee "$out/switcher.txt"
switcher="$(grep -E '^.{0,4}[[:space:]]*quick-switch\.js[[:space:]]*\|' "$out/switcher.txt" || true)"
[ -n "$switcher" ] || fail "the switcher coverage report does not include quick-switch.js"
column() { echo "$switcher" | awk -F'|' -v n="$1" '{ gsub(/ /, "", $n); print $n "%" }'; }

if [ "$browser" -eq 1 ]; then
    QS_COVERAGE="$out/browser" npm run -s test:browser
fi

echo
echo "Coverage"
echo "  plugin   lines $(rate line-rate), branches $(rate branch-rate)"
echo "  switcher lines $(column 2), branches $(column 3), functions $(column 4)"
[ "$browser" -eq 0 ] || node tests/browser/coverage.js "$out/browser"
