// Loaded by jellyfin-web as a classic script before its own bundles run.
// Written as ES5 with no build step, because the TV apps that load
// jellyfin-web run older browser engines. For the same reason the styles
// avoid flexbox gap and inset.
(function () {
    'use strict';

    var VERSION = '0.1.0';

    if (window.QuickSwitch) {
        return;
    }

    var STORE_KEY = 'quickswitch';
    var STORE_VERSION = 1;
    var UNREADABLE_KEY = 'quickswitch-unreadable';
    // The fields of a saved account this build manages; any others, from a newer build, are kept.
    var ACCOUNT_FIELDS = ['UserId', 'Name', 'AccessToken', 'PrimaryImageTag', 'Addresses', 'Stale', 'Admin'];
    var ACCENT = '#00a4dc';
    // Avatar colours for accounts without a profile picture; white text passes 3:1 on each at tile size.
    var COLORS = ['#0081b0', '#8e44ad', '#c0561b', '#1f8a4c', '#b03a6b', '#5a6acf', '#8a6d00', '#00796b'];
    var ICONS = {
        check: 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z',
        plus: 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z',
        edit: 'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z',
        close: 'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
        error: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z',
        lock: 'M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z',
        swap: 'M6.99 11L3 15l3.99 4v-3H14v-2H6.99v-3zM21 9l-3.99-4v3H10v2h7.01v3L21 9z',
        chevronLeft: 'M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z',
        chevronRight: 'M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z',
        trash: 'M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z',
        addPerson: 'M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z',
        key: 'M12.65 10C11.83 7.67 9.61 6 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6c2.61 0 4.83-1.67 5.65-4H17v4h4v-4h2v-4H12.65zM7 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z',
        quickConnect: 'M19 1H9c-1.1 0-2 .9-2 2v3h2V4h10v16H9v-2H7v3c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-2-2-2zm-8.2 10V9.5C10.8 8.1 9.4 7 8 7S5.2 8.1 5.2 9.5V11c-.6 0-1.2.6-1.2 1.2v3.5c0 .7.6 1.3 1.2 1.3h5.5c.7 0 1.3-.6 1.3-1.2v-3.5c0-.7-.6-1.3-1.2-1.3zm-1.3 0h-3V9.5c0-.8.7-1.3 1.5-1.3s1.5.5 1.5 1.3V11z',
        switchAccount: 'M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-6 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm6 11H8v-1.5c0-1.99 4-3 6-3s6 1.01 6 3V16z'
    };
    // The splash stays up at least this long, so a fast switch doesn't flicker.
    var SPLASH_MS = 900;
    var CREDENTIALS = 'jellyfin_credentials';
    var KEY = { escape: 27, back: 461, tizenBack: 10009, browserBack: 166, red: 403, enter: 13, space: 32, left: 37, up: 38, right: 39, down: 40, tab: 9 };

    // State -------------------------------------------------------------------
    // What the switcher remembers while the page is open. The saved accounts
    // themselves are in the store below.
    // The last sign-in seen, as server, user, token and address, so the server is asked about each one once.
    var lastSeen = '';
    // Who was signed in at the last look, as kept in the store, to notice jellyfin-web's own Sign Out.
    var wasSignedIn = '';
    // The sign-out check: whether one is waiting for the server, and when the last one started.
    var signOutCheck = { busy: false, at: 0 };
    // The switcher's element while it is open.
    var overlay = null;
    // What the switcher shows: pick, manage, move, add, confirm or ask.
    var mode = 'pick';
    // The element that opened the switcher, where focus returns when it closes.
    var opener = null;
    // The account being moved in Manage Accounts: who, from where, and how many tiles fit on a row.
    var moving = null;
    // A mouse or touch drag in progress.
    var drag = null;
    // When the last drag ended, so the click that ends it doesn't pick the tile up.
    var dragEnded = 0;
    // Whether a remove is waiting for the server.
    var removing = false;
    // An add in progress: the account to return to, which card was chosen, and how far it has got.
    var adding = null;
    // The account being signed back in after Back while adding.
    var returning = null;
    // Whether a switch is in progress.
    var switching = false;
    // The timer that takes the toast away.
    var toastTimer = null;
    // Whether a key was pressed since the page loaded, so start-up focus leaves it alone.
    var keyPressed = false;
    // The element jellyfin-web focused under the switcher, where focus goes when it closes.
    var lastFocus = null;

    // Store -------------------------------------------------------------------

    // Saved accounts, per server, in this browser's localStorage. Only accounts
    // that signed in on this device are ever saved. The format is private and
    // versioned: a store without a version is version 1, and a newer build's
    // version and fields are kept when this one writes, so going back to an
    // older build loses nothing.

    function readStore() {
        var raw = null;
        var value;
        try {
            raw = window.localStorage.getItem(STORE_KEY);
            value = JSON.parse(raw || '{}');
        } catch (e) {
            value = null;
        }
        if (!value || typeof value !== 'object' || value instanceof Array) {
            if (raw) {
                // Kept aside before starting afresh, so its saved sign-ins can still be found.
                try {
                    window.localStorage.setItem(UNREADABLE_KEY, raw);
                } catch (e) {
                    // Storage full or blocked: nothing more can be kept.
                }
            }
            value = {};
        }
        if (!value.servers || typeof value.servers !== 'object') {
            value.servers = {};
        }
        return value;
    }

    function writeStore(value) {
        if (!(typeof value.v === 'number' && value.v > STORE_VERSION)) {
            value.v = STORE_VERSION;
        }
        try {
            window.localStorage.setItem(STORE_KEY, JSON.stringify(value));
        } catch (e) {
            // Storage full or blocked: the switcher keeps working with what it has.
        }
    }

    function list(serverId) {
        var saved = readStore().servers[serverId];
        return saved instanceof Array ? saved.slice() : [];
    }

    function indexOf(accounts, userId) {
        for (var i = 0; i < accounts.length; i++) {
            if (accounts[i].UserId === userId) {
                return i;
            }
        }
        return -1;
    }

    // The server address as the store keeps it: case and trailing slashes
    // don't make a different address.
    function addressKey(address) {
        return String(address || '').toLowerCase().replace(/\/+$/, '');
    }

    // Adds the account, or replaces its saved token and details in place,
    // keeping every server address it has signed in through on this device.
    function save(serverId, account) {
        if (!serverId || !account || !account.UserId || !account.AccessToken) {
            return;
        }
        var value = readStore();
        var accounts = value.servers[serverId] instanceof Array ? value.servers[serverId] : [];
        var entry = {
            UserId: account.UserId,
            Name: account.Name || '',
            AccessToken: account.AccessToken,
            PrimaryImageTag: account.PrimaryImageTag || null
        };
        var at = indexOf(accounts, account.UserId);
        if (at !== -1) {
            for (var field in accounts[at]) {
                if (Object.prototype.hasOwnProperty.call(accounts[at], field) && ACCOUNT_FIELDS.indexOf(field) === -1) {
                    entry[field] = accounts[at][field];
                }
            }
        }
        // Saved as an administrator only through the question; never shown.
        if (typeof account.Admin === 'boolean') {
            entry.Admin = account.Admin;
        } else if (at !== -1 && accounts[at].Admin === true) {
            entry.Admin = true;
        }
        var addresses = at !== -1 && accounts[at].Addresses instanceof Array ? accounts[at].Addresses.slice() : [];
        var address = addressKey(account.Address);
        if (address && addresses.indexOf(address) === -1) {
            addresses.push(address);
        }
        entry.Addresses = addresses;
        if (at === -1) {
            accounts.push(entry);
        } else {
            accounts[at] = entry;
        }
        value.servers[serverId] = accounts;
        writeStore(value);
    }

    // Accounts saved before addresses were kept take the address they are
    // next seen at.
    function adoptAddress(serverId, address) {
        var key = addressKey(address);
        if (!serverId || !key) {
            return;
        }
        var value = readStore();
        var accounts = value.servers[serverId] instanceof Array ? value.servers[serverId] : [];
        var changed = false;
        for (var i = 0; i < accounts.length; i++) {
            if (!(accounts[i].Addresses instanceof Array) || !accounts[i].Addresses.length) {
                accounts[i].Addresses = [key];
                changed = true;
            }
        }
        if (changed) {
            writeStore(value);
        }
    }

    // A saved token is only ever sent to an address its account signed in
    // through on this device, so a server that reports another server's id
    // never receives that server's tokens.
    function knownAt(account, address) {
        return !!account && account.Addresses instanceof Array && account.Addresses.indexOf(addressKey(address)) !== -1;
    }

    function markStale(serverId, userId) {
        var value = readStore();
        var accounts = value.servers[serverId] instanceof Array ? value.servers[serverId] : [];
        var at = indexOf(accounts, userId);
        if (at !== -1) {
            accounts[at].Stale = true;
            value.servers[serverId] = accounts;
            writeStore(value);
        }
    }

    // An add in progress clears this device's sign-in, so it is remembered
    // here: after a restart in the middle of one, that account comes back.
    function startAdding(serverId, userId) {
        var value = readStore();
        value.adding = value.adding && typeof value.adding === 'object' ? value.adding : {};
        value.adding[serverId] = userId;
        writeStore(value);
    }

    function addingFrom(serverId) {
        var value = readStore();
        return value.adding && typeof value.adding[serverId] === 'string' ? value.adding[serverId] : null;
    }

    function stopAdding(serverId) {
        var value = readStore();
        if (value.adding && value.adding[serverId]) {
            delete value.adding[serverId];
            writeStore(value);
        }
    }

    // An administrator who chose Don't save is not asked again for that
    // sign-in; a new sign-in brings the question back. Only a hash of the
    // token is kept.
    function tokenMark(token) {
        var hash = 0;
        var text = String(token || '');
        for (var i = 0; i < text.length; i++) {
            hash = (hash * 31 + text.charCodeAt(i)) % 2147483647;
        }
        return String(hash);
    }

    function declineSave(serverId, userId, token) {
        var value = readStore();
        value.declined = value.declined && typeof value.declined === 'object' ? value.declined : {};
        value.declined[serverId + '|' + userId] = tokenMark(token);
        writeStore(value);
    }

    function declinedSave(serverId, userId, token) {
        var value = readStore();
        return !!value.declined && value.declined[serverId + '|' + userId] === tokenMark(token);
    }

    function forget(serverId, userId) {
        var value = readStore();
        var accounts = value.servers[serverId] instanceof Array ? value.servers[serverId] : [];
        var at = indexOf(accounts, userId);
        if (at !== -1) {
            accounts.splice(at, 1);
            value.servers[serverId] = accounts;
            writeStore(value);
        }
    }

    // Moves a saved account to another place in this server's order.
    function move(serverId, userId, to) {
        var value = readStore();
        var accounts = value.servers[serverId] instanceof Array ? value.servers[serverId] : [];
        var at = indexOf(accounts, userId);
        if (at === -1) {
            return;
        }
        var entry = accounts.splice(at, 1)[0];
        accounts.splice(Math.max(0, Math.min(accounts.length, to)), 0, entry);
        value.servers[serverId] = accounts;
        writeStore(value);
    }

    // The same user id always gets the same colour.
    function colorFor(userId) {
        var hash = 0;
        var text = String(userId || '');
        for (var i = 0; i < text.length; i++) {
            hash = (hash * 31 + text.charCodeAt(i)) % 2147483647;
        }
        return COLORS[hash % COLORS.length];
    }

    function avatar(account, server, size) {
        var name = String((account && account.Name) || '?');
        var url = null;
        if (account && account.PrimaryImageTag && server) {
            url = String(server).replace(/\/+$/, '') + '/Users/' + encodeURIComponent(account.UserId)
                + '/Images/Primary?tag=' + encodeURIComponent(account.PrimaryImageTag)
                + '&quality=90&maxHeight=' + (size || 360);
        }
        return { initial: name.charAt(0).toUpperCase(), color: colorFor(account && account.UserId), imageUrl: url };
    }

    // Server calls and sign-ins -----------------------------------------------

    // jellyfin-web's ApiClient, once it exists.

    function client() {
        return window.ApiClient;
    }

    function signedIn() {
        var c = client();
        if (!c || typeof c.getCurrentUserId !== 'function' || typeof c.accessToken !== 'function' || typeof c.serverId !== 'function') {
            return null;
        }
        var userId = c.getCurrentUserId();
        var token = c.accessToken();
        var serverId = c.serverId();
        return userId && token && serverId ? { userId: userId, token: token, serverId: serverId } : null;
    }

    function serverAddress() {
        var c = client();
        return c && typeof c.serverAddress === 'function' ? c.serverAddress() : '';
    }

    function urlFor(path) {
        var c = client();
        return c && typeof c.getUrl === 'function' ? c.getUrl(path) : serverAddress().replace(/\/+$/, '') + '/' + path;
    }

    function authHeader(token) {
        var c = client();
        return 'MediaBrowser Client="' + c.appName() + '", Device="' + c.deviceName() + '", DeviceId="' + c.deviceId()
            + '", Version="' + c.appVersion() + '", Token="' + token + '"';
    }

    // XMLHttpRequest rather than fetch, for the older TV engines. done(status, data); status 0 is a network error.
    function request(method, path, token, done) {
        var xhr = new XMLHttpRequest();
        xhr.open(method, urlFor(path), true);
        xhr.setRequestHeader('Authorization', authHeader(token));
        xhr.timeout = 10000;
        xhr.onload = function () {
            var data;
            try { data = JSON.parse(xhr.responseText); } catch (e) { data = null; }
            done(xhr.status, data);
        };
        xhr.onerror = xhr.ontimeout = function () { done(0, null); };
        xhr.send();
    }

    // Whoever signs in on this device is saved, or their token replaced. The
    // server is asked only when the signed-in user or token changes.

    // Who is signed in, kept in the store rather than only in memory: the
    // LG app can reload the page as it signs out, and the first look after
    // the reload still has to see who was signed in. A mark of the token is
    // kept, never the token.
    function rememberSignedIn(now) {
        var key = now ? now.serverId + '|' + now.userId + '|' + tokenMark(now.token) : '';
        if (key === wasSignedIn) {
            return;
        }
        wasSignedIn = key;
        var value = readStore();
        if (now) {
            value.signedIn = { serverId: now.serverId, userId: now.userId, mark: tokenMark(now.token) };
        } else {
            delete value.signedIn;
        }
        writeStore(value);
    }

    // An account that signed out with jellyfin-web's Sign Out leaves the
    // switcher too, once the server rejects its saved token. A token that
    // still works keeps the account. With no answer the check is tried again
    // every few seconds while the page is open, and at the next load.
    function markSignedOut(serverId, userId) {
        var value = readStore();
        value.signedOut = { serverId: serverId, userId: userId };
        writeStore(value);
        checkSignedOut();
    }

    function checkSignedOut() {
        var value = readStore();
        var pending = value.signedOut;
        if (!pending || typeof pending !== 'object' || signOutCheck.busy) {
            return;
        }
        var clear = function () {
            var latest = readStore();
            delete latest.signedOut;
            writeStore(latest);
        };
        var saved = list(pending.serverId);
        var at = indexOf(saved, pending.userId);
        if (at === -1 || !knownAt(saved[at], serverAddress())) {
            clear();
            return;
        }
        signOutCheck.busy = true;
        signOutCheck.at = new Date().getTime();
        request('GET', 'Users/Me', saved[at].AccessToken, function (status) {
            signOutCheck.busy = false;
            if (status === 0) {
                return;
            }
            clear();
            if (status === 401) {
                forget(pending.serverId, pending.userId);
            }
        });
    }

    // Whether the sign-in was cleared on purpose: an add (also across a
    // restart, as the store remembers it), a return after one, or a switch.
    function clearedOnPurpose(serverId) {
        return !!adding || !!returning || switching || !!addingFrom(serverId);
    }

    // jellyfin-web's Remember me, which it stores for the device as each
    // sign-in is typed; off, jellyfin-web drops the sign-in at the next load.
    function rememberSignIn() {
        try {
            return window.localStorage.getItem('enableAutoLogin') !== 'false';
        } catch (e) {
            return true;
        }
    }

    function watch() {
        var now = signedIn();
        if (client() && new Date().getTime() - signOutCheck.at >= 5000) {
            checkSignedOut();
        }
        if (!now) {
            var before = readStore().signedIn;
            rememberSignedIn(null);
            if (before && typeof before === 'object' && !clearedOnPurpose(before.serverId)) {
                var previous = list(before.serverId);
                var previousAt = indexOf(previous, before.userId);
                if (previousAt !== -1 && tokenMark(previous[previousAt].AccessToken) === before.mark) {
                    markSignedOut(before.serverId, before.userId);
                }
            }
            return;
        }
        rememberSignedIn(now);
        var here = serverAddress();
        var key = now.serverId + '|' + now.userId + '|' + now.token + '|' + addressKey(here);
        if (key === lastSeen) {
            return;
        }
        lastSeen = key;
        adoptAddress(now.serverId, here);
        var saved = list(now.serverId);
        var at = indexOf(saved, now.userId);
        if (at !== -1 && saved[at].AccessToken === now.token && saved[at].Name && knownAt(saved[at], here)) {
            return;
        }
        if (at === -1 && declinedSave(now.serverId, now.userId, now.token)) {
            return;
        }
        request('GET', 'Users/Me', now.token, function (status, user) {
            if (status === 200 && user && user.Id === now.userId) {
                var admin = !!(user.Policy && user.Policy.IsAdministrator);
                var approved = at !== -1 && saved[at].Admin === true;
                var account = { UserId: user.Id, Name: user.Name, AccessToken: now.token, PrimaryImageTag: user.PrimaryImageTag, Address: here, Admin: admin && approved };
                // Remember me unticked: this sign-in isn't kept on the device,
                // and neither is a copy saved before.
                if (!rememberSignIn()) {
                    if (at !== -1) {
                        forget(now.serverId, now.userId);
                    }
                    if (adding) {
                        added(account, true);
                    }
                    return;
                }
                // An administrator is saved only when someone chooses to: anyone
                // using the device could then manage the server. That includes
                // an account saved before it was made one.
                if (admin && !approved) {
                    askSaveAdmin(account, now.serverId);
                    return;
                }
                save(now.serverId, account);
                if (adding) {
                    added(account);
                }
            } else {
                lastSeen = '';
            }
        });
    }

    // Views -------------------------------------------------------------------

    // The styles are quick-switch.css, beside this script on the server, with
    // the same version, so they work under any BaseUrl and are cached alike.
    var STYLESHEET = typeof document !== 'undefined' && document.currentScript && document.currentScript.src
        ? document.currentScript.src.replace(/quick-switch\.js(\?|$)/, 'quick-switch.css$1')
        : '../QuickSwitch/quick-switch.css?v=' + VERSION;

    function addStyles() {
        if (document.getElementById('quickswitch-style')) {
            return;
        }
        var link = document.createElement('link');
        link.id = 'quickswitch-style';
        link.rel = 'stylesheet';
        link.href = STYLESHEET;
        document.head.appendChild(link);
    }

    function el(tag, className, text) {
        var element = document.createElement(tag);
        if (className) {
            element.className = className;
        }
        if (text) {
            element.textContent = text;
        }
        return element;
    }

    function icon(name, size, fill) {
        var ns = 'http://www.w3.org/2000/svg';
        var svg = document.createElementNS(ns, 'svg');
        svg.setAttribute('width', size);
        svg.setAttribute('height', size);
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('aria-hidden', 'true');
        svg.setAttribute('fill', fill || 'currentColor');
        var path = document.createElementNS(ns, 'path');
        path.setAttribute('d', ICONS[name]);
        svg.appendChild(path);
        return svg;
    }

    function isTv() {
        return document.documentElement.className.indexOf('layout-tv') !== -1;
    }

    function avatarCircle(account, server, className) {
        var picture = avatar(account, server, 360);
        var circle = el('span', className);
        circle.style.background = picture.color;
        if (picture.imageUrl) {
            var image = document.createElement('img');
            image.alt = '';
            image.src = picture.imageUrl;
            circle.appendChild(image);
        } else {
            circle.appendChild(el('span', 'qs-initial', picture.initial));
        }
        return circle;
    }

    // movable: in Manage Accounts with more than one account saved.
    function tile(account, current, server, managing, movable) {
        var button = el('button', 'qs-tile');
        button.type = 'button';
        button.setAttribute('data-qs-user', account.UserId);
        var stale = !current && (account.Stale || !knownAt(account, server));
        var tag = current ? (managing ? 'Signed in now' : 'Watching now') : stale ? 'Sign in again' : '';
        if (stale) {
            button.className += ' qs-stale';
        }
        button.setAttribute('aria-label', account.Name + (tag ? ', ' + tag.toLowerCase() : '') + (movable ? ', move' : ''));
        button.addEventListener('click', function () {
            if (!managing) {
                pick(account);
            } else if (Date.now() - dragEnded < 400) {
                // The click that ends a drag is not a pick-up.
            } else if (moving) {
                if (moving.userId === account.UserId) {
                    drop();
                }
            } else if (movable) {
                lift(account.UserId);
            }
        });
        var circle = avatarCircle(account, server, 'qs-avatar');
        if (movable) {
            var cover = el('span', 'qs-cover');
            cover.appendChild(icon('swap', 52, '#fff'));
            circle.appendChild(cover);
            var mover = el('span', 'qs-move');
            mover.appendChild(icon('swap', 20, '#fff'));
            circle.appendChild(mover);
            if (window.PointerEvent) {
                button.addEventListener('pointerdown', function (event) { grab(event, account.UserId); });
            }
        }
        if (stale) {
            var lock = el('span', 'qs-badge qs-lock');
            lock.appendChild(icon('lock', 20, '#fff'));
            circle.appendChild(lock);
        }
        if (current) {
            var badge = el('span', 'qs-badge');
            badge.appendChild(icon('check', 22, 'rgba(0,0,0,.87)'));
            circle.appendChild(badge);
        }
        button.appendChild(circle);
        button.appendChild(el('span', 'qs-name', account.Name));
        if (tag) {
            button.appendChild(el('span', 'qs-tag', tag));
        }
        return button;
    }

    function addTile() {
        var button = el('button', 'qs-tile qs-add');
        button.type = 'button';
        button.setAttribute('data-qs-action', 'add');
        button.addEventListener('click', showAdd);
        var circle = el('span', 'qs-avatar');
        circle.appendChild(icon('plus', 60, 'rgba(255,255,255,.7)'));
        button.appendChild(circle);
        button.appendChild(el('span', 'qs-name', 'Add Account'));
        return button;
    }

    // In Manage Accounts a tile sits in a slot with its remove button, which
    // shows for the focused tile, and the arrows shown while it moves.
    function slot(button, account, current) {
        var box = el('div', 'qs-slot');
        box.setAttribute('data-qs-slot', account.UserId);
        box.appendChild(button);
        var text = current ? 'Switch accounts to remove ' + account.Name : 'Remove ' + account.Name;
        var bin = el('button', 'qs-bin' + (current ? ' qs-off' : ''));
        bin.type = 'button';
        bin.setAttribute('data-qs-action', 'remove');
        bin.setAttribute('data-qs-bin', account.UserId);
        bin.setAttribute('aria-label', text);
        bin.appendChild(icon('trash', 26));
        bin.addEventListener('click', function () {
            if (current) {
                bin.focus();
            } else if (!moving) {
                showConfirm(account);
            }
        });
        box.appendChild(bin);
        var label = el('span', 'qs-bin-label', text);
        label.setAttribute('aria-hidden', 'true');
        box.appendChild(label);
        box.appendChild(stepButton(-1));
        box.appendChild(stepButton(1));
        return box;
    }

    function stepButton(delta) {
        var button = el('button', 'qs-step ' + (delta < 0 ? 'qs-step-left' : 'qs-step-right'));
        button.type = 'button';
        button.tabIndex = -1;
        button.setAttribute('aria-label', delta < 0 ? 'Move left' : 'Move right');
        button.appendChild(icon(delta < 0 ? 'chevronLeft' : 'chevronRight', 30));
        button.addEventListener('click', function () { step(delta); });
        return button;
    }

    // The remote's keys at the bottom right, in the TV layout. In Manage
    // Accounts they follow the focus.
    function hintItems() {
        if (mode === 'move') {
            return [[moving.perRow < slotList().length ? '◀ ▶ ▲ ▼' : '◀ ▶', 'Move'], ['OK', 'Put here'], ['BACK', 'Cancel']];
        }
        if (mode === 'confirm') {
            return [['OK', 'Select'], ['BACK', 'Cancel']];
        }
        if (mode === 'ask') {
            return [['OK', 'Select'], ['BACK', 'Don\u2019t save']];
        }
        if (mode === 'manage') {
            var focused = document.activeElement;
            if (focused && focused.getAttribute('data-qs-action') === 'remove') {
                return focused.className.indexOf('qs-off') !== -1
                    ? [['▼', 'Back to the account'], ['BACK', 'Done']]
                    : [['OK', 'Remove'], ['▼', 'Back to the account'], ['BACK', 'Done']];
            }
            if (focused && focused.getAttribute('data-qs-user') && slotOf(focused) && slotList().length > 1) {
                return [['OK', 'Move'], ['▲', 'Remove'], ['BACK', 'Done']];
            }
            return [['OK', 'Select'], ['BACK', 'Done']];
        }
        return [['OK', 'Select'], ['BACK', 'Close']];
    }

    function updateHints() {
        var box = overlay && overlay.querySelector('.qs-hints');
        if (!box) {
            return;
        }
        // Focus moves on every arrow press; the hints change far less often.
        var items = hintItems();
        var key = mode + JSON.stringify(items);
        if (box.getAttribute('data-qs-hints') === key) {
            return;
        }
        box.setAttribute('data-qs-hints', key);
        box.innerHTML = '';
        for (var i = 0; i < items.length; i++) {
            var hint = el('span');
            hint.appendChild(el('span', 'qs-key', items[i][0]));
            hint.appendChild(document.createTextNode(items[i][1]));
            box.appendChild(hint);
        }
        if (mode === 'pick' || mode === 'add') {
            var red = el('span');
            red.appendChild(el('span', 'qs-red'));
            red.appendChild(document.createTextNode('Opens this from any screen'));
            box.appendChild(red);
        }
    }

    // nextMode is 'pick' (Who's watching?) or 'manage' (Manage Accounts);
    // focusOn names what gets focus: a user id, 'bin:' and a user id for
    // that account's remove button, 'add' or 'manage'.
    function render(nextMode, focusOn) {
        mode = nextMode === 'manage' ? 'manage' : 'pick';
        moving = null;
        var managing = mode === 'manage';
        var now = returning || signedIn();
        var tv = isTv();
        var accounts = now ? list(now.serverId) : [];
        var server = serverAddress();
        var movable = managing && accounts.length > 1;

        overlay.className = (tv ? 'qs-tv' : '') + (accounts.length > 4 ? ' qs-many' : '') + (managing ? ' qs-manage' : '');
        overlay.innerHTML = '';
        var panel = el('div', 'qs-panel');
        panel.appendChild(el('h1', null, managing ? 'Manage Accounts' : 'Who’s watching?'));
        panel.appendChild(el('p', 'qs-sub', !managing ? 'Select or add an account'
            : movable ? 'Move or remove accounts'
            : 'Only the account signed in now is saved. Add others to move or remove them here.'));
        var row = el('div', 'qs-row');
        var focusFirst = null;
        var focusSlot = null;
        var currentTile = null;
        for (var i = 0; i < accounts.length; i++) {
            var current = !!now && accounts[i].UserId === now.userId;
            var button = tile(accounts[i], current, server, managing, movable);
            if (current) {
                currentTile = button;
            }
            var node = movable ? slot(button, accounts[i], current) : button;
            if (focusOn === 'bin:' + accounts[i].UserId && movable) {
                focusSlot = node;
                focusFirst = node.querySelector('.qs-bin');
            } else if (focusOn ? accounts[i].UserId === focusOn : current) {
                focusFirst = button;
            }
            row.appendChild(node);
        }
        var add = managing ? null : addTile();
        if (add) {
            row.appendChild(add);
            if (focusOn === 'add') {
                focusFirst = add;
            }
        }
        panel.appendChild(row);
        var manage = el('button', 'qs-button');
        manage.type = 'button';
        manage.setAttribute('data-qs-action', 'manage');
        manage.appendChild(icon('edit', 22));
        manage.appendChild(document.createTextNode(managing ? 'Done' : 'Manage Accounts'));
        manage.addEventListener('click', function () { render(managing ? 'pick' : 'manage', 'manage'); });
        panel.appendChild(manage);
        overlay.appendChild(panel);
        var long = panel.scrollHeight > panel.clientHeight;
        if (long) {
            overlay.className += ' qs-long';
        }
        if (focusOn === 'manage') {
            // Done follows the list. When the list is longer than the screen, Manage Accounts opens at
            // its top on the account signed in now instead of scrolling down to Done.
            focusFirst = managing && currentTile && long ? currentTile : manage;
            panel.scrollTop = 0;
        }

        if (tv) {
            var hintBox = el('div', 'qs-hints');
            hintBox.setAttribute('aria-hidden', 'true');
            overlay.appendChild(hintBox);
        } else {
            var closeButton = el('button', 'qs-close');
            closeButton.type = 'button';
            closeButton.setAttribute('data-qs-action', 'close');
            closeButton.setAttribute('aria-label', 'Close');
            closeButton.appendChild(icon('close', 26, '#fff'));
            closeButton.addEventListener('click', close);
            overlay.appendChild(closeButton);
        }
        var live = el('div', 'qs-live');
        live.setAttribute('role', 'status');
        live.setAttribute('aria-live', 'polite');
        overlay.appendChild(live);
        if (focusSlot) {
            showBin(focusSlot);
        }
        (focusFirst || add || manage).focus();
        updateHints();
    }

    // Moving accounts ---------------------------------------------------------

    // Moving a tile in Manage Accounts: it is picked up, the arrows (or its
    // arrow buttons, or a drag) move it while the others make room, and OK or
    // selecting it again puts it down and saves the order. Back puts it back.

    function slotList() {
        return overlay ? Array.prototype.slice.call(overlay.querySelectorAll('.qs-slot')) : [];
    }

    function slotFor(userId) {
        var slots = slotList();
        for (var i = 0; i < slots.length; i++) {
            if (slots[i].getAttribute('data-qs-slot') === userId) {
                return slots[i];
            }
        }
        return null;
    }

    function slotOf(element) {
        while (element && element !== overlay && element.getAttribute) {
            if (element.getAttribute('data-qs-slot')) {
                return element;
            }
            element = element.parentNode;
        }
        return null;
    }

    // How many tiles fit on one row, so Up and Down can move a tile a row.
    function rowLength() {
        var slots = slotList();
        var count = 0;
        for (var i = 0; i < slots.length; i++) {
            if (slots[i].offsetTop === slots[0].offsetTop) {
                count++;
            }
        }
        return count || 1;
    }

    function showBin(target) {
        var slots = slotList();
        for (var i = 0; i < slots.length; i++) {
            if (slots[i] === target) {
                slots[i].classList.add('qs-show');
            } else {
                slots[i].classList.remove('qs-show');
            }
        }
    }

    function reducedMotion() {
        return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    }

    function lift(userId) {
        var box = slotFor(userId);
        if (!box) {
            return;
        }
        var name = box.querySelector('.qs-name').textContent;
        // perRow is measured once: reading tile positions forces a layout.
        moving = { userId: userId, name: name, from: slotList().indexOf(box), perRow: rowLength() };
        mode = 'move';
        showBin(null);
        box.classList.add('qs-lifted');
        overlay.classList.add('qs-moving');
        overlay.querySelector('.qs-sub').textContent = 'Moving ' + name + ': ' + (isTv()
            ? 'Left and Right choose the place, OK puts them there'
            : 'use the arrows, then select ' + name + ' to put them there');
        updateSteps();
        box.querySelector('.qs-tile').focus();
        updateHints();
    }

    function updateSteps() {
        var box = moving && slotFor(moving.userId);
        if (!box) {
            return;
        }
        var at = slotList().indexOf(box);
        box.querySelector('.qs-step-left').disabled = at === 0;
        box.querySelector('.qs-step-right').disabled = at === slotList().length - 1;
    }

    function step(delta) {
        if (moving) {
            moveTo(slotList().indexOf(slotFor(moving.userId)) + delta);
        }
    }

    // Puts the moving tile at index; the tiles it passes slide to their new
    // places from where they were.
    function moveTo(index) {
        var box = slotFor(moving.userId);
        var slots = slotList();
        var at = slots.indexOf(box);
        if (index < 0 || index >= slots.length || index === at) {
            return;
        }
        var before = [];
        for (var i = 0; i < slots.length; i++) {
            before.push(slots[i].getBoundingClientRect());
        }
        var row = box.parentNode;
        row.removeChild(box);
        row.insertBefore(box, slotList()[index] || null);
        slide(slots, before);
        box.querySelector('.qs-tile').focus();
        updateSteps();
    }

    function slide(slots, before) {
        if (reducedMotion()) {
            return;
        }
        var moved = [];
        for (var i = 0; i < slots.length; i++) {
            var after = slots[i].getBoundingClientRect();
            var dx = before[i].left - after.left;
            var dy = before[i].top - after.top;
            if (dx || dy) {
                slots[i].style.transition = 'none';
                slots[i].style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
                moved.push(slots[i]);
            }
        }
        if (!moved.length) {
            return;
        }
        void overlay.offsetWidth;
        for (var j = 0; j < moved.length; j++) {
            moved[j].style.transition = 'transform .16s ease-out';
            moved[j].style.transform = '';
        }
    }

    function drop() {
        if (!moving) {
            return;
        }
        var now = returning || signedIn();
        var userId = moving.userId;
        var name = moving.name;
        var from = moving.from;
        var at = slotList().indexOf(slotFor(userId));
        if (now) {
            move(now.serverId, userId, at);
        }
        render('manage', userId);
        var box = slotFor(userId);
        if (box) {
            box.querySelector('.qs-avatar').classList.add('qs-settle');
        }
        if (at !== from) {
            announce(name + ' moved to place ' + (at + 1) + ' of ' + slotList().length);
        }
    }

    function cancelMove() {
        if (moving) {
            render('manage', moving.userId);
        }
    }

    function announce(text) {
        var live = overlay && overlay.querySelector('.qs-live');
        if (live) {
            window.setTimeout(function () { live.textContent = text; }, 100);
        }
    }

    // A mouse or touch drag moves a tile in Manage Accounts; a press without
    // a drag stays a click.
    function grab(event, userId) {
        if ((event.pointerType === 'mouse' && event.button !== 0) || (mode !== 'manage' && !(moving && moving.userId === userId))) {
            return;
        }
        drag = { userId: userId, x: event.clientX, y: event.clientY, started: false };
        document.addEventListener('pointermove', onDrag, true);
        document.addEventListener('pointerup', onDragEnd, true);
        document.addEventListener('pointercancel', onDragEnd, true);
    }

    function onDrag(event) {
        if (!drag || !overlay) {
            return;
        }
        if (!drag.started) {
            if (Math.abs(event.clientX - drag.x) + Math.abs(event.clientY - drag.y) < 8) {
                return;
            }
            drag.started = true;
            if (!moving) {
                lift(drag.userId);
            }
            if (!moving) {
                return;
            }
            overlay.querySelector('.qs-sub').textContent = 'Drag ' + moving.name + ' to a new place and let go';
        }
        event.preventDefault();
        // Layout positions, not on-screen ones: a tile still sliding to its
        // new place would otherwise be found where it was.
        var slots = slotList();
        var panel = overlay.querySelector('.qs-panel');
        var origin = overlay.getBoundingClientRect();
        var x = event.clientX - origin.left + panel.scrollLeft;
        var y = event.clientY - origin.top + panel.scrollTop;
        var best = -1;
        var bestDistance = Infinity;
        for (var i = 0; i < slots.length; i++) {
            var circle = slots[i].querySelector('.qs-avatar');
            var cx = slots[i].offsetLeft + slots[i].offsetWidth / 2;
            var cy = slots[i].offsetTop + circle.offsetTop + circle.offsetHeight / 2;
            var distance = Math.pow(cx - x, 2) + Math.pow(cy - y, 2);
            if (distance < bestDistance) {
                bestDistance = distance;
                best = i;
            }
        }
        if (best !== -1) {
            moveTo(best);
        }
    }

    function onDragEnd() {
        document.removeEventListener('pointermove', onDrag, true);
        document.removeEventListener('pointerup', onDragEnd, true);
        document.removeEventListener('pointercancel', onDragEnd, true);
        var started = drag && drag.started;
        drag = null;
        if (started && moving) {
            dragEnded = Date.now();
            drop();
        }
    }

    // Dialogs and removing ----------------------------------------------------

    // In Manage Accounts Up reaches the focused tile's remove button, Down
    // returns to the tile, and Left and Right move along the remove buttons.
    function manageArrow(code) {
        var focused = document.activeElement;
        var box = slotOf(focused);
        var bin = box && box.querySelector('.qs-bin');
        if (!bin) {
            return false;
        }
        if (focused !== bin) {
            if (code !== KEY.up) {
                return false;
            }
            showBin(box);
            bin.focus();
            return true;
        }
        if (code === KEY.down) {
            box.querySelector('.qs-tile').focus();
        } else if (code === KEY.left || code === KEY.right) {
            var slots = slotList();
            var next = slots[slots.indexOf(box) + (code === KEY.left ? -1 : 1)];
            if (next) {
                showBin(next);
                next.querySelector('.qs-bin').focus();
            }
        }
        return true;
    }

    function deviceWord() {
        return isTv() ? 'this TV' : 'this device';
    }

    function card(action, iconName, title, sub) {
        var button = el('button', 'qs-card');
        button.type = 'button';
        button.setAttribute('data-qs-action', action);
        var badge = el('span', 'qs-card-badge');
        badge.appendChild(icon(iconName, 26));
        button.appendChild(badge);
        var text = el('span');
        text.appendChild(el('span', 'qs-card-title', title));
        text.appendChild(el('span', 'qs-card-sub', sub));
        button.appendChild(text);
        return button;
    }

    // The Add Account dialog, over the tiles.
    function showAdd() {
        if (!overlay) {
            return;
        }
        mode = 'add';
        var scrim = el('div', 'qs-scrim');
        var dialog = el('div', 'qs-dialog');
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-modal', 'true');
        dialog.setAttribute('aria-label', 'Add Account');
        var badge = el('div', 'qs-dialog-icon');
        badge.appendChild(icon('addPerson', 34, ACCENT));
        dialog.appendChild(badge);
        dialog.appendChild(el('h2', null, 'Add Account'));
        dialog.appendChild(el('p', null, 'Everyone saved on ' + deviceWord() + ' stays saved.'));
        var password = card('add-password', 'key', 'Sign in with a password', 'Type the user name and password');
        password.addEventListener('click', function () { startAdd(false); });
        dialog.appendChild(password);
        var quick = card('add-quick-connect', 'quickConnect', 'Use Quick Connect', 'Approve a code from a phone that\u2019s signed in');
        quick.addEventListener('click', function () { startAdd(true); });
        dialog.appendChild(quick);
        var cancel = el('button', 'qs-cancel', 'Cancel');
        cancel.type = 'button';
        cancel.setAttribute('data-qs-action', 'add-cancel');
        cancel.addEventListener('click', hideAdd);
        dialog.appendChild(cancel);
        scrim.appendChild(dialog);
        overlay.appendChild(scrim);
        password.focus();
    }

    // Asks before removing; focus starts on Keep, so a stray OK removes nobody.
    function showConfirm(account) {
        mode = 'confirm';
        var scrim = el('div', 'qs-scrim');
        var dialog = el('div', 'qs-dialog qs-confirm');
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-modal', 'true');
        dialog.setAttribute('aria-label', 'Remove ' + account.Name);
        dialog.appendChild(avatarCircle(account, serverAddress(), 'qs-avatar'));
        dialog.appendChild(el('h2', null, 'Remove ' + account.Name + ' from ' + deviceWord() + '?'));
        // At an address it didn't sign in through, its token is never sent, so
        // it can't be signed out on the server from here.
        var elsewhere = !knownAt(account, serverAddress());
        dialog.appendChild(el('p', null, elsewhere
            ? account.Name + '’s sign-in keeps working on the server, because it can’t be signed out from this address. To end it, sign '
                + account.Name + ' out where they signed in, or remove this device in Dashboard → Devices.'
            : account.Name + ' is signed out here. Their account and watch history stay on the server, and signing in again adds them back.'));
        var keep = el('button', 'qs-button qs-wide', 'Keep');
        keep.type = 'button';
        keep.setAttribute('data-qs-action', 'confirm-keep');
        keep.addEventListener('click', function () { render('manage', 'bin:' + account.UserId); });
        var remove = el('button', 'qs-button qs-wide', elsewhere ? 'Remove from ' + deviceWord() : 'Remove');
        remove.type = 'button';
        remove.setAttribute('data-qs-action', 'confirm-remove');
        remove.addEventListener('click', function () { removeAccount(account, remove); });
        dialog.appendChild(keep);
        dialog.appendChild(remove);
        scrim.appendChild(dialog);
        overlay.appendChild(scrim);
        keep.focus();
    }

    // When Remove couldn't sign the account out on the server, nothing is
    // forgotten until the user chooses. Keep shares the confirm's action, so
    // Back keeps the account here too.
    function showRemoveFailed(account) {
        mode = 'confirm';
        // An earlier "removed" toast would contradict the dialog.
        var shown = document.querySelector('.qs-toast');
        if (shown) {
            shown.parentNode.removeChild(shown);
        }
        var scrim = el('div', 'qs-scrim');
        var dialog = el('div', 'qs-dialog qs-confirm');
        dialog.setAttribute('role', 'alertdialog');
        dialog.setAttribute('aria-modal', 'true');
        dialog.setAttribute('aria-label', 'Couldn’t sign ' + account.Name + ' out on the server');
        dialog.appendChild(avatarCircle(account, serverAddress(), 'qs-avatar'));
        dialog.appendChild(el('h2', null, 'Couldn’t sign ' + account.Name + ' out on the server'));
        dialog.appendChild(el('p', null, 'The server didn’t answer. Try again once it can be reached. If you remove '
            + account.Name + ' from ' + deviceWord() + ' only, their sign-in keeps working on the server until their password is changed.'));
        var retry = el('button', 'qs-button qs-wide', 'Try again');
        retry.type = 'button';
        retry.setAttribute('data-qs-action', 'remove-retry');
        retry.addEventListener('click', function () { removeAccount(account, retry); });
        var local = el('button', 'qs-button qs-wide', 'Remove from ' + deviceWord() + ' only');
        local.type = 'button';
        local.setAttribute('data-qs-action', 'remove-local');
        local.addEventListener('click', function () { forgetAccount(account); });
        var keep = el('button', 'qs-button qs-wide', 'Keep');
        keep.type = 'button';
        keep.setAttribute('data-qs-action', 'confirm-keep');
        keep.addEventListener('click', function () { render('manage', 'bin:' + account.UserId); });
        dialog.appendChild(retry);
        dialog.appendChild(local);
        dialog.appendChild(keep);
        scrim.appendChild(dialog);
        overlay.appendChild(scrim);
        retry.focus();
        updateHints();
    }

    // Forgets an account on this device; focus moves to the account that
    // takes its place.
    function forgetAccount(account) {
        var now = signedIn();
        if (!now) {
            return;
        }
        var saved = list(now.serverId);
        var at = indexOf(saved, account.UserId);
        forget(now.serverId, account.UserId);
        saved = list(now.serverId);
        var next = saved[Math.min(at, saved.length - 1)];
        if (overlay) {
            render('manage', next ? next.UserId : 'manage');
        }
        toast(account.Name + ' removed from ' + deviceWord());
    }

    // Revokes the removed account's own token, so it stops working on the
    // server, then forgets it; the account signed in is never touched. A 401
    // means the token already no longer works. Any other failure asks first.

    function removeAccount(account, button) {
        var now = signedIn();
        if (!now || removing || account.UserId === now.userId) {
            return;
        }
        if (!knownAt(account, serverAddress())) {
            // Its token never goes to an address it didn't sign in through.
            forgetAccount(account);
            return;
        }
        removing = true;
        var asking = button && withClass(button, 'qs-scrim');
        if (button) {
            showBusy(button, 'Removing...');
        }
        announce('Removing ' + account.Name + '...');
        request('POST', 'Sessions/Logout', account.AccessToken, function (status) {
            removing = false;
            // The dialog that asked may have been left while the server took its time.
            var stillAsking = !!asking && !!overlay && overlay.contains(asking);
            if ((status >= 200 && status < 300) || status === 401) {
                if (stillAsking || !asking) {
                    forgetAccount(account);
                } else {
                    // Signed out on the server already: forget it here too, without reopening anything.
                    var now = signedIn();
                    if (now) {
                        forget(now.serverId, account.UserId);
                    }
                    if (overlay && mode === 'manage') {
                        render('manage', 'manage');
                    }
                    toast(account.Name + ' removed from ' + deviceWord());
                }
            } else if (stillAsking) {
                asking.parentNode.removeChild(asking);
                showRemoveFailed(account);
            }
        });
    }

    // The nearest element, from node up, that has className among its classes.
    function withClass(node, className) {
        while (node && node.className !== undefined) {
            if ((' ' + node.className + ' ').indexOf(' ' + className + ' ') !== -1) {
                return node;
            }
            node = node.parentNode;
        }
        return null;
    }

    // A dialog button whose action is waiting for the server: it says so, and
    // the dialog's buttons do nothing more until the answer.
    function showBusy(button, text) {
        var buttons = withClass(button, 'qs-dialog').querySelectorAll('button');
        for (var i = 0; i < buttons.length; i++) {
            buttons[i].disabled = true;
        }
        // An earlier toast would talk over the wait.
        var shown = document.querySelector('.qs-toast');
        if (shown) {
            shown.parentNode.removeChild(shown);
        }
        button.className += ' qs-busy';
        button.textContent = '';
        button.appendChild(el('span', 'qs-spinner'));
        button.appendChild(document.createTextNode(text));
    }

    function hideAdd() {
        if (overlay) {
            render();
            var add = overlay.querySelector('[data-qs-action="add"]');
            if (add) {
                add.focus();
            }
        }
    }

    // Adding an account -------------------------------------------------------

    // Adding an account signs the current one out on this device only: its
    // token is kept in the store, never revoked, and comes back on Back.

    // again, when given, is a saved account whose sign-in stopped working:
    // the sign-in page opens for that account.
    function startAdd(quick, again) {
        if (adding) {
            return;
        }
        var now = signedIn();
        var saved = now ? list(now.serverId) : [];
        var at = now ? indexOf(saved, now.userId) : -1;
        var c = client();
        if (at === -1 || typeof c.setAuthenticationInfo !== 'function' || typeof c.onAuthenticated !== 'function') {
            toast('This version of jellyfin-web can\u2019t add an account here.', null, true);
            return;
        }
        adding = { serverId: now.serverId, previous: saved[at], quick: quick, quickStarted: false, again: again || null };
        startAdding(now.serverId, saved[at].UserId);
        try {
            var credentials = JSON.parse(window.localStorage.getItem(CREDENTIALS));
            var servers = credentials && credentials.Servers ? credentials.Servers : [];
            for (var i = 0; i < servers.length; i++) {
                if (servers[i].Id === now.serverId) {
                    delete servers[i].AccessToken;
                    delete servers[i].UserId;
                }
            }
            window.localStorage.setItem(CREDENTIALS, JSON.stringify(credentials));
        } catch (e) {
            // jellyfin-web keeps its own copy in memory, cleared below.
        }
        c.setAuthenticationInfo(null, null);
        lastSeen = '';
        // The switcher stays over the page until the sign-in form, or the
        // Quick Connect code, has finished drawing, so neither the home screen
        // nor a half-drawn sign-in page is seen on the way.
        adding.waiting = true;
        adding.waitedFrom = new Date().getTime();
        navigate('login?serverid=' + now.serverId);
        waitForSignIn(adding);
    }

    // jellyfin-web shows the sign-in page before it knows whether to show the
    // form or the user list, and keeps Use Quick Connect hidden until the
    // server answers, so this polls rather than waiting for the page itself.
    function waitForSignIn(state) {
        if (adding !== state || !state.waiting) {
            return;
        }
        if (visibleLogin()) {
            decorateLogin();
        }
        var now = new Date().getTime();
        if (signInReady(state, now) || now - state.waitedFrom > 10000) {
            state.waiting = false;
            close(true);
            return;
        }
        window.setTimeout(function () { waitForSignIn(state); }, 50);
    }

    function signInReady(state, now) {
        if (state.quick) {
            // The code, or jellyfin-web's error when Quick Connect is off,
            // after its opening animation (280 ms at most).
            var dialog = document.querySelector('.dialogContainer .dialog.opened');
            if (!dialog) {
                state.dialogSince = 0;
                return false;
            }
            state.dialogSince = state.dialogSince || now;
            return now - state.dialogSince >= 350;
        }
        var page = visibleLogin();
        var form = page && page.querySelector('.manualLoginForm');
        return !!form && form.className.indexOf('hide') === -1 && !!form.querySelector('[data-qs-notice]');
    }

    function visibleLogin() {
        var pages = document.querySelectorAll('#loginPage');
        for (var i = 0; i < pages.length; i++) {
            if (pages[i].className.indexOf('hide') === -1) {
                return pages[i];
            }
        }
        return null;
    }

    function notice(account, text, locked) {
        var row = el('div', 'qs-notice-row');
        row.setAttribute('data-qs-notice', '');
        var box = el('div', 'qs-notice');
        box.setAttribute('role', 'note');
        if (locked) {
            var badge = el('span', 'qs-mini qs-locked');
            badge.appendChild(icon('lock', 16, '#fff'));
            box.appendChild(badge);
        } else {
            box.appendChild(avatarCircle(account, serverAddress(), 'qs-mini'));
        }
        box.appendChild(el('span', null, text));
        row.appendChild(box);
        return row;
    }

    function addingNotice() {
        if (adding.again) {
            var who = adding.again.Name;
            return notice(adding.again, who + '\u2019s saved sign-in stopped working. Sign in again to keep ' + who + ' on ' + deviceWord() + '.', true);
        }
        var name = adding.previous.Name;
        return notice(adding.previous, 'Adding an account. Back returns to ' + name + '.');
    }

    // Puts the notice line on jellyfin-web's sign-in page and its Quick
    // Connect dialog, and opens the form the chosen card asked for.
    function decorateLogin() {
        var page = visibleLogin();
        if (page) {
            var forms = page.querySelectorAll('.manualLoginForm, .visualLoginForm');
            for (var i = 0; i < forms.length; i++) {
                var title = forms[i].querySelector('h1');
                if (title && !forms[i].querySelector('[data-qs-notice]')) {
                    addStyles();
                    var anchor = title.parentNode === forms[i] ? title : title.parentNode;
                    forms[i].insertBefore(addingNotice(), anchor.nextSibling);
                }
            }
            var manual = page.querySelector('.btnManual');
            var quick = page.querySelector('.btnQuick');
            if (adding.quick && !adding.quickStarted && quick && quick.className.indexOf('hide') === -1) {
                adding.quickStarted = true;
                quick.click();
            } else if (!adding.quick && manual && manual.className.indexOf('hide') === -1 && !adding.manualShown) {
                adding.manualShown = true;
                manual.click();
            }
            if (adding.again && !adding.filling) {
                adding.filling = true;
                fillName(adding, 0);
            }
        }
        var code = document.querySelector('#quickConnectAlert .dialogContentInner');
        if (code && !code.querySelector('[data-qs-notice]')) {
            addStyles();
            code.appendChild(addingNotice());
            // The dialog keeps its text to 350px; the notice reads better on one line.
            var content = code.parentNode;
            if (content && content.className.indexOf('formDialogContent') !== -1) {
                content.style.maxWidth = 'none';
            }
        }
    }

    // jellyfin-web empties the user name as it shows the form, so the name is
    // put back for a few seconds, until someone types in the field.
    function fillName(state, tries) {
        if (adding !== state || tries > 20) {
            return;
        }
        var page = visibleLogin();
        var name = page && page.querySelector('#txtManualName');
        if (name && name.offsetWidth > 0 && !state.typed) {
            if (!name.qsWatched) {
                name.qsWatched = true;
                name.addEventListener('input', function () { state.typed = true; });
            }
            if (name.value !== state.again.Name) {
                name.value = state.again.Name;
                var password = page.querySelector('#txtManualPassword');
                if (password) {
                    password.focus();
                }
            }
        }
        window.setTimeout(function () { fillName(state, tries + 1); }, 250);
    }

    function removeNotices() {
        var notices = document.querySelectorAll('[data-qs-notice]');
        for (var i = 0; i < notices.length; i++) {
            notices[i].parentNode.removeChild(notices[i]);
        }
    }

    function added(account, unsaved) {
        var again = adding.again && adding.again.UserId === account.UserId;
        stopAdding(adding.serverId);
        adding = null;
        removeNotices();
        toast(again || unsaved ? 'Now watching as ' + account.Name : account.Name + ' is saved on ' + deviceWord(), account);
    }

    // Asks before an administrator is saved on this device. Nothing marks an
    // administrator anywhere else, so other users of the device can't tell
    // which account manages the server.
    function askSaveAdmin(account, serverId) {
        var wasOpen = !!overlay;
        if (!wasOpen) {
            open();
        }
        if (!overlay) {
            return;
        }
        var decide = function (keep) {
            if (keep) {
                account.Admin = true;
                save(serverId, account);
            } else {
                // An account saved before it was made an administrator goes too.
                forget(serverId, account.UserId);
                declineSave(serverId, account.UserId, account.AccessToken);
            }
            if (adding) {
                added(account, !keep);
            }
            if (wasOpen) {
                render();
            } else {
                close(true);
            }
        };
        mode = 'ask';
        var scrim = el('div', 'qs-scrim');
        var dialog = el('div', 'qs-dialog qs-confirm');
        dialog.setAttribute('role', 'alertdialog');
        dialog.setAttribute('aria-modal', 'true');
        dialog.setAttribute('aria-label', 'Save ' + account.Name + ' on ' + deviceWord() + '?');
        dialog.appendChild(avatarCircle(account, serverAddress(), 'qs-avatar'));
        dialog.appendChild(el('h2', null, 'Save ' + account.Name + ' on ' + deviceWord() + '?'));
        dialog.appendChild(el('p', null, account.Name + ' manages this server, so anyone using ' + deviceWord()
            + ' could switch to them and manage it too. If you don\u2019t save them, they stay signed in until someone switches or signs out.'));
        var yes = el('button', 'qs-button qs-wide', 'Save');
        yes.type = 'button';
        yes.setAttribute('data-qs-action', 'admin-save');
        yes.addEventListener('click', function () { decide(true); });
        var no = el('button', 'qs-button qs-wide', 'Don\u2019t save');
        no.type = 'button';
        no.setAttribute('data-qs-action', 'admin-skip');
        no.addEventListener('click', function () { decide(false); });
        dialog.appendChild(yes);
        dialog.appendChild(no);
        scrim.appendChild(dialog);
        overlay.appendChild(scrim);
        // Saving an administrator takes a deliberate move to Save.
        no.focus();
        updateHints();
    }

    // Signs jellyfin-web in as user in place, then rebuilds home; never a
    // reload, which would drop the webOS app's NativeShell.
    function signInInPlace(user, token, serverId, done, failed) {
        var c = client();
        var result;
        try {
            result = c.onAuthenticated(c, { User: user, AccessToken: token, ServerId: serverId });
        } catch (e) {
            failed();
            return;
        }
        if (result && typeof result.then === 'function') {
            result.then(function () { showHomeAgain(done); }, failed);
        } else {
            showHomeAgain(done);
        }
    }

    // Back while adding: Who's watching? covers the page at once, with the
    // previous account marked, while that account is signed in again under it.

    function cancelAdd() {
        var previous = adding.previous;
        var serverId = adding.serverId;
        adding = null;
        removeNotices();
        var code = document.getElementById('quickConnectAlert');
        var ok = code && code.querySelector('[data-id="ok"]');
        if (ok) {
            ok.click();
        }
        returning = { serverId: serverId, userId: previous.UserId };
        if (overlay) {
            render('pick', 'add');
        } else {
            open('add');
        }
        opener = null;
        restore(serverId, previous, true);
    }

    function returned(failed) {
        returning = null;
        if (!overlay) {
            return;
        }
        if (failed) {
            close(true);
            return;
        }
        // jellyfin-web may have focused its home screen meanwhile: that is
        // where focus goes when the switcher closes.
        var behind = document.activeElement;
        opener = behind && behind !== document.body && !overlay.contains(behind) ? behind : headerTarget();
        render('pick', 'add');
    }

    // Signs previous back in after an add that didn't finish. An unreachable
    // server leaves the add remembered, to try again at the next load; a
    // rejected sign-in marks the account instead. inSwitcher: Back opened
    // Who's watching?, which says who is watching, so there is no toast.
    function restore(serverId, previous, inSwitcher) {
        if (!knownAt(previous, serverAddress())) {
            if (inSwitcher) {
                returned(true);
            }
            stopAdding(serverId);
            toast('Sign in to keep watching as ' + previous.Name + ' here.', null, true);
            return;
        }
        request('GET', 'Users/Me', previous.AccessToken, function (status, user) {
            if (inSwitcher && (status !== 200 || !user || user.Id !== previous.UserId)) {
                returned(true);
            }
            if (status === 0) {
                toast('Can\u2019t reach the server right now. Sign in to keep watching.', null, true);
                return;
            }
            stopAdding(serverId);
            if (status !== 200 || !user || user.Id !== previous.UserId) {
                markStale(serverId, previous.UserId);
                toast(previous.Name + '\u2019s saved sign-in stopped working. Sign in again to keep watching.', null, true);
                return;
            }
            lastSeen = '';
            signInInPlace(user, previous.AccessToken, serverId, function () {
                if (inSwitcher) {
                    returned(false);
                } else {
                    toast('Now watching as ' + previous.Name, previous);
                }
            }, function () {
                if (inSwitcher) {
                    returned(true);
                }
                toast('Couldn\u2019t return to ' + previous.Name + '. Sign in to keep watching.', null, true);
            });
        });
    }

    // At load, once jellyfin-web has either signed someone in or shown its
    // sign-in page: an add remembered from before a restart is undone, unless
    // someone signed in meanwhile.
    function resumeAfterRestart(tries) {
        var c = client();
        var serverId = c && typeof c.serverId === 'function' ? c.serverId() : null;
        if (serverId && signedIn()) {
            stopAdding(serverId);
            return;
        }
        if (serverId && visibleLogin()) {
            var from = addingFrom(serverId);
            var saved = list(serverId);
            var at = from ? indexOf(saved, from) : -1;
            if (at === -1) {
                stopAdding(serverId);
            } else if (typeof c.onAuthenticated === 'function') {
                restore(serverId, saved[at]);
            }
            return;
        }
        if (tries > 0) {
            window.setTimeout(function () { resumeAfterRestart(tries - 1); }, 500);
        }
    }

    function onAddingKey(event) {
        if (adding && !overlay && isBackKey(event) && visibleLogin()) {
            event.preventDefault();
            event.stopPropagation();
            cancelAdd();
        }
    }

    // The browser's own Back leaves the sign-in page with nobody signed in.
    // The route is read as it changes: jellyfin-web sends a signed-out
    // browser back to the sign-in page a moment later. Closing jellyfin-web's
    // Quick Connect dialog also goes back, but stays on the sign-in route.
    function onAddingRoute() {
        if (!adding || /login/.test(window.location.hash)) {
            return;
        }
        window.setTimeout(function () {
            if (adding && !signedIn()) {
                cancelAdd();
            }
        }, 0);
    }

    // Switching and notices ---------------------------------------------------

    // Bottom-left notice in jellyfin-web's toast style; with an account it shows that account's avatar.

    function toast(text, account, isError) {
        var old = document.querySelector('.qs-toast');
        if (old) {
            old.parentNode.removeChild(old);
        }
        window.clearTimeout(toastTimer);
        addStyles();
        var box = el('div', 'qs-toast' + (account || isError ? '' : ' qs-plain'));
        box.setAttribute('role', 'status');
        if (isError) {
            box.appendChild(icon('error', 22, '#ff8a80'));
        } else if (account) {
            box.appendChild(avatarCircle(account, serverAddress(), 'qs-mini'));
        }
        box.appendChild(el('span', null, text));
        document.body.appendChild(box);
        toastTimer = window.setTimeout(function () {
            if (box.parentNode) {
                box.parentNode.removeChild(box);
            }
        }, 4000);
    }

    function navigate(route) {
        if (window.Dashboard && typeof window.Dashboard.navigate === 'function') {
            window.Dashboard.navigate(route);
        } else {
            window.location.hash = '#/' + route;
        }
    }

    // jellyfin-web rebuilds the home screen only when it is shown after another
    // view, so show the preferences menu (static, no requests of its own) and go
    // home as soon as it is up. done() runs once home is shown.
    function showHomeAgain(done) {
        var stage = 'via';
        var onShow;
        var finish = function () {
            if (stage === 'done') {
                return;
            }
            stage = 'done';
            document.removeEventListener('viewshow', onShow);
            done();
        };
        onShow = function (event) {
            var home = event.target && event.target.id === 'indexPage';
            if (stage === 'via' && !home) {
                stage = 'home';
                navigate('home');
            } else if (stage === 'home' && home) {
                finish();
            }
        };
        document.addEventListener('viewshow', onShow);
        window.setTimeout(function () {
            if (stage === 'via') {
                stage = 'home';
                navigate('home');
            }
        }, 2000);
        window.setTimeout(finish, 6000);
        navigate('mypreferencesmenu');
    }

    function splash(account) {
        overlay.innerHTML = '';
        var box = el('div', 'qs-splash');
        var ring = el('div', 'qs-ring');
        ring.appendChild(avatarCircle(account, serverAddress(), 'qs-avatar'));
        box.appendChild(ring);
        box.appendChild(el('p', 'qs-hi', 'Hi, ' + account.Name));
        overlay.appendChild(box);
    }

    function nameOf(serverId, userId) {
        var saved = list(serverId);
        var at = indexOf(saved, userId);
        return at === -1 ? '' : saved[at].Name;
    }

    // Signs jellyfin-web in as a saved account in place: never a reload, which
    // would drop the webOS app's NativeShell.

    function pick(account) {
        var now = signedIn();
        if (!now || switching) {
            return;
        }
        if (account.UserId === now.userId) {
            toast('Already watching as ' + account.Name, account);
            return;
        }
        var c = client();
        if (typeof c.onAuthenticated !== 'function') {
            toast('This version of jellyfin-web can\u2019t switch accounts in place.', null, true);
            return;
        }
        if (account.Stale || !knownAt(account, serverAddress())) {
            startAdd(false, account);
            return;
        }
        switching = true;
        var started = new Date().getTime();
        splash(account);
        var back = function (message) {
            switching = false;
            if (overlay) {
                render();
            }
            toast(message, null, true);
        };
        request('GET', 'Users/Me', account.AccessToken, function (status, user) {
            if (status === 0) {
                back('Can\u2019t reach the server right now. You\u2019re still watching as ' + nameOf(now.serverId, now.userId) + '.');
                return;
            }
            if (status !== 200 || !user || user.Id !== account.UserId) {
                switching = false;
                markStale(now.serverId, account.UserId);
                account.Stale = true;
                startAdd(false, account);
                return;
            }
            var fresh = { UserId: user.Id, Name: user.Name, AccessToken: account.AccessToken, PrimaryImageTag: user.PrimaryImageTag };
            save(now.serverId, fresh);
            // Made an administrator since it was saved: asked about once the switch is done.
            var promoted = !!(user.Policy && user.Policy.IsAdministrator) && account.Admin !== true;
            var arrived = function () {
                var wait = Math.max(0, SPLASH_MS - (new Date().getTime() - started));
                window.setTimeout(function () {
                    switching = false;
                    close();
                    toast('Now watching as ' + fresh.Name, fresh);
                    if (promoted) {
                        askSaveAdmin({ UserId: fresh.UserId, Name: fresh.Name, AccessToken: fresh.AccessToken, PrimaryImageTag: fresh.PrimaryImageTag, Address: serverAddress() }, now.serverId);
                    }
                }, wait);
            };
            signInInPlace(user, account.AccessToken, now.serverId, arrived, function () {
                back('Couldn\u2019t switch to ' + account.Name + '.');
            });
        });
    }

    // Keys and focus ----------------------------------------------------------

    // On an LG TV the remote's keys reach the page only once something in it
    // has focus. jellyfin-web focuses a card on a home screen with libraries;
    // with none, nothing is focused and the remote does nothing, red button
    // included. So at start-up in the TV layout, when a page has been showing
    // for a few seconds with nothing focused, focus goes to the header.

    function onFirstKey() {
        keyPressed = true;
        document.removeEventListener('keydown', onFirstKey, true);
    }

    function headerTarget() {
        var header = document.querySelector('.skinHeader');
        if (!header) {
            return null;
        }
        var tab = header.querySelector('.emby-tab-button-active');
        if (tab && tab.offsetWidth > 0) {
            return tab;
        }
        var buttons = header.querySelectorAll('button');
        var best = null;
        var bestBox = null;
        for (var i = 0; i < buttons.length; i++) {
            var box = buttons[i].getBoundingClientRect();
            if (box.width === 0 || buttons[i].disabled || buttons[i].className.indexOf('hide') !== -1) {
                continue;
            }
            if (!best || box.top < bestBox.top - 4 || (Math.abs(box.top - bestBox.top) <= 4 && box.left < bestBox.left)) {
                best = buttons[i];
                bestBox = box;
            }
        }
        return best;
    }

    function nothingFocused() {
        var active = document.activeElement;
        return !active || active === document.body || active === document.documentElement;
    }

    function focusAtStart(tries, shownFor) {
        if (keyPressed || tries <= 0) {
            return;
        }
        var page = document.querySelector('.page:not(.hide)');
        var ready = isTv() && !overlay && !adding && signedIn() && !visibleLogin() && page;
        shownFor = ready ? shownFor + 250 : 0;
        if (ready && shownFor >= 2500) {
            if (nothingFocused()) {
                var target = headerTarget();
                if (target) {
                    target.focus();
                }
            }
            return;
        }
        window.setTimeout(function () { focusAtStart(tries - 1, shownFor); }, 250);
    }

    function isBackKey(event) {
        var code = event.keyCode;
        return code === KEY.escape || code === KEY.back || code === KEY.tizenBack || code === KEY.browserBack || event.key === 'GoBack';
    }

    // The controls of the top layer: the open dialog, else the switcher.
    function controls() {
        var scrims = overlay.querySelectorAll('.qs-scrim');
        var layer = scrims.length ? scrims[scrims.length - 1] : overlay;
        var found = layer.querySelectorAll('button');
        var result = [];
        for (var i = 0; i < found.length; i++) {
            if (found[i].offsetWidth > 0) {
                result.push(found[i]);
            }
        }
        return result;
    }

    // Moves focus to the nearest control wholly past the focused one in the
    // arrow's direction, scoring the gap along the arrow plus twice the
    // distance between centres across it; at the edge focus stays put, as in
    // jellyfin-web.
    function moveFocus(code) {
        var items = controls();
        var from = document.activeElement;
        if (items.indexOf(from) === -1) {
            if (items.length) {
                items[0].focus();
            }
            return;
        }
        var a = from.getBoundingClientRect();
        var ax = a.left + a.width / 2;
        var ay = a.top + a.height / 2;
        var best = null;
        var bestScore = Infinity;
        for (var i = 0; i < items.length; i++) {
            if (items[i] === from) {
                continue;
            }
            var b = items[i].getBoundingClientRect();
            var along = code === KEY.left ? a.left - b.right : code === KEY.right ? b.left - a.right : code === KEY.up ? a.top - b.bottom : b.top - a.bottom;
            var across = code === KEY.left || code === KEY.right
                ? Math.abs(b.top + b.height / 2 - ay)
                : Math.abs(b.left + b.width / 2 - ax);
            if (along < -1) {
                continue;
            }
            var score = Math.max(0, along) + 2 * across;
            if (score < bestScore) {
                bestScore = score;
                best = items[i];
            }
        }
        if (best) {
            best.focus();
        }
    }

    // While the switcher is open it takes every key, so jellyfin-web's own
    // focus never moves behind it. The remote's OK is a key, not a click.
    function onKey(event) {
        if (!overlay) {
            return;
        }
        var code = event.keyCode;
        if (code === KEY.red) {
            return;
        }
        event.stopPropagation();
        if (switching || returning) {
            event.preventDefault();
            return;
        }
        if (adding && adding.waiting) {
            event.preventDefault();
            if (isBackKey(event)) {
                adding.waiting = false;
                cancelAdd();
            }
            return;
        }
        var arrow = code === KEY.left || code === KEY.up || code === KEY.right || code === KEY.down;
        if (mode === 'move') {
            event.preventDefault();
            if (code === KEY.left || code === KEY.right) {
                step(code === KEY.left ? -1 : 1);
            } else if (code === KEY.up || code === KEY.down) {
                step((code === KEY.up ? -1 : 1) * moving.perRow);
            } else if (code === KEY.enter) {
                drop();
            } else if (isBackKey(event)) {
                cancelMove();
            }
            return;
        }
        if (arrow) {
            event.preventDefault();
            if (!(mode === 'manage' && manageArrow(code))) {
                moveFocus(code);
            }
            return;
        }
        if (code === KEY.tab) {
            event.preventDefault();
            var items = controls();
            var at = items.indexOf(document.activeElement);
            var next = event.shiftKey ? (at <= 0 ? items.length - 1 : at - 1) : (at + 1) % items.length;
            if (items[next]) {
                items[next].focus();
            }
            return;
        }
        if (code === KEY.enter) {
            event.preventDefault();
            var focused = document.activeElement;
            if (focused && overlay.contains(focused) && typeof focused.click === 'function') {
                focused.click();
            }
            return;
        }
        if (isBackKey(event)) {
            event.preventDefault();
            event.stopPropagation();
            if (mode === 'add') {
                hideAdd();
            } else if (mode === 'confirm') {
                var keep = overlay.querySelector('[data-qs-action="confirm-keep"]');
                if (keep && keep.disabled) {
                    // Waiting for the server: Back still leaves, and a failure that lands later shows nothing.
                    render('manage', 'manage');
                } else if (keep) {
                    keep.click();
                }
            } else if (mode === 'ask') {
                var skip = overlay.querySelector('[data-qs-action="admin-skip"]');
                if (skip) {
                    skip.click();
                }
            } else if (mode === 'manage') {
                render('pick', 'manage');
            } else {
                close();
            }
        }
    }

    // jellyfin-web acts on some keys as they come up, so those stay with the
    // switcher too.
    function onKeyUp(event) {
        if (overlay && event.keyCode !== KEY.red) {
            event.stopPropagation();
        }
    }

    function open(focusOn) {
        if (typeof document === 'undefined' || !document.body) {
            return;
        }
        addStyles();
        if (!overlay) {
            opener = document.activeElement;
            overlay = el('div');
            overlay.id = 'quickswitch';
            overlay.setAttribute('role', 'dialog');
            overlay.setAttribute('aria-modal', 'true');
            overlay.setAttribute('aria-label', 'Who’s watching?');
            document.body.appendChild(overlay);
            document.addEventListener('keydown', onKey, true);
            document.addEventListener('keyup', onKeyUp, true);
            document.addEventListener('focusin', onFocusIn, true);
        }
        render('pick', focusOn);
    }

    // jellyfin-web focuses a page it shows under the switcher (the home
    // screen after a switch or a Back while adding). Focus stays in the
    // switcher, and that element is where it goes when the switcher closes.

    function onFocusIn(event) {
        var target = event.target;
        if (!overlay || adding || target === document.body) {
            return;
        }
        if (overlay.contains(target)) {
            lastFocus = target;
            if (mode === 'manage') {
                showBin(slotOf(target));
            }
            updateHints();
            return;
        }
        opener = target;
        if (lastFocus && overlay.contains(lastFocus)) {
            lastFocus.focus();
        }
    }

    // keepFocus leaves focus where it is: on the sign-in page, jellyfin-web's.
    function close(keepFocus) {
        if (!overlay) {
            return;
        }
        document.removeEventListener('keydown', onKey, true);
        document.removeEventListener('keyup', onKeyUp, true);
        document.removeEventListener('focusin', onFocusIn, true);
        moving = null;
        onDragEnd();
        lastFocus = null;
        overlay.parentNode.removeChild(overlay);
        overlay = null;
        if (!keepFocus && opener && document.body.contains(opener) && typeof opener.focus === 'function') {
            opener.focus();
        }
        opener = null;
    }

    // Entry points ------------------------------------------------------------

    // Where the switcher opens from: an item in the desktop and
    // phone User Menu, a row in the TV settings page's User section, and the
    // remote's red button. The first two are found by the structure jellyfin-web
    // gives them; when that changes they are simply not added.

    // Up to three other saved accounts, shown as small circles beside an entry.
    function others() {
        var now = signedIn();
        var saved = now ? list(now.serverId) : [];
        var result = [];
        for (var i = 0; i < saved.length && result.length < 3; i++) {
            if (saved[i].UserId !== now.userId) {
                result.push(saved[i]);
            }
        }
        return result;
    }

    // Fills an entry's circles again only when the accounts changed, so the
    // observer below doesn't feed on its own changes.
    function updateStack(entry) {
        var accounts = others();
        var key = '';
        for (var i = 0; i < accounts.length; i++) {
            key += accounts[i].UserId + (accounts[i].PrimaryImageTag || '') + ',';
        }
        if (entry.getAttribute('data-qs-stack') === key) {
            return;
        }
        entry.setAttribute('data-qs-stack', key);
        var box = entry.querySelector('.qs-stack');
        box.innerHTML = '';
        var server = serverAddress();
        for (var j = 0; j < accounts.length; j++) {
            box.appendChild(avatarCircle(accounts[j], server, 'qs-dot'));
        }
    }

    function stack() {
        var box = el('span', 'qs-stack');
        box.setAttribute('aria-hidden', 'true');
        return box;
    }

    function classOf(root, selector) {
        var found = root.querySelector(selector);
        return found ? found.getAttribute('class') || '' : '';
    }

    function closest(node, attribute, value) {
        while (node && node.getAttribute) {
            if (node.getAttribute(attribute) === value) {
                return node;
            }
            node = node.parentNode;
        }
        return null;
    }

    // jellyfin-web's MUI menu closes when its backdrop is clicked; the switcher
    // opens once the menu is gone, so the menu doesn't take focus back from it.
    function openFromMenu() {
        var backdrop = document.querySelector('#app-user-menu .MuiBackdrop-root');
        if (backdrop) {
            backdrop.click();
        }
        var tries = 0;
        var wait = function () {
            var menu = document.getElementById('app-user-menu');
            if (!menu || menu.className.indexOf('MuiModal-hidden') !== -1 || ++tries > 20) {
                open();
            } else {
                window.setTimeout(wait, 50);
            }
        };
        window.setTimeout(wait, 50);
    }

    // The User Menu item takes its classes from Sign Out, so it looks and
    // behaves like the items around it, and sits just above it.
    function addMenuItem() {
        var root = document.getElementById('app-user-menu');
        var menu = root && root.querySelector('[role="menu"]');
        if (!menu) {
            return;
        }
        var item = menu.querySelector('[data-qs-entry]');
        if (!item) {
            var logout = menu.querySelector('[data-testid="LogoutIcon"]');
            var model = logout ? closest(logout, 'role', 'menuitem') : null;
            if (!model) {
                return;
            }
            item = el('li', model.getAttribute('class'));
            item.setAttribute('role', 'menuitem');
            item.setAttribute('tabindex', '-1');
            item.setAttribute('data-qs-entry', 'menu');
            var iconBox = el('div', classOf(model, '.MuiListItemIcon-root'));
            var svg = icon('switchAccount', 24);
            svg.setAttribute('class', classOf(model, 'svg'));
            iconBox.appendChild(svg);
            item.appendChild(iconBox);
            var textBox = el('div', classOf(model, '.MuiListItemText-root'));
            textBox.appendChild(el('span', classOf(model, '.MuiListItemText-primary'), 'Switch Account'));
            item.appendChild(textBox);
            item.appendChild(stack());
            item.addEventListener('click', openFromMenu);
            item.addEventListener('keydown', function (event) {
                if (event.keyCode === KEY.enter || event.keyCode === KEY.space) {
                    event.preventDefault();
                    openFromMenu();
                }
            });
            addStyles();
            model.parentNode.insertBefore(item, model);
        }
        updateStack(item);
    }

    // The TV settings page row copies Sign Out's markup and goes first in the
    // User section.
    function addSettingsRow() {
        var page = document.getElementById('myPreferencesMenuPage');
        var section = page && page.querySelector('.userSection');
        if (!section || !isTv()) {
            return;
        }
        var row = section.querySelector('[data-qs-entry]');
        if (!row) {
            var model = section.querySelector('.btnLogout');
            if (!model) {
                return;
            }
            row = el('a', model.getAttribute('class').replace(/\s*\bbtnLogout\b/, ''));
            row.href = '#';
            row.setAttribute('data-qs-entry', 'settings');
            row.style.cssText = model.style.cssText;
            var line = el('div', 'listItem');
            var glyph = el('span', 'material-icons listItemIcon listItemIcon-transparent switch_account');
            glyph.setAttribute('aria-hidden', 'true');
            line.appendChild(glyph);
            var body = el('div', 'listItemBody');
            body.appendChild(el('div', 'listItemBodyText', 'Switch Account'));
            line.appendChild(body);
            line.appendChild(stack());
            row.appendChild(line);
            row.addEventListener('click', function (event) {
                event.preventDefault();
                open();
            });
            addStyles();
            var title = section.querySelector('.sectionTitle');
            section.insertBefore(row, title ? title.nextSibling : section.firstChild);
        }
        updateStack(row);
    }

    function addEntries() {
        if (adding) {
            decorateLogin();
        }
        if (signedIn()) {
            addMenuItem();
            addSettingsRow();
        }
    }

    // The red button is the switcher's only while it is open, or when it opens
    // it; anywhere else it is left to jellyfin-web and other scripts.
    function onRedButton(event) {
        if (event.keyCode !== KEY.red || (!overlay && !signedIn())) {
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        if (!overlay) {
            open();
        }
    }

    // Start-up ----------------------------------------------------------------

    function start() {
        var queued = false;
        var observer = new window.MutationObserver(function () {
            if (!queued) {
                queued = true;
                window.setTimeout(function () {
                    queued = false;
                    addEntries();
                }, 0);
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
        document.addEventListener('keydown', onRedButton, true);
        resumeAfterRestart(60);
        document.addEventListener('keydown', onFirstKey, true);
        focusAtStart(60, 0);
        document.addEventListener('keydown', onAddingKey, true);
        window.addEventListener('popstate', onAddingRoute);
        window.addEventListener('hashchange', onAddingRoute);
        addEntries();
    }

    // The switcher's only public surface.
    window.QuickSwitch = {
        version: VERSION,
        open: open,
        close: close
    };

    // The unit tests provide this object before the script runs to reach its
    // internals; jellyfin-web never does, so no page script is handed them.
    var hook = window.QuickSwitchTestHook;
    if (hook && typeof hook === 'object') {
        hook.store = { list: list, save: save, forget: forget, move: move, markStale: markStale, startAdding: startAdding, addingFrom: addingFrom, stopAdding: stopAdding };
        hook.avatar = avatar;
    }

    if (typeof window.setInterval === 'function') {
        window.setInterval(watch, 1000);
    }

    if (typeof document !== 'undefined' && typeof window.MutationObserver === 'function') {
        if (document.body) {
            start();
        } else {
            document.addEventListener('DOMContentLoaded', start);
        }
    }
})();
