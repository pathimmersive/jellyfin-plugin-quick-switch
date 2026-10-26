// Runs the switcher script the way jellyfin-web loads it: as a classic script
// in a page's global scope.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const vm = require('node:vm')

const source = readFileSync(join(__dirname, '..', '..', 'src', 'switcher', 'quick-switch.js'), 'utf8')

function load(window = {}) {
    window.window = window
    vm.runInNewContext(source, window)
    return window
}

test('defines window.QuickSwitch with its version', () => {
    const window = load()

    assert.match(window.QuickSwitch.version, /^\d+\.\d+\.\d+$/)
})

test('loading twice keeps the first instance', () => {
    const window = load()
    const first = window.QuickSwitch

    vm.runInNewContext(source, window)

    assert.equal(window.QuickSwitch, first)
})
