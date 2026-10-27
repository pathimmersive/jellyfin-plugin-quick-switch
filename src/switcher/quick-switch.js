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
    var ACCENT = '#00a4dc';
    // Avatar colours for accounts without a profile picture; white text passes 3:1 on each at tile size.
    var COLORS = ['#0081b0', '#8e44ad', '#c0561b', '#1f8a4c', '#b03a6b', '#5a6acf', '#8a6d00', '#00796b'];
    var ICONS = {
        check: 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z',
        plus: 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z',
        edit: 'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z',
        close: 'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z'
    };
    var KEY = { escape: 27, back: 461, tizenBack: 10009, browserBack: 166 };

    // Saved accounts, per server, in this browser's localStorage. Only accounts
    // that signed in on this device are ever saved.

    function readStore() {
        var value;
        try {
            value = JSON.parse(window.localStorage.getItem(STORE_KEY) || '{}');
        } catch (e) {
            value = {};
        }
        if (!value || typeof value !== 'object') {
            value = {};
        }
        if (!value.servers || typeof value.servers !== 'object') {
            value.servers = {};
        }
        return value;
    }

    function writeStore(value) {
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

    // Adds the account, or replaces its saved token and details in place.
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
        if (at === -1) {
            accounts.push(entry);
        } else {
            accounts[at] = entry;
        }
        value.servers[serverId] = accounts;
        writeStore(value);
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

    // The same user id always gets the same colour.
    function colorFor(userId) {
        var hash = 0;
        var text = String(userId || '');
        for (var i = 0; i < text.length; i++) {
            hash = (hash * 31 + text.charCodeAt(i)) % 2147483647;
        }
        return COLORS[hash % COLORS.length];
    }

    function avatar(account, serverAddress, size) {
        var name = String((account && account.Name) || '?');
        var url = null;
        if (account && account.PrimaryImageTag && serverAddress) {
            url = String(serverAddress).replace(/\/+$/, '') + '/Users/' + encodeURIComponent(account.UserId)
                + '/Images/Primary?tag=' + encodeURIComponent(account.PrimaryImageTag)
                + '&quality=90&maxHeight=' + (size || 360);
        }
        return { initial: name.charAt(0).toUpperCase(), color: colorFor(account && account.UserId), imageUrl: url };
    }

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
            var data = null;
            try { data = JSON.parse(xhr.responseText); } catch (e) { data = null; }
            done(xhr.status, data);
        };
        xhr.onerror = xhr.ontimeout = function () { done(0, null); };
        xhr.send();
    }

    // Whoever signs in on this device is saved, or their token replaced. The
    // server is asked only when the signed-in user or token changes.
    var lastSeen = '';

    function watch() {
        var now = signedIn();
        if (!now) {
            return;
        }
        var key = now.serverId + '|' + now.userId + '|' + now.token;
        if (key === lastSeen) {
            return;
        }
        lastSeen = key;
        var saved = list(now.serverId);
        var at = indexOf(saved, now.userId);
        if (at !== -1 && saved[at].AccessToken === now.token && saved[at].Name) {
            return;
        }
        request('GET', 'Users/Me', now.token, function (status, user) {
            if (status === 200 && user && user.Id === now.userId) {
                save(now.serverId, { UserId: user.Id, Name: user.Name, AccessToken: now.token, PrimaryImageTag: user.PrimaryImageTag });
            } else {
                lastSeen = '';
            }
        });
    }

    // The switcher overlay.

    var CSS = ''
        + '#quickswitch{position:fixed;top:0;right:0;bottom:0;left:0;z-index:100000;display:flex;align-items:center;justify-content:center;'
        + 'background:rgba(16,16,16,.86);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);color:rgba(255,255,255,.7);font-family:inherit;}'
        + '#quickswitch *{box-sizing:border-box;}'
        + '#quickswitch .qs-panel{display:flex;flex-direction:column;align-items:center;max-width:100%;max-height:100%;overflow:auto;padding:36px 24px;text-align:center;}'
        + '#quickswitch h1{margin:0;font-size:30px;font-weight:400;color:#fff;}'
        + '#quickswitch .qs-sub{margin:8px 0 0;font-size:15px;}'
        + '#quickswitch .qs-row{display:flex;flex-wrap:wrap;justify-content:center;align-items:flex-start;margin:34px 0 18px;max-width:1040px;}'
        + '#quickswitch .qs-tile{display:flex;flex-direction:column;align-items:center;width:180px;margin:0 14px 30px;padding:0;border:0;background:none;color:inherit;font:inherit;cursor:pointer;outline:none;}'
        + '#quickswitch .qs-avatar{position:relative;display:flex;align-items:center;justify-content:center;width:164px;height:164px;border-radius:50%;'
        + 'transition:transform .16s ease-out,box-shadow .16s ease-out;}'
        + '#quickswitch .qs-avatar img{width:100%;height:100%;border-radius:50%;object-fit:cover;}'
        + '#quickswitch .qs-initial{font-size:72px;font-weight:500;line-height:1;color:#fff;}'
        + '#quickswitch .qs-tile:focus .qs-avatar,#quickswitch .qs-tile:hover .qs-avatar{-webkit-transform:scale(1.08);transform:scale(1.08);'
        + 'box-shadow:0 0 0 5px ' + ACCENT + ',0 14px 36px rgba(0,0,0,.55);}'
        + '#quickswitch .qs-name{margin-top:12px;font-size:18px;}'
        + '#quickswitch .qs-tile:focus .qs-name,#quickswitch .qs-tile:hover .qs-name{color:#fff;font-weight:600;}'
        + '#quickswitch .qs-tag{margin-top:4px;font-size:14px;color:' + ACCENT + ';}'
        + '#quickswitch .qs-badge{position:absolute;right:2%;bottom:2%;display:flex;align-items:center;justify-content:center;width:36px;height:36px;'
        + 'border-radius:50%;background:' + ACCENT + ';box-shadow:0 0 0 4px #101010;}'
        + '#quickswitch .qs-add .qs-avatar{background:#292929;}'
        + '#quickswitch .qs-button{display:flex;align-items:center;padding:10px 20px;border:0;border-radius:4px;background:#424242;color:rgba(255,255,255,.87);'
        + 'font:inherit;font-size:15px;font-weight:600;cursor:pointer;outline:none;}'
        + '#quickswitch .qs-button svg{margin-right:10px;}'
        + '#quickswitch .qs-button:focus,#quickswitch .qs-button:hover{background:' + ACCENT + ';color:rgba(0,0,0,.87);}'
        + '#quickswitch .qs-close{position:absolute;top:16px;right:16px;display:flex;align-items:center;justify-content:center;width:48px;height:48px;'
        + 'padding:0;border:0;border-radius:50%;background:none;cursor:pointer;outline:none;}'
        + '#quickswitch .qs-close:focus,#quickswitch .qs-close:hover{background:rgba(255,255,255,.12);}'
        + '#quickswitch .qs-hints{position:absolute;right:42px;bottom:28px;display:flex;align-items:center;font-size:16px;}'
        + '#quickswitch .qs-hints>span{display:flex;align-items:center;margin-left:24px;}'
        + '#quickswitch .qs-key{margin-right:8px;padding:2px 8px;border-radius:4px;background:#292929;color:rgba(255,255,255,.87);font-weight:600;}'
        + '#quickswitch .qs-red{width:16px;height:16px;margin-right:8px;border-radius:50%;background:#e53935;}'
        + '#quickswitch.qs-tv h1{font-size:36px;}'
        + '#quickswitch.qs-tv .qs-sub{font-size:20px;}'
        + '#quickswitch.qs-tv .qs-row{margin:48px 0 18px;}'
        + '#quickswitch.qs-tv .qs-name{font-size:22px;}'
        + '#quickswitch.qs-tv .qs-tag{font-size:17px;}'
        + '#quickswitch.qs-tv .qs-button{padding:14px 26px;font-size:20px;}'
        + '#quickswitch.qs-many .qs-avatar{width:132px;height:132px;}'
        + '#quickswitch.qs-many .qs-initial{font-size:58px;}'
        + '#quickswitch.qs-many .qs-tile{width:150px;}'
        + '@media (max-width:600px){#quickswitch .qs-row{max-width:300px;}#quickswitch .qs-tile{width:120px;margin:0 15px 26px;}'
        + '#quickswitch .qs-avatar{width:104px;height:104px;}#quickswitch .qs-initial{font-size:46px;}#quickswitch h1{font-size:26px;}'
        + '#quickswitch .qs-name{font-size:16px;}}';

    var overlay = null;
    var opener = null;

    function addStyles() {
        if (document.getElementById('quickswitch-style')) {
            return;
        }
        var style = document.createElement('style');
        style.id = 'quickswitch-style';
        style.textContent = CSS;
        document.head.appendChild(style);
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

    function tile(account, current, server) {
        var picture = avatar(account, server, 360);
        var button = el('button', 'qs-tile');
        button.type = 'button';
        button.setAttribute('data-qs-user', account.UserId);
        button.setAttribute('aria-label', account.Name + (current ? ', watching now' : ''));
        var circle = el('span', 'qs-avatar');
        circle.style.background = picture.color;
        if (picture.imageUrl) {
            var image = document.createElement('img');
            image.alt = '';
            image.src = picture.imageUrl;
            circle.appendChild(image);
        } else {
            circle.appendChild(el('span', 'qs-initial', picture.initial));
        }
        if (current) {
            var badge = el('span', 'qs-badge');
            badge.appendChild(icon('check', 22, 'rgba(0,0,0,.87)'));
            circle.appendChild(badge);
        }
        button.appendChild(circle);
        button.appendChild(el('span', 'qs-name', account.Name));
        if (current) {
            button.appendChild(el('span', 'qs-tag', 'Watching now'));
        }
        return button;
    }

    function addTile() {
        var button = el('button', 'qs-tile qs-add');
        button.type = 'button';
        button.setAttribute('data-qs-action', 'add');
        var circle = el('span', 'qs-avatar');
        circle.appendChild(icon('plus', 60, 'rgba(255,255,255,.7)'));
        button.appendChild(circle);
        button.appendChild(el('span', 'qs-name', 'Add Account'));
        return button;
    }

    function hints() {
        var box = el('div', 'qs-hints');
        box.setAttribute('aria-hidden', 'true');
        var ok = el('span');
        ok.appendChild(el('span', 'qs-key', 'OK'));
        ok.appendChild(document.createTextNode('Select'));
        var back = el('span');
        back.appendChild(el('span', 'qs-key', 'BACK'));
        back.appendChild(document.createTextNode('Close'));
        var red = el('span');
        red.appendChild(el('span', 'qs-red'));
        red.appendChild(document.createTextNode('Opens this from any screen'));
        box.appendChild(ok);
        box.appendChild(back);
        box.appendChild(red);
        return box;
    }

    function render() {
        var now = signedIn();
        var tv = isTv();
        var accounts = now ? list(now.serverId) : [];
        var server = serverAddress();
        var device = tv ? 'this TV' : 'this device';

        overlay.className = (tv ? 'qs-tv' : '') + (accounts.length > 4 ? ' qs-many' : '');
        overlay.innerHTML = '';
        var panel = el('div', 'qs-panel');
        var single = accounts.length === 1;
        panel.appendChild(el('h1', null, single ? 'Add someone to switch to' : 'Who’s watching?'));
        panel.appendChild(el('p', 'qs-sub', single
            ? 'Accounts you add stay on ' + device + ', so switching needs no password'
            : 'Switch accounts on ' + device + ' without a password'));
        var row = el('div', 'qs-row');
        var focusFirst = null;
        for (var i = 0; i < accounts.length; i++) {
            var current = !!now && accounts[i].UserId === now.userId;
            var button = tile(accounts[i], current, server);
            if (current) {
                focusFirst = button;
            }
            row.appendChild(button);
        }
        var add = addTile();
        row.appendChild(add);
        panel.appendChild(row);
        var manage = el('button', 'qs-button');
        manage.type = 'button';
        manage.setAttribute('data-qs-action', 'manage');
        manage.appendChild(icon('edit', 22));
        manage.appendChild(document.createTextNode('Manage Accounts'));
        panel.appendChild(manage);
        overlay.appendChild(panel);

        if (tv) {
            overlay.appendChild(hints());
        } else {
            var closeButton = el('button', 'qs-close');
            closeButton.type = 'button';
            closeButton.setAttribute('data-qs-action', 'close');
            closeButton.setAttribute('aria-label', 'Close');
            closeButton.appendChild(icon('close', 26, '#fff'));
            closeButton.addEventListener('click', close);
            overlay.appendChild(closeButton);
        }
        (focusFirst || add).focus();
    }

    function onKey(event) {
        if (!overlay) {
            return;
        }
        var code = event.keyCode;
        if (code === KEY.escape || code === KEY.back || code === KEY.tizenBack || code === KEY.browserBack || event.key === 'GoBack') {
            event.preventDefault();
            event.stopPropagation();
            close();
        }
    }

    function open() {
        if (!document.body) {
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
        }
        render();
    }

    function close() {
        if (!overlay) {
            return;
        }
        document.removeEventListener('keydown', onKey, true);
        overlay.parentNode.removeChild(overlay);
        overlay = null;
        if (opener && document.body.contains(opener) && typeof opener.focus === 'function') {
            opener.focus();
        }
        opener = null;
    }

    window.QuickSwitch = {
        version: VERSION,
        open: open,
        close: close,
        store: { list: list, save: save, forget: forget },
        avatar: avatar
    };

    if (typeof window.setInterval === 'function') {
        window.setInterval(watch, 1000);
    }
})();
