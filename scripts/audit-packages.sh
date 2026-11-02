#!/usr/bin/env bash
# Fails if any NuGet package the plugin or its tests resolve, directly or
# transitively, has a known vulnerability, and lists each one with its
# severity and advisory. CI runs it on every change and weekly, so a new
# advisory against a pinned package shows up without a push.
#
# Usage: scripts/audit-packages.sh [solution-or-project]
#   (default: the repository's solution)
#
# Needs: bash, the .NET 10 SDK, Node.js.
set -euo pipefail

repo="$(cd "$(dirname "$0")/.." && pwd)"
target="${1:-$repo/Jellyfin.Plugin.QuickSwitch.slnx}"
report="$(mktemp)"
trap 'rm -f "$report"' EXIT

fail() { echo "FAIL: $*" >&2; exit 1; }

dotnet restore "$target" --nologo -v quiet >/dev/null || fail "dotnet restore $target"
dotnet package list --project "$target" --vulnerable --include-transitive --format json --no-restore > "$report" \
    || fail "dotnet package list --vulnerable for $target"

node -e '
    const report = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
    const found = new Set();
    for (const p of report.projects || []) {
        for (const f of p.frameworks || []) {
            for (const pkg of [...(f.topLevelPackages || []), ...(f.transitivePackages || [])]) {
                for (const v of pkg.vulnerabilities || []) {
                    found.add(`${pkg.id} ${pkg.resolvedVersion}: ${v.severity}, ${v.advisoryurl}`);
                }
            }
        }
    }
    const problems = [...(report.problems || [])].map((p) => p.text).filter(Boolean);
    problems.forEach((t) => console.error(`FAIL: ${t}`));
    found.forEach((line) => console.error(`FAIL: vulnerable package ${line}`));
    if (found.size || problems.length) { process.exit(1); }
    const projects = (report.projects || []).length;
    console.log(`audit-packages: no known vulnerabilities in the packages of ${projects} project(s)`);
' "$report"
