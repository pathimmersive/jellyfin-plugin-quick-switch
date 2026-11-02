# Contributing to Quick Switch

Thanks for your interest. Quick Switch is in early development, so please open an issue or start a discussion about a change before starting on a pull request.

## Asking, suggesting and reporting

- **Questions** about installing, setting up or using Quick Switch go in [Discussions → Q&A](https://github.com/pathimmersive/jellyfin-plugin-quick-switch/discussions/categories/q-a).
- **Ideas** can be talked through in [Discussions → Ideas](https://github.com/pathimmersive/jellyfin-plugin-quick-switch/discussions/categories/ideas) before a feature request.
- **Bugs and feature requests** are issues, opened with their forms.

For a bug, use the bug report form. Include the Jellyfin server version, the Quick Switch version or commit, the client app and device, and the steps that show the problem. Security problems go through private reporting instead; see [SECURITY.md](SECURITY.md).

## Making a change

1. Fork the repository and branch from `main`, naming the branch `<type>/<short-name>`, for example `fix/webos-back-key`.
2. Build and test as the [README](README.md#building-and-testing) describes. A change should pass `dotnet test`, the switcher tests, `bash scripts/check-community-files.sh` and, for server changes, `bash scripts/smoke-test.sh`. A change to packaging should also pass `bash scripts/repo-install-check.sh` and `bash scripts/repo-install-check.sh --upgrade`, which install the plugin on Jellyfin from a plugin repository and upgrade it to a newer version. Note anything checked by hand, with the client, device and Jellyfin version. `bash scripts/coverage.sh` runs both test suites and prints their coverage, as CI does; a new behaviour should come with a test, but no coverage percentage fails a build.
3. Write the pull request title as a [Conventional Commits](https://www.conventionalcommits.org/) subject: `feat:`, `fix:`, `docs:`, `test:`, `ci:` or `chore:`, then what changed, in 72 characters or fewer.
4. Fill in the pull request template: what changed and why, and how it was checked. Link a related issue with `Fixes #N`.
5. For a change users would notice, add a line under **Unreleased** in [CHANGELOG.md](CHANGELOG.md), in the section that fits (Added, Changed, Fixed, Removed, Security).
6. CI must pass before the change can merge. Pull requests are squash-merged into one commit on `main`, built from the pull request's commits, so give them Conventional Commits messages too.

The switcher script in `src/switcher` is plain ES5 with no build step, because TV apps run older browser engines. Keep it that way.

## Following Jellyfin releases

Jellyfin, jellyfin-web and File Transformation change on their own schedules, so the plugin is checked against their newest releases every week.

- **Noticing.** The Canary workflow runs every Monday. It builds and tests the plugin against the newest Jellyfin packages on NuGet, then runs `bash scripts/smoke-test.sh --latest`: the smoke test on the newest `jellyfin/jellyfin` image, with the newest File Transformation build for that server version in its case. `bash scripts/latest-versions.sh` prints the versions it picks. When a scheduled or manual run fails, it opens an issue titled **Canary: checks fail on the newest Jellyfin**, or comments on the one already open. Dependabot proposes updates to the other NuGet packages and the pinned GitHub Actions each week.
- **Checking.** When a new Jellyfin version comes out, run the Canary workflow by hand (Actions → Canary → Run workflow) or `bash scripts/smoke-test.sh --latest`. Then try the switcher on that version in a browser: open it, switch, add an account, reorder and remove one. A fix to the switcher is also tried in a TV app. Note what you checked, and on which versions, in the pull request.
- **Rolling out.** A fix ships as a new plugin version, as [Releases](#releases) describes, with a changelog line naming the Jellyfin version it fixes. Raise `JellyfinVersion` in `Directory.Build.props` and `JellyfinTargetAbi` in the project file only when the plugin needs something older servers lack: a server older than `targetAbi` refuses the plugin, so say so under **Changed** in the changelog and in the README's requirements. When most users have moved to a newer Jellyfin, move the pinned image in `scripts/smoke-test.sh` and `scripts/repo-install-check.sh`, and the File Transformation release in `scripts/smoke-test.sh`, to it in a pull request of its own.

## Releases

Releases are cut by a maintainer, and only when there is something worth shipping. Nothing is released from `main` automatically.

1. Set `<Version>` in `src/Jellyfin.Plugin.QuickSwitch/Jellyfin.Plugin.QuickSwitch.csproj` and `PLUGIN_VERSION` in `scripts/smoke-test.sh` to the new version, rename **Unreleased** in `CHANGELOG.md` to the version and date (for example `## [0.2.0.0] - 2026-12-01`) with a new empty **Unreleased** above it, and merge that change.
2. Tag the merge commit with the same version, for example `git tag -a v0.2.0.0 -m "Quick Switch 0.2.0.0"`, and push the tag.
3. The Release workflow takes that version's `CHANGELOG.md` section as the release notes and the manifest's changelog, and stops if there is none. It packages the plugin, checks nothing is published under that tag yet, and publishes the zip with its manifest entry. The Pages workflow then rebuilds `manifest.json` from every release.

GitHub Pages must be set to deploy from GitHub Actions before the first release. A published release is never replaced; a fix ships as a new version.

## Third-party code

Only code under licenses compatible with GPL-3.0 can be added. New third-party code needs an entry in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) with its version, copyright line and full license text.

## License

By contributing you agree that your contribution is licensed under the GNU General Public License v3.0 or later, the license of this project.

Everyone taking part is expected to follow the [Code of Conduct](CODE_OF_CONDUCT.md).
