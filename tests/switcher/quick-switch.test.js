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

function memoryStorage() {
    const items = {}
    return {
        getItem: (key) => (key in items ? items[key] : null),
        setItem: (key, value) => { items[key] = String(value) },
        removeItem: (key) => { delete items[key] },
    }
}

// Values made inside the script's context have that context's prototypes; compare them as plain data.
const plain = (value) => JSON.parse(JSON.stringify(value))

function wrap(quickSwitch) {
    return {
        store: {
            list: (serverId) => plain(quickSwitch.store.list(serverId)),
            save: quickSwitch.store.save,
            forget: quickSwitch.store.forget,
            markStale: quickSwitch.store.markStale,
        },
        avatar: (...args) => plain(quickSwitch.avatar(...args)),
    }
}

function withStore() {
    return wrap(load({ localStorage: memoryStorage() }).QuickSwitch)
}

test('saves accounts per server, in the order they were saved', () => {
    const { store } = withStore()

    store.save('server-1', { UserId: 'b', Name: 'Bea', AccessToken: 'tb' })
    store.save('server-1', { UserId: 'a', Name: 'Al', AccessToken: 'ta', PrimaryImageTag: 'img' })
    store.save('server-2', { UserId: 'c', Name: 'Cy', AccessToken: 'tc' })

    assert.deepEqual(store.list('server-1').map((a) => a.UserId), ['b', 'a'])
    assert.equal(store.list('server-1')[1].PrimaryImageTag, 'img')
    assert.deepEqual(store.list('server-2').map((a) => a.UserId), ['c'])
    assert.deepEqual(store.list('server-3'), [])
})

test('a new sign-in by a saved account replaces its token in place', () => {
    const { store } = withStore()
    store.save('s', { UserId: 'a', Name: 'Al', AccessToken: 'old' })
    store.save('s', { UserId: 'b', Name: 'Bea', AccessToken: 'tb' })

    store.save('s', { UserId: 'a', Name: 'Al', AccessToken: 'new' })

    assert.deepEqual(store.list('s').map((a) => [a.UserId, a.AccessToken]), [['a', 'new'], ['b', 'tb']])
})

test('ignores an account without a user id or token, and forgets one by id', () => {
    const { store } = withStore()
    store.save('s', { UserId: 'a', Name: 'Al' })
    store.save('s', { Name: 'Nobody', AccessToken: 't' })
    store.save('s', { UserId: 'b', Name: 'Bea', AccessToken: 'tb' })

    store.forget('s', 'b')

    assert.deepEqual(store.list('s'), [])
})

test('remembers a saved sign-in that stopped working until that account signs in again', () => {
    const { store } = withStore()
    store.save('s', { UserId: 'a', Name: 'Al', AccessToken: 'ta' })
    store.save('s', { UserId: 'b', Name: 'Bea', AccessToken: 'old' })

    store.markStale('s', 'b')
    store.markStale('s', 'nobody')

    assert.deepEqual(store.list('s').map((a) => [a.UserId, !!a.Stale]), [['a', false], ['b', true]])
    assert.equal(store.list('s')[1].AccessToken, 'old')

    store.save('s', { UserId: 'b', Name: 'Bea', AccessToken: 'new' })

    assert.deepEqual(store.list('s').map((a) => [a.UserId, a.AccessToken, !!a.Stale]), [['a', 'ta', false], ['b', 'new', false]])
})

test('survives unreadable saved data', () => {
    const window = { localStorage: memoryStorage() }
    window.localStorage.setItem('quickswitch', '{not json')
    const { store } = wrap(load(window).QuickSwitch)

    assert.deepEqual(store.list('s'), [])
    store.save('s', { UserId: 'a', Name: 'Al', AccessToken: 't' })
    assert.equal(store.list('s').length, 1)
})

test('an account without a profile picture gets its initial and a colour that never changes', () => {
    const { avatar } = withStore()

    const first = avatar({ UserId: '4a6e6ed4', Name: 'maya' }, 'http://server')
    const again = avatar({ UserId: '4a6e6ed4', Name: 'Maya' }, 'http://server')

    assert.equal(first.initial, 'M')
    assert.equal(first.imageUrl, null)
    assert.match(first.color, /^#[0-9a-f]{6}$/)
    assert.equal(again.color, first.color)
})

test('an account with a profile picture gets its image URL under the server address', () => {
    const { avatar } = withStore()

    const picture = avatar({ UserId: 'u 1', Name: 'Al', PrimaryImageTag: 'abc' }, 'http://server/jf/', 360)

    assert.equal(picture.imageUrl, 'http://server/jf/Users/u%201/Images/Primary?tag=abc&quality=90&maxHeight=360')
})
