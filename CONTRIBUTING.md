# Contributing to Quick Switch

Thanks for your interest. Quick Switch is in early development, so please open an issue to discuss a change before starting on a pull request.

## Reporting a problem

Open an issue with the bug report template. Include the Jellyfin server version, the Quick Switch version or commit, the client app and device, and the steps that show the problem. Security problems go through private reporting instead; see [SECURITY.md](SECURITY.md).

## Making a change

1. Fork the repository and branch from `main`, naming the branch `<type>/<short-name>`, for example `fix/webos-back-key`.
2. Build and test as the [README](README.md#building-and-testing) describes. A change should pass `dotnet test`, the switcher tests, `bash scripts/check-community-files.sh` and, for server changes, `bash scripts/smoke-test.sh`. A change to packaging should also pass `bash scripts/repo-install-check.sh`, which installs the plugin on Jellyfin from a local plugin repository. Note anything checked by hand, with the client, device and Jellyfin version.
3. Write the pull request title as a [Conventional Commits](https://www.conventionalcommits.org/) subject: `feat:`, `fix:`, `docs:`, `test:`, `ci:` or `chore:`, then what changed, in 72 characters or fewer.
4. Fill in the pull request template: what changed and why, and how it was checked. Link a related issue with `Fixes #N`.
5. CI must pass before the change can merge. Pull requests are squash-merged into one commit on `main`, built from the pull request's commits, so give them Conventional Commits messages too.

The switcher script in `src/switcher` is plain ES5 with no build step, because TV apps run older browser engines. Keep it that way.

## Releases

Releases are cut by a maintainer, and only when there is something worth shipping. Nothing is released from `main` automatically.

1. Set `<Version>` in `src/Jellyfin.Plugin.QuickSwitch/Jellyfin.Plugin.QuickSwitch.csproj` and `PLUGIN_VERSION` in `scripts/smoke-test.sh` to the new version, and merge that change.
2. Tag the merge commit with an annotated tag whose message is the changelog line, for example `git tag -a v0.2.0.0 -m "Summary of the changes"`, and push the tag.
3. The Release workflow packages the plugin, checks nothing is published under that tag yet, and publishes the zip with its manifest entry. The Pages workflow then rebuilds `manifest.json` from every release.

GitHub Pages must be set to deploy from GitHub Actions before the first release. A published release is never replaced; a fix ships as a new version.

## Third-party code

Only code under licenses compatible with GPL-3.0 can be added. New third-party code needs an entry in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) with its version, copyright line and full license text.

## License

By contributing you agree that your contribution is licensed under the GNU General Public License v3.0 or later, the license of this project.

Everyone taking part is expected to follow the [Code of Conduct](CODE_OF_CONDUCT.md).
