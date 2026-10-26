# Contributing to Quick Switch

Thanks for your interest. Quick Switch is in early development, so please open an issue to discuss a change before starting on a pull request.

## Reporting a problem

Open an issue with the bug report template. Include the Jellyfin server version, the Quick Switch version or commit, the client app and device, and the steps that show the problem. Security problems go through private reporting instead; see [SECURITY.md](SECURITY.md).

## Making a change

1. Fork the repository and branch from `main`, naming the branch `<type>/<short-name>`, for example `fix/webos-back-key`.
2. Build and test as the [README](README.md#building-and-testing) describes. A change should pass `dotnet test`, the switcher tests and `bash scripts/check-community-files.sh`. Note anything checked by hand, with the client, device and Jellyfin version.
3. Write the pull request title as a [Conventional Commits](https://www.conventionalcommits.org/) subject: `feat:`, `fix:`, `docs:`, `test:`, `ci:` or `chore:`, then what changed, in 72 characters or fewer.
4. Fill in the pull request template: what changed and why, and how it was checked. Link a related issue with `Fixes #N`.
5. CI must pass before the change can merge. Pull requests are squash-merged, so the title and description become the commit on `main`.

The switcher script in `src/switcher` is plain ES5 with no build step, because TV apps run older browser engines. Keep it that way.

## Third-party code

Only code under licenses compatible with GPL-3.0 can be added. New third-party code needs an entry in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) with its version, copyright line and full license text.

## License

By contributing you agree that your contribution is licensed under the GNU General Public License v3.0 or later, the license of this project.

Everyone taking part is expected to follow the [Code of Conduct](CODE_OF_CONDUCT.md).
