# Quick Switch

Quick Switch is a Jellyfin server plugin that adds fast switching between Jellyfin accounts on a shared device, like the profile pickers on streaming services. Each person keeps their own Jellyfin account. On a shared TV, changing who is watching takes one selection instead of signing out and typing a password with the remote.

**Quick Switch is an unofficial, third-party plugin.** It is not made, endorsed or supported by the Jellyfin project, and it does not use the Jellyfin logo.

![The Quick Switch "Who's watching?" screen in jellyfin-web's TV layout: four saved accounts, Robin, Sam, Jordan and Alex, as round tiles, with Alex marked "Watching now", an Add Account tile, a Manage Accounts button, and remote hints for OK, Back and the red button.](images/screenshot.png)

## Requirements

- Jellyfin 12.0 or later. The build targets 12.2, and every change is tested on 12.2. The plugin is also checked each week against the newest Jellyfin release, so a new release is checked within about a week of coming out. If one breaks Quick Switch, a fix ships as a new version as soon as practical; this is an unofficial plugin maintained on a best-effort basis, so there is no deadline.
- No other plugins. Quick Switch adds its script to jellyfin-web as the page is served and never changes jellyfin-web's files. It also works alongside the [File Transformation](https://github.com/IAmParadox27/jellyfin-plugin-file-transformation) plugin, which other plugins use.
- A client that loads jellyfin-web from your server; see [Compatibility](#compatibility).

## Installing

**The first release is in preparation.** Until it is out, the repository below has nothing to install.

1. In Jellyfin, open **Dashboard → Plugins → Repositories** and add a repository named Quick Switch with this URL:

   ```text
   https://pathimmersive.github.io/jellyfin-plugin-quick-switch/manifest.json
   ```

2. Open **Dashboard → Plugins → Catalog**, select Quick Switch, and choose **Install**.
3. Restart the server.
4. Reload jellyfin-web in each browser, and close and reopen each TV or phone app, so they load the page with the switcher.

New versions come from the same repository: Jellyfin lists them under **Dashboard → Plugins**, and a server restart finishes the update. Each version's changes are in [CHANGELOG.md](CHANGELOG.md).

## Using Quick Switch

Accounts are opt-in and per device: an account appears in a device's switcher only after someone has signed into it on that device. Every account that signs in on a device with Quick Switch installed is saved there, whether through the normal sign-in page or **Add Account**. There are no sub-profiles, households or PINs, and nothing is stored on the server.

- Open the switcher from **Switch Account** in the User Menu (the account picture at the top right in a browser or phone), from the **Switch Account** row at the top of the User section in the TV layout's settings, or with the red button on a TV remote from any screen while someone is signed in.
- Select a tile to switch. jellyfin-web changes to that account at once, without a password, and goes to its home screen. The tile of the account in use is marked **Watching now**.
- **Add Account** opens Jellyfin's sign-in page, for a password or **Use Quick Connect**, without signing the current account out. Back returns to the account that was watching. Once signed in, the new account is saved on the device.
- **Manage Accounts** changes the order of the tiles and removes accounts. Select an account to move it, with the arrows on a remote or by dragging, or choose **Remove**. The account signed in now can't be removed; switch to another account first.
- A tile marked **Sign in again** belongs to an account whose saved sign-in stopped working; selecting it opens the sign-in page for that account.

Everything works with a TV remote (arrows, OK, Back) as well as mouse, touch and keyboard.

## Security model

Quick Switch saves each account's Jellyfin access token on the device, in the same browser storage where jellyfin-web already keeps the signed-in account's token. **Anyone using that device can switch to any account saved on it, without a password.** That is the intended behaviour; only save accounts on devices whose users you trust with them. A saved account is only used at the server addresses it has signed in through on that device; at a new address, such as a different host name for the same server, it asks for its password once.

A saved account stops working, and asks for its password again, when its password is changed, its device is deleted in **Dashboard → Devices**, or the account is disabled. Removing an account in **Manage Accounts** signs it out on the server for that device and leaves the other accounts signed in. Jellyfin's own **Sign Out** signs out only the account signed in now, and takes it off that device's switcher; the others stay saved until they are removed.

- **Administrator accounts:** saving one on a shared device gives everyone who uses that device the server's Dashboard. Quick Switch asks before it saves an account that manages the server; choose **Don't save** on devices other people use. Nothing in the switcher marks which saved account is an administrator.
- **HTTPS:** reach your server over HTTPS, so access tokens never cross the network in clear.
- **Other plugins and custom JavaScript:** anything else that runs inside jellyfin-web on your server can read the accounts saved on a device, just as it can read the signed-in one. Only install plugins you trust.

## Troubleshooting

- **The switcher does not appear.** Check that **Dashboard → Plugins** lists Quick Switch as active, and that the server was restarted after installing. Then reload the page, or close and reopen the app, so the client loads jellyfin-web again. A reverse proxy or CDN that caches jellyfin-web's index page can keep serving the page without the switcher; stop it caching `/web/index.html`. The red button opens the switcher only when someone is signed in, not from the sign-in page.
- **An account asks for its password again.** Its saved sign-in stopped working (see [Security model](#security-model)) and its tile shows **Sign in again**. Sign in once and it is saved again. At a new server address each account asks once, then switches without a password there too.
- **Remove says it couldn't sign the account out on the server.** The server couldn't be reached or refused, so the account is still signed in there. Choose **Try again**, **Keep**, or **Remove from this TV only**, which forgets it on the device and leaves its sign-in working on the server until its password is changed or its device is deleted in **Dashboard → Devices**.
- **Adding an account asks whether to save it.** The account manages the server. Choose **Save** only on a device you alone use; with **Don't save** it stays signed in until someone switches or signs out, and is not asked about again until it signs in again.
- **Something else.** Ask in [Discussions](https://github.com/pathimmersive/jellyfin-plugin-quick-switch/discussions) or report a bug as an [issue](https://github.com/pathimmersive/jellyfin-plugin-quick-switch/issues/new/choose), with the Jellyfin version, the Quick Switch version, and the client app and device.

## Compatibility

Quick Switch runs in clients that load jellyfin-web from your server: web browsers, the LG webOS app, the official Android and iOS apps, and Jellyfin Desktop. It is tested in web browsers and the LG webOS app. It cannot run in clients that bundle their own copy of jellyfin-web, such as the Samsung Tizen store app, or in native clients such as Android TV, Roku, Swiftfin and Infuse. The Android TV app already switches between users who have signed in on it.

## Building and testing

You need the .NET 10 SDK, Node.js 22 or later with npm, and bash. The build runs the .NET analyzers and treats their warnings as errors.

```bash
dotnet test                            # builds the plugin and runs its tests
node --test "tests/switcher/*.test.js" # switcher script tests
npm ci && npm run lint                 # ESLint on the switcher and its tests
npm run test:browser                   # the switcher in a browser (needs Docker; see below)
bash scripts/check-community-files.sh  # community files
bash scripts/coverage.sh               # both test suites, with a coverage summary (--browser adds the browser tests)
bash scripts/audit-packages.sh         # NuGet packages with known vulnerabilities
```

`bash scripts/smoke-test.sh` also needs Docker. It loads the plugin into a real Jellyfin server, on its own, alongside [File Transformation](https://github.com/IAmParadox27/jellyfin-plugin-file-transformation) and under a BaseUrl, and checks what the server reports and serves. CI runs it on every pull request; `--latest` runs it on the newest Jellyfin instead.

`npm run test:browser` also needs Docker. It starts its own Jellyfin with the plugin built from your working tree, creates test accounts, and drives jellyfin-web in Chromium through the switcher's views in the desktop and TV layouts; the container is removed afterwards. Run `npx playwright-core install chromium` once, or set `QS_BROWSER_CHANNEL=chrome` to use an installed Google Chrome (as CI does).

## Questions, contributing and security

Ask questions and share ideas in [Discussions](https://github.com/pathimmersive/jellyfin-plugin-quick-switch/discussions), and report bugs as [issues](https://github.com/pathimmersive/jellyfin-plugin-quick-switch/issues/new/choose). See [CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md). Report security problems privately, as [SECURITY.md](SECURITY.md) describes. Changes are listed in [CHANGELOG.md](CHANGELOG.md), and where the plugin is heading in [ROADMAP.md](ROADMAP.md).

## License

Quick Switch is licensed under the GNU General Public License v3.0 or later; see [LICENSE](LICENSE). Third-party code keeps its own license; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
