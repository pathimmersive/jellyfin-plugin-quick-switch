# Changelog

All notable changes to Quick Switch are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow the plugin's version number.

## [Unreleased]

## [1.0.0.0] - 2026-11-03

The first release. It needs Jellyfin 12.2 or later.

### Added

- A switcher in jellyfin-web for the accounts saved on this device: select a tile to switch to that account without a password.
- **Add Account** signs another account in, with a password or Quick Connect, without signing the current one out.
- **Manage Accounts** removes an account from this device, signing out only that account, and changes the order of the tiles.
- Opening the switcher from the User Menu, from a row in the settings of the TV layout and of jellyfin-web's legacy desktop and mobile layouts, and with the red button on a TV remote.
- Full control with a TV remote (arrows, OK, Back) as well as mouse, touch and keyboard.
- A saved account whose sign-in stopped working asks for its password again.
- Before an account that manages the server is saved on a device, Quick Switch asks whether to save it, with **Don't save** as the default; a saved account later made an administrator is asked about too.
- A sign-in with **Remember me** unticked is not saved on the device.
- Signing out with Jellyfin's own Sign Out takes that account off the device's switcher.
- Installation from a Jellyfin plugin repository, without any other plugin.
- A plugin image in Dashboard → Plugins and in the plugin repository's catalog.
