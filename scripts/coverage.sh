#!/usr/bin/env bash
# Runs the plugin and switcher tests with coverage and prints a summary of
# each. It reports coverage; it does not fail on a percentage. It fails if a
# test fails or a report is missing.
#
# Usage: scripts/coverage.sh
#
# Needs: bash, the .NET 10 SDK, Node.js 22 or later.
set -euo pipefail

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

echo
echo "Coverage"
echo "  plugin   lines $(rate line-rate), branches $(rate branch-rate)"
echo "  switcher lines $(column 2), branches $(column 3), functions $(column 4)"
