// Loaded by jellyfin-web as a classic script before its own bundles run.
// Written as ES5 with no build step, because the TV apps that load
// jellyfin-web run older browser engines.
(function () {
    'use strict';

    var VERSION = '0.1.0';

    if (window.QuickSwitch) {
        return;
    }

    window.QuickSwitch = {
        version: VERSION
    };
})();
