# Security policy

## Reporting a vulnerability

Please do not open a public issue for a security problem. Report it privately through GitHub instead: on this repository's **Security** tab, choose **Report a vulnerability**. Only the maintainers can see the report.

Include what is affected, the Jellyfin server version, the Quick Switch version or commit, the client app and device, and the steps to reproduce it. You will get a reply in the report, and the fix and its advisory are coordinated there.

## Supported versions

Quick Switch has no release yet. Fixes go into `main`; once releases exist, the latest release is supported.

## Scope

Quick Switch keeps Jellyfin access tokens for the accounts saved on a device, in that device's browser storage. In scope: a token reaching anyone other than a user of that device, a switch to an account that was never saved on the device, a token surviving removal from the switcher, and the plugin revoking or altering accounts it should not touch.

By design, anyone using a device can switch to any account saved on it without a password; that is not a vulnerability. Problems in Jellyfin itself, or in other plugins, belong with those projects.
