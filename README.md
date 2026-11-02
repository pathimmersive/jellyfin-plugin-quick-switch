# Quick Switch

Quick Switch is a Jellyfin server plugin that adds fast switching between Jellyfin accounts on a shared device, like the profile pickers on streaming services. Each person keeps their own Jellyfin account; on a shared TV, changing who is watching takes one selection instead of signing out and typing a password with the remote.

**Quick Switch is an unofficial, third-party plugin.** It is not made, endorsed or supported by the Jellyfin project, and it does not use the Jellyfin logo.

## Status

Early development; there is no release yet and the switcher is not usable. The plugin builds, adds its script to jellyfin-web as the page is served, and does nothing else so far.

## How it will work

- A **Switch account** entry in jellyfin-web opens the switcher.
- The switcher shows a tile for each account saved on this device and marks the current one.
- **+** opens the normal Jellyfin sign-in page, with password or Quick Connect, without signing the current account out. Once signed in, that account is saved to this device.
- Selecting a saved account switches to it immediately, with no password.
- **Edit** removes an account from this device.
- Everything works with a TV remote (arrows, OK, Back) as well as mouse, touch and keyboard.

Accounts are opt-in and per device: an account appears in a device's switcher only after someone has signed into it on that device. There are no sub-profiles, households or PINs, and nothing is stored on the server.

## Security model

Quick Switch saves each account's Jellyfin access token on the device, in the same browser storage where jellyfin-web already keeps the signed-in account's token. **Anyone using that device can switch to any account saved on it, without a password.** That is the intended behaviour; only save accounts on devices whose users you trust with them.

A saved account stops working, and asks for its password again, when its password is changed, its device is deleted in **Dashboard → Devices**, or the account is disabled. Removing an account in **Manage Accounts** signs it out on that device and leaves the other accounts signed in. Jellyfin's own **Sign out** signs out only the account signed in now; the others stay saved until they are removed.

- **Administrator accounts:** saving one on a shared device gives everyone who uses that device the server's Dashboard. Keep administrator accounts off devices other people use.
- **HTTPS:** reach your server over HTTPS, so access tokens never cross the network in clear.
- **Other plugins and custom JavaScript:** anything else that runs inside jellyfin-web on your server can read the accounts saved on a device, just as it can read the signed-in one. Only install plugins you trust.

## Compatibility

Quick Switch runs in clients that load jellyfin-web from your server: web browsers, the LG webOS app, the official Android and iOS apps, and Jellyfin Desktop. It cannot run in clients that bundle their own copy of jellyfin-web, such as the Samsung Tizen store app, or in native clients such as Android TV, Roku, Swiftfin and Infuse. The Android TV app already switches between users who have signed in on it.

## Requirements

- Jellyfin 12.0 or later. The build targets 12.2.
- No other plugins. Quick Switch adds its script to jellyfin-web as the page is served and never changes jellyfin-web's files. It also works alongside the [File Transformation](https://github.com/IAmParadox27/jellyfin-plugin-file-transformation) plugin, which other plugins use.

## Building and testing

You need the .NET 10 SDK, Node.js 22 or later, and bash.

```bash
dotnet test                            # builds the plugin and runs its tests
node --test "tests/switcher/*.test.js" # switcher script tests
bash scripts/check-community-files.sh  # community files
bash scripts/coverage.sh               # both test suites, with a coverage summary
```

`bash scripts/smoke-test.sh` also needs Docker. It loads the plugin into a real Jellyfin server, on its own, alongside [File Transformation](https://github.com/IAmParadox27/jellyfin-plugin-file-transformation) and under a BaseUrl, and checks what the server reports and serves. CI runs it on every pull request.

## Contributing and security

See [CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md). Report security problems privately, as [SECURITY.md](SECURITY.md) describes.

## License

Quick Switch is licensed under the GNU General Public License v3.0 or later; see [LICENSE](LICENSE). Third-party code keeps its own license; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
