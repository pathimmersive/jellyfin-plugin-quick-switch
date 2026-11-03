// ESLint for the switcher, which runs as a classic ES5 script in jellyfin-web
// because TV apps use older browser engines, and for its Node tests.
import js from '@eslint/js';

const browser = Object.fromEntries([
    'window', 'document', 'navigator', 'location', 'localStorage', 'console',
    'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame',
    'XMLHttpRequest', 'Event', 'CustomEvent', 'MutationObserver', 'getComputedStyle',
].map((name) => [name, 'readonly']));

export default [
    js.configs.recommended,
    {
        files: ['src/switcher/**/*.js'],
        languageOptions: { ecmaVersion: 5, sourceType: 'script', globals: browser },
        rules: {
            // ES5 has no optional catch binding, so a catch must name an error it may not use.
            'no-unused-vars': ['error', { caughtErrors: 'none' }],
            // State read before its declaration was a real bug once; functions are hoisted and fine.
            'no-use-before-define': ['error', { functions: false }],
        },
    },
    {
        files: ['tests/switcher/**/*.js'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'commonjs',
            globals: { require: 'readonly', module: 'writable', __dirname: 'readonly', console: 'readonly', process: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly' },
        },
    },
];
