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
        close: 'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
        error: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z',
        lock: 'M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z',
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
                var account = { UserId: user.Id, Name: user.Name, AccessToken: now.token, PrimaryImageTag: user.PrimaryImageTag };
                save(now.serverId, account);
                if (adding) {
                    added(account);
                }
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
        + '#quickswitch .qs-splash{display:flex;flex-direction:column;align-items:center;}'
        + '#quickswitch .qs-ring{position:relative;display:flex;align-items:center;justify-content:center;width:236px;height:236px;margin-bottom:28px;}'
        + '#quickswitch .qs-ring:before{content:"";position:absolute;top:0;right:0;bottom:0;left:0;border-radius:50%;border:5px solid #292929;'
        + 'border-top-color:' + ACCENT + ';-webkit-animation:qs-spin 1.1s linear infinite;animation:qs-spin 1.1s linear infinite;}'
        + '#quickswitch .qs-ring .qs-avatar{width:196px;height:196px;}'
        + '#quickswitch .qs-ring .qs-initial{font-size:88px;}'
        + '#quickswitch .qs-hi{margin:0;font-size:30px;font-weight:400;color:#fff;}'
        + '#quickswitch.qs-tv .qs-hi{font-size:36px;}'
        + '@-webkit-keyframes qs-spin{to{-webkit-transform:rotate(360deg);}}@keyframes qs-spin{to{transform:rotate(360deg);}}'
        + '.qs-toast{position:fixed;left:24px;bottom:24px;z-index:100001;display:flex;align-items:center;max-width:80%;padding:10px 20px 10px 10px;'
        + 'border-radius:4px;background:#303030;color:#fff;font-size:15px;box-shadow:0 6px 18px rgba(0,0,0,.45);}'
        + '.qs-toast.qs-plain{padding-left:20px;}'
        + '.qs-toast .qs-mini{display:flex;flex:none;align-items:center;justify-content:center;width:32px;height:32px;margin-right:12px;border-radius:50%;'
        + 'overflow:hidden;color:#fff;font-size:15px;font-weight:600;}'
        + '.qs-toast .qs-mini img{width:100%;height:100%;object-fit:cover;}'
        + '.qs-toast svg{flex:none;margin-right:12px;}'
        + '.layout-tv .qs-toast{font-size:20px;}'
        + '#quickswitch .qs-scrim{position:absolute;top:0;right:0;bottom:0;left:0;display:flex;align-items:center;justify-content:center;padding:16px;'
        + 'background:rgba(0,0,0,.7);}'
        + '#quickswitch .qs-dialog{display:flex;flex-direction:column;width:580px;max-width:100%;padding:36px 32px 24px;border-radius:12px;background:#202020;'
        + 'box-shadow:0 30px 80px rgba(0,0,0,.7);text-align:center;}'
        + '#quickswitch .qs-dialog-icon{display:flex;align-self:center;align-items:center;justify-content:center;width:64px;height:64px;margin-bottom:16px;'
        + 'border-radius:50%;background:#292929;}'
        + '#quickswitch .qs-dialog h2{margin:0 0 14px;font-size:28px;font-weight:600;color:#fff;}'
        + '#quickswitch .qs-dialog p{margin:0 0 24px;font-size:17px;line-height:1.5;}'
        + '#quickswitch .qs-card{display:flex;align-items:center;margin:0 0 14px;padding:18px 22px;border:0;border-radius:10px;background:#292929;color:#fff;'
        + 'font:inherit;text-align:left;cursor:pointer;outline:none;transition:background .15s,box-shadow .15s;}'
        + '#quickswitch .qs-card:focus,#quickswitch .qs-card:hover{background:#fff;color:#101010;box-shadow:0 0 0 3px #202020,0 0 0 7px ' + ACCENT + ';}'
        + '#quickswitch .qs-card-badge{display:flex;flex:none;align-items:center;justify-content:center;width:48px;height:48px;margin-right:18px;'
        + 'border-radius:50%;background:#383838;color:rgba(255,255,255,.87);}'
        + '#quickswitch .qs-card:focus .qs-card-badge,#quickswitch .qs-card:hover .qs-card-badge{background:' + ACCENT + ';color:rgba(0,0,0,.87);}'
        + '#quickswitch .qs-card-title{display:block;font-size:19px;font-weight:600;}'
        + '#quickswitch .qs-card-sub{display:block;margin-top:3px;font-size:15px;color:rgba(255,255,255,.7);}'
        + '#quickswitch .qs-card:focus .qs-card-sub,#quickswitch .qs-card:hover .qs-card-sub{color:#4a4a4a;}'
        + '#quickswitch .qs-cancel{align-self:center;margin-top:6px;padding:10px 28px;border:0;border-radius:4px;background:none;color:rgba(255,255,255,.87);'
        + 'font:inherit;font-size:17px;font-weight:600;cursor:pointer;outline:none;}'
        + '#quickswitch .qs-cancel:focus,#quickswitch .qs-cancel:hover{background:rgba(255,255,255,.12);}'
        + '#quickswitch .qs-stale .qs-avatar{background:#333 !important;}'
        + '#quickswitch .qs-stale .qs-avatar img{opacity:.35;}'
        + '#quickswitch .qs-stale .qs-initial{color:#8a8a8a;}'
        + '#quickswitch .qs-stale .qs-tag{color:rgba(255,255,255,.7);}'
        + '#quickswitch .qs-lock{background:#424242;}'
        + '.qs-notice .qs-mini.qs-locked{background:#333 !important;}'
        + '#quickswitch .qs-remove{position:absolute;top:0;right:0;bottom:0;left:0;display:flex;align-items:center;justify-content:center;'
        + 'border-radius:50%;background:rgba(0,0,0,.6);}'
        + '#quickswitch .qs-confirm{width:560px;padding:36px 32px 28px;border-radius:4px;box-shadow:0 8px 30px rgba(0,0,0,.6);}'
        + '#quickswitch .qs-confirm .qs-avatar{align-self:center;width:96px;height:96px;margin-bottom:18px;}'
        + '#quickswitch .qs-confirm .qs-initial{font-size:44px;}'
        + '#quickswitch .qs-confirm h2{font-weight:400;margin-bottom:18px;}'
        + '#quickswitch .qs-confirm p{margin-bottom:26px;}'
        + '#quickswitch .qs-wide{display:block;width:100%;margin-top:10px;padding:16px;font-size:18px;text-align:center;}'
        + '.qs-notice-row{display:flex;justify-content:center;margin:0 0 22px;}'
        + '.qs-notice{display:flex;align-items:center;padding:8px 16px 8px 8px;border-radius:4px;background:#202020;color:rgba(255,255,255,.87);font-size:17px;text-align:left;}'
        + '.qs-notice .qs-mini{display:flex;flex:none;align-items:center;justify-content:center;width:30px;height:30px;margin-right:12px;border-radius:50%;'
        + 'overflow:hidden;color:#fff;font-size:14px;font-weight:600;}'
        + '.qs-notice .qs-mini img{width:100%;height:100%;object-fit:cover;}'
        + '.dialog .qs-notice-row{margin:1em 0 0;}'
        + '[data-qs-entry="menu"] .MuiListItemText-primary{white-space:nowrap;}'
        + '.qs-stack{display:flex;flex:none;align-items:center;margin-left:16px;}'
        + '.qs-stack .qs-dot{display:block;width:18px;height:18px;margin-left:-6px;border-radius:50%;overflow:hidden;box-shadow:0 0 0 2px #383838;}'
        + '.qs-stack .qs-dot:first-child{margin-left:0;}'
        + '.qs-stack .qs-dot img{display:block;width:100%;height:100%;object-fit:cover;}'
        + '.qs-stack .qs-initial{display:none;}'
        + '[data-qs-entry="settings"] .listItem{display:flex;align-items:center;}'
        + '[data-qs-entry="settings"] .listItemBody{flex:1;}'
        + '[data-qs-entry="settings"] .qs-stack{padding-right:10px;}'
        + '[data-qs-entry="settings"] .qs-dot{width:26px;height:26px;margin-left:-8px;box-shadow:0 0 0 2px #101010;}'
        + '[data-qs-entry="settings"]:focus .qs-dot{box-shadow:0 0 0 2px ' + ACCENT + ';}'
        + '@media (max-width:600px){#quickswitch .qs-row{max-width:300px;}#quickswitch .qs-tile{width:120px;margin:0 15px 26px;}'
        + '#quickswitch .qs-avatar{width:104px;height:104px;}#quickswitch .qs-initial{font-size:46px;}#quickswitch h1{font-size:26px;}'
        + '#quickswitch .qs-name{font-size:16px;}}';

    var overlay = null;
    var mode = 'pick';
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

    function tile(account, current, server, managing) {
        var button = el('button', 'qs-tile');
        button.type = 'button';
        button.setAttribute('data-qs-user', account.UserId);
        var stale = !current && !managing && account.Stale;
        var tag = current ? (managing ? 'Signed in now' : 'Watching now') : stale ? 'Sign in again' : '';
        if (stale) {
            button.className += ' qs-stale';
        }
        button.setAttribute('aria-label', account.Name + (tag ? ', ' + tag.toLowerCase() : '') + (managing && !current ? ', remove' : ''));
        button.addEventListener('click', function () {
            if (!managing) {
                pick(account);
            } else if (current) {
                toast(account.Name + ' is signed in now, so it stays', account);
            } else {
                showConfirm(account);
            }
        });
        var circle = avatarCircle(account, server, 'qs-avatar');
        if (managing && !current) {
            var cover = el('span', 'qs-remove');
            cover.appendChild(icon('trash', 46, '#fff'));
            circle.appendChild(cover);
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

    function hints(backLabel) {
        var box = el('div', 'qs-hints');
        box.setAttribute('aria-hidden', 'true');
        var ok = el('span');
        ok.appendChild(el('span', 'qs-key', 'OK'));
        ok.appendChild(document.createTextNode('Select'));
        var back = el('span');
        back.appendChild(el('span', 'qs-key', 'BACK'));
        back.appendChild(document.createTextNode(backLabel));
        var red = el('span');
        red.appendChild(el('span', 'qs-red'));
        red.appendChild(document.createTextNode('Opens this from any screen'));
        box.appendChild(ok);
        box.appendChild(back);
        box.appendChild(red);
        return box;
    }

    // nextMode is 'pick' (Who's watching?) or 'manage' (Manage Accounts);
    // focusOn names what gets focus, a user id or 'manage'.
    function render(nextMode, focusOn) {
        mode = nextMode === 'manage' ? 'manage' : 'pick';
        var managing = mode === 'manage';
        var now = signedIn();
        var tv = isTv();
        var accounts = now ? list(now.serverId) : [];
        var server = serverAddress();
        var device = tv ? 'this TV' : 'this device';

        overlay.className = (tv ? 'qs-tv' : '') + (accounts.length > 4 ? ' qs-many' : '');
        overlay.innerHTML = '';
        var panel = el('div', 'qs-panel');
        var single = accounts.length === 1 && !managing;
        panel.appendChild(el('h1', null, managing ? 'Manage Accounts' : single ? 'Add someone to switch to' : 'Who’s watching?'));
        panel.appendChild(el('p', 'qs-sub', managing
            ? 'Choose an account to remove from ' + device
            : single
                ? 'Accounts you add stay on ' + device + ', so switching needs no password'
                : 'Switch accounts on ' + device + ' without a password'));
        var row = el('div', 'qs-row');
        var focusFirst = null;
        for (var i = 0; i < accounts.length; i++) {
            var current = !!now && accounts[i].UserId === now.userId;
            var button = tile(accounts[i], current, server, managing);
            if (focusOn ? accounts[i].UserId === focusOn : current) {
                focusFirst = button;
            }
            row.appendChild(button);
        }
        var add = managing ? null : addTile();
        if (add) {
            row.appendChild(add);
        }
        panel.appendChild(row);
        var manage = el('button', 'qs-button');
        manage.type = 'button';
        manage.setAttribute('data-qs-action', 'manage');
        manage.appendChild(icon('edit', 22));
        manage.appendChild(document.createTextNode(managing ? 'Done' : 'Manage Accounts'));
        manage.addEventListener('click', function () { render(managing ? 'pick' : 'manage', 'manage'); });
        panel.appendChild(manage);
        if (focusOn === 'manage') {
            focusFirst = manage;
        }
        overlay.appendChild(panel);

        if (tv) {
            overlay.appendChild(hints(managing ? 'Done' : 'Close'));
        } else {
            var closeButton = el('button', 'qs-close');
            closeButton.type = 'button';
            closeButton.setAttribute('data-qs-action', 'close');
            closeButton.setAttribute('aria-label', 'Close');
            closeButton.appendChild(icon('close', 26, '#fff'));
            closeButton.addEventListener('click', close);
            overlay.appendChild(closeButton);
        }
        (focusFirst || add || manage).focus();
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
        dialog.appendChild(el('p', null, account.Name + ' is signed out here. Their account and watch history stay on the server, and signing in again adds them back.'));
        var keep = el('button', 'qs-button qs-wide', 'Keep');
        keep.type = 'button';
        keep.setAttribute('data-qs-action', 'confirm-keep');
        keep.addEventListener('click', function () { render('manage', account.UserId); });
        var remove = el('button', 'qs-button qs-wide', 'Remove');
        remove.type = 'button';
        remove.setAttribute('data-qs-action', 'confirm-remove');
        remove.addEventListener('click', function () { removeAccount(account); });
        dialog.appendChild(keep);
        dialog.appendChild(remove);
        scrim.appendChild(dialog);
        overlay.appendChild(scrim);
        keep.focus();
    }

    // Revokes the removed account's own token (decision 0004), then forgets
    // it whatever the server said; the account signed in is never touched.
    var removing = false;

    function removeAccount(account) {
        var now = signedIn();
        if (!now || removing || account.UserId === now.userId) {
            return;
        }
        removing = true;
        request('POST', 'Sessions/Logout', account.AccessToken, function () {
            removing = false;
            forget(now.serverId, account.UserId);
            if (overlay) {
                render('manage', 'manage');
            }
            toast(account.Name + ' removed from ' + deviceWord());
        });
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

    // Adding an account signs the current one out on this device only: its
    // token is kept in the store, never revoked, and comes back on Back.
    var adding = null;

    // again, when given, is a saved account whose sign-in stopped working:
    // the sign-in page opens for that account.
    function startAdd(quick, again) {
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
        close();
        navigate('login?serverid=' + now.serverId);
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
        return notice(adding.previous, 'Adding an account. ' + name + ' stays saved; Back returns to ' + name + '.');
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

    function added(account) {
        var again = adding.again && adding.again.UserId === account.UserId;
        stopAdding(adding.serverId);
        adding = null;
        removeNotices();
        toast(again ? 'Now watching as ' + account.Name : account.Name + ' is saved on ' + deviceWord(), account);
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

    // Back on the sign-in page while adding: the previous account again, in place.
    function cancelAdd() {
        var previous = adding.previous;
        var serverId = adding.serverId;
        adding = null;
        removeNotices();
        restore(serverId, previous);
    }

    // Signs previous back in after an add that didn't finish. An unreachable
    // server leaves the add remembered, to try again at the next load; a
    // rejected sign-in marks the account instead.
    function restore(serverId, previous) {
        request('GET', 'Users/Me', previous.AccessToken, function (status, user) {
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
                toast('Now watching as ' + previous.Name, previous);
            }, function () {
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

    function isBackKey(event) {
        var code = event.keyCode;
        return code === KEY.escape || code === KEY.back || code === KEY.tizenBack || code === KEY.browserBack || event.key === 'GoBack';
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

    // Bottom-left notice in jellyfin-web's toast style; with an account it shows that account's avatar.
    var toastTimer = null;

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
        var onShow = function (event) {
            var home = event.target && event.target.id === 'indexPage';
            if (stage === 'via' && !home) {
                stage = 'home';
                navigate('home');
            } else if (stage === 'home' && home) {
                finish();
            }
        };
        var finish = function () {
            if (stage === 'done') {
                return;
            }
            stage = 'done';
            document.removeEventListener('viewshow', onShow);
            done();
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
    var switching = false;

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
        if (account.Stale) {
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
            var arrived = function () {
                var wait = Math.max(0, SPLASH_MS - (new Date().getTime() - started));
                window.setTimeout(function () {
                    switching = false;
                    close();
                    toast('Now watching as ' + fresh.Name, fresh);
                }, wait);
            };
            signInInPlace(user, account.AccessToken, now.serverId, arrived, function () {
                back('Couldn\u2019t switch to ' + account.Name + '.');
            });
        });
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
        if (switching) {
            event.preventDefault();
            return;
        }
        if (code === KEY.left || code === KEY.up || code === KEY.right || code === KEY.down) {
            event.preventDefault();
            moveFocus(code);
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
                if (keep) {
                    keep.click();
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
            document.addEventListener('keyup', onKeyUp, true);
        }
        render();
    }

    function close() {
        if (!overlay) {
            return;
        }
        document.removeEventListener('keydown', onKey, true);
        document.removeEventListener('keyup', onKeyUp, true);
        overlay.parentNode.removeChild(overlay);
        overlay = null;
        if (opener && document.body.contains(opener) && typeof opener.focus === 'function') {
            opener.focus();
        }
        opener = null;
    }

    // Where the switcher opens from (decision 0005): an item in the desktop and
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

    function onRedButton(event) {
        if (event.keyCode !== KEY.red) {
            return;
        }
        event.preventDefault();
        if (!overlay && signedIn()) {
            open();
        }
    }

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
        document.addEventListener('keydown', onAddingKey, true);
        window.addEventListener('popstate', onAddingRoute);
        window.addEventListener('hashchange', onAddingRoute);
        addEntries();
    }

    window.QuickSwitch = {
        version: VERSION,
        open: open,
        close: close,
        store: { list: list, save: save, forget: forget, markStale: markStale, startAdding: startAdding, addingFrom: addingFrom, stopAdding: stopAdding },
        avatar: avatar
    };

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
