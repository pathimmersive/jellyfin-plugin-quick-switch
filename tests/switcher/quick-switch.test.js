// Runs the switcher script the way jellyfin-web loads it: as a classic script
// in a page's global scope.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const vm = require('node:vm')

const filename = join(__dirname, '..', '..', 'src', 'switcher', 'quick-switch.js')
const source = readFileSync(filename, 'utf8')

// Named, so coverage is reported against the script rather than this file.
function load(window = {}) {
    window.window = window
    vm.runInNewContext(source, window, { filename })
    return window
}

test('defines window.QuickSwitch with its version', () => {
    const window = load()

    assert.match(window.QuickSwitch.version, /^\d+\.\d+\.\d+$/)
})

test('loading twice keeps the first instance', () => {
    const window = load()
    const first = window.QuickSwitch

    vm.runInNewContext(source, window, { filename })

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
            move: quickSwitch.store.move,
            markStale: quickSwitch.store.markStale,
            startAdding: quickSwitch.store.startAdding,
            addingFrom: quickSwitch.store.addingFrom,
            stopAdding: quickSwitch.store.stopAdding,
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

test('moves an account to another place in its server’s order only', () => {
    const { store } = withStore()
    for (const id of ['a', 'b', 'c', 'd']) { store.save('s', { UserId: id, Name: id, AccessToken: 't' + id }) }
    store.save('other', { UserId: 'a', Name: 'a', AccessToken: 'x' })
    store.save('other', { UserId: 'b', Name: 'b', AccessToken: 'y' })

    store.move('s', 'b', 3)
    assert.deepEqual(store.list('s').map((a) => a.UserId), ['a', 'c', 'd', 'b'])
    store.move('s', 'd', 0)
    assert.deepEqual(store.list('s').map((a) => a.UserId), ['d', 'a', 'c', 'b'])
    store.move('s', 'c', 99)
    store.move('s', 'nobody', 0)
    assert.deepEqual(store.list('s').map((a) => a.UserId), ['d', 'a', 'b', 'c'])
    assert.deepEqual(store.list('other').map((a) => a.UserId), ['a', 'b'])

    // A new sign-in keeps the account's place, and a new account goes to the end.
    store.save('s', { UserId: 'a', Name: 'a', AccessToken: 'new' })
    store.save('s', { UserId: 'e', Name: 'e', AccessToken: 'te' })
    assert.deepEqual(store.list('s').map((a) => [a.UserId, a.AccessToken]), [['d', 'td'], ['a', 'new'], ['b', 'tb'], ['c', 'tc'], ['e', 'te']])
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

test('remembers an add in progress per server until it finishes or is cancelled', () => {
    const { store } = withStore()

    store.startAdding('s1', 'a')
    store.startAdding('s2', 'b')

    assert.equal(store.addingFrom('s1'), 'a')
    assert.equal(store.addingFrom('s2'), 'b')
    assert.equal(store.addingFrom('s3'), null)

    store.stopAdding('s1')

    assert.equal(store.addingFrom('s1'), null)
    assert.equal(store.addingFrom('s2'), 'b')
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

// jellyfin-web's ApiClient, signed in as whoever `signedIn` holds.
function apiClient(signedIn, { getUrl = true, address = () => 'http://server/jf/' } = {}) {
    const c = {
        getCurrentUserId: () => signedIn.userId,
        accessToken: () => signedIn.token,
        serverId: () => signedIn.serverId,
        serverAddress: address,
        appName: () => 'Jellyfin Web',
        deviceName: () => 'TV',
        deviceId: () => 'device-1',
        appVersion: () => '10.11.0',
    }
    if (getUrl) {
        c.getUrl = (path) => address() + path
    }
    return c
}

// An XMLHttpRequest that holds each request until the test answers it.
function fakeRequests() {
    const sent = []
    function FakeXhr() {
        this.headers = {}
    }
    FakeXhr.prototype.open = function (method, url) { this.method = method; this.url = url }
    FakeXhr.prototype.setRequestHeader = function (name, value) { this.headers[name] = value }
    FakeXhr.prototype.send = function () { sent.push(this) }
    FakeXhr.prototype.answer = function (status, body) {
        this.status = status
        this.responseText = typeof body === 'string' ? body : JSON.stringify(body)
        this.onload()
    }
    return { FakeXhr, sent }
}

// Loads the script signed in as `signedIn` and hands back its one-second watch.
function watching(signedIn, options, storage = memoryStorage()) {
    const { FakeXhr, sent } = fakeRequests()
    let tick = null
    const window = load({
        localStorage: storage,
        ApiClient: apiClient(signedIn, options),
        XMLHttpRequest: FakeXhr,
        setInterval: (fn) => { tick = fn },
    })
    return { tick: () => tick(), sent, store: wrap(window.QuickSwitch).store }
}

test('saves whoever signs in once the server confirms who they are', () => {
    const signedIn = { serverId: 's', userId: 'a', token: 't1' }
    const { tick, sent, store } = watching(signedIn)

    tick()

    assert.equal(sent.length, 1)
    assert.equal(sent[0].method, 'GET')
    assert.equal(sent[0].url, 'http://server/jf/Users/Me')
    assert.equal(sent[0].headers.Authorization,
        'MediaBrowser Client="Jellyfin Web", Device="TV", DeviceId="device-1", Version="10.11.0", Token="t1"')
    sent[0].answer(200, { Id: 'a', Name: 'Al', PrimaryImageTag: 'img' })
    assert.deepEqual(store.list('s'), [{ UserId: 'a', Name: 'Al', AccessToken: 't1', PrimaryImageTag: 'img', Addresses: ['http://server/jf'] }])
})

test('asks the server only when the signed-in account or its token changes', () => {
    const signedIn = { serverId: 's', userId: 'a', token: 't1' }
    const { tick, sent, store } = watching(signedIn)
    tick()
    sent[0].answer(200, { Id: 'a', Name: 'Al' })

    tick()
    tick()
    assert.equal(sent.length, 1)

    signedIn.token = 't2'
    tick()
    assert.equal(sent.length, 2)
    sent[1].answer(200, { Id: 'a', Name: 'Al' })
    assert.equal(store.list('s')[0].AccessToken, 't2')
})

test('an account already saved with its name and the same token is not asked about', () => {
    const { tick, sent, store } = watching({ serverId: 's', userId: 'a', token: 't1' })
    store.save('s', { UserId: 'a', Name: 'Al', AccessToken: 't1' })

    tick()

    assert.equal(sent.length, 0)
})

for (const [why, answer] of [
    ['the server refuses the token', (xhr) => xhr.answer(401, '')],
    ['the request fails', (xhr) => xhr.onerror()],
    ['the request times out', (xhr) => xhr.ontimeout()],
    ['the server answers for another account', (xhr) => xhr.answer(200, { Id: 'b', Name: 'Bo' })],
    ['the answer cannot be read', (xhr) => xhr.answer(200, '{not json')],
]) {
    test(`saves nothing when ${why}, and asks again on the next tick`, () => {
        const { tick, sent, store } = watching({ serverId: 's', userId: 'a', token: 't1' })
        tick()

        answer(sent[0])
        assert.deepEqual(store.list('s'), [])

        tick()
        assert.equal(sent.length, 2)
    })
}

test('asks nothing while nobody is signed in', () => {
    const signedIn = { serverId: 's', userId: 'a', token: null }
    const { tick, sent } = watching(signedIn)

    tick()

    assert.equal(sent.length, 0)
})

test('waits for jellyfin-web’s ApiClient before watching', () => {
    let tick = null
    load({ localStorage: memoryStorage(), setInterval: (fn) => { tick = fn } })

    assert.doesNotThrow(() => tick())
})

test('builds the request address from the server address when the ApiClient cannot', () => {
    const { tick, sent } = watching({ serverId: 's', userId: 'a', token: 't1' }, { getUrl: false })

    tick()

    assert.equal(sent[0].url, 'http://server/jf/Users/Me')
})

test('an administrator who is not saved yet is not saved without asking', () => {
    const { tick, sent, store } = watching({ serverId: 's', userId: 'a', token: 't1' })
    tick()

    sent[0].answer(200, { Id: 'a', Name: 'Al', Policy: { IsAdministrator: true } })

    assert.deepEqual(store.list('s'), [])
})

test('an account that is not an administrator is saved without asking', () => {
    const { tick, sent, store } = watching({ serverId: 's', userId: 'b', token: 't1' })
    tick()

    sent[0].answer(200, { Id: 'b', Name: 'Bo', Policy: { IsAdministrator: false } })

    assert.equal(store.list('s').length, 1)
})

test('an administrator already saved keeps its place when it signs in again', () => {
    const signedIn = { serverId: 's', userId: 'a', token: 't1' }
    const { tick, sent, store } = watching(signedIn)
    store.save('s', { UserId: 'a', Name: 'Al', AccessToken: 't0' })

    tick()
    sent[0].answer(200, { Id: 'a', Name: 'Al', Policy: { IsAdministrator: true } })

    assert.equal(store.list('s')[0].AccessToken, 't1')
})

test('an administrator whose sign-in was not saved is not asked about again until it signs in again', () => {
    const storage = memoryStorage()
    storage.setItem('quickswitch', JSON.stringify({ servers: {}, declined: {} }))
    const signedIn = { serverId: 's', userId: 'a', token: 't1' }
    const first = watching(signedIn, undefined, storage)
    // Don't save, as the question records it: a hash of the token, never the token.
    let hash = 0
    for (const c of 't1') { hash = (hash * 31 + c.charCodeAt(0)) % 2147483647 }
    storage.setItem('quickswitch', JSON.stringify({ servers: {}, declined: { 's|a': String(hash) } }))
    assert.equal(storage.getItem('quickswitch').indexOf('"t1"'), -1)

    first.tick()
    assert.equal(first.sent.length, 0)

    signedIn.token = 't2'
    first.tick()
    assert.equal(first.sent.length, 1)
})

test('remembers every server address an account signs in through, whatever the case or trailing slash', () => {
    let at = 'http://192.168.1.5:8096/'
    const signedIn = { serverId: 's', userId: 'b', token: 't1' }
    const { tick, sent, store } = watching(signedIn, { address: () => at })
    tick()
    sent[0].answer(200, { Id: 'b', Name: 'Bo' })

    at = 'HTTPS://Watch.Example.org//'
    signedIn.token = 't2'
    tick()
    sent[1].answer(200, { Id: 'b', Name: 'Bo' })
    at = 'https://watch.example.org'
    signedIn.token = 't3'
    tick()
    sent[2].answer(200, { Id: 'b', Name: 'Bo' })

    assert.deepEqual(store.list('s')[0].Addresses, ['http://192.168.1.5:8096', 'https://watch.example.org'])
})

test('a saved account signing in at a new address with the same token records that address too', () => {
    let at = 'http://one/'
    const signedIn = { serverId: 's', userId: 'b', token: 't1' }
    const { tick, sent, store } = watching(signedIn, { address: () => at })
    tick()
    sent[0].answer(200, { Id: 'b', Name: 'Bo' })

    at = 'http://two/'
    tick()
    sent[1].answer(200, { Id: 'b', Name: 'Bo' })

    assert.deepEqual(store.list('s')[0].Addresses, ['http://one', 'http://two'])
})

test('accounts saved before addresses were kept take the address they are next seen at', () => {
    const storage = memoryStorage()
    storage.setItem('quickswitch', JSON.stringify({ servers: { s: [
        { UserId: 'a', Name: 'Al', AccessToken: 'old-a' },
        { UserId: 'b', Name: 'Bo', AccessToken: 'old-b' },
    ] } }))
    const { tick, store } = watching({ serverId: 's', userId: 'a', token: 'old-a' }, undefined, storage)

    tick()

    assert.deepEqual(store.list('s').map((a) => a.Addresses), [['http://server/jf'], ['http://server/jf']])
    assert.deepEqual(store.list('s').map((a) => a.AccessToken), ['old-a', 'old-b'])
})

// Two accounts saved at this address, Al signed in with the token that is saved.
function signedInAsAl(storage = memoryStorage()) {
    const signedIn = { serverId: 's', userId: 'a', token: 'ta' }
    const run = watching(signedIn, undefined, storage)
    run.store.save('s', { UserId: 'a', Name: 'Al', AccessToken: 'ta', Address: 'http://server/jf/' })
    run.store.save('s', { UserId: 'b', Name: 'Bo', AccessToken: 'tb', Address: 'http://server/jf/' })
    run.tick()
    return { signedIn, storage, ...run }
}

test('an account that signs out with jellyfin-web is forgotten once the server rejects its token', () => {
    const { signedIn, tick, sent, store } = signedInAsAl()
    const before = sent.length

    signedIn.token = null
    tick()

    assert.equal(sent.length, before + 1)
    assert.equal(sent[before].url, 'http://server/jf/Users/Me')
    assert.match(sent[before].headers.Authorization, /Token="ta"/)
    sent[before].answer(401, '')
    assert.deepEqual(store.list('s').map((a) => a.UserId), ['b'])
})

test('an account whose token still works after the sign-in is cleared stays saved', () => {
    const { signedIn, tick, sent, store } = signedInAsAl()
    const before = sent.length

    signedIn.token = null
    tick()
    sent[before].answer(200, { Id: 'a', Name: 'Al' })

    assert.deepEqual(store.list('s').map((a) => a.UserId), ['a', 'b'])
})

test('a sign-out the server could not be asked about is checked again on the next load', () => {
    const first = signedInAsAl()
    const before = first.sent.length
    first.signedIn.token = null
    first.tick()
    first.sent[before].onerror()
    assert.deepEqual(first.store.list('s').map((a) => a.UserId), ['a', 'b'])

    const next = watching({ serverId: 's', userId: 'b', token: 'tb' }, undefined, first.storage)
    next.tick()

    const check = next.sent.filter((x) => /Token="ta"/.test(x.headers.Authorization))[0]
    assert.ok(check)
    check.answer(401, '')
    assert.deepEqual(next.store.list('s').map((a) => a.UserId), ['b'])
})

test('nobody is forgotten when the account that leaves is not saved with the token it signed in with', () => {
    const signedIn = { serverId: 's', userId: 'a', token: 'new' }
    const { tick, sent, store } = watching(signedIn)
    store.save('s', { UserId: 'a', Name: 'Al', AccessToken: 'old', Address: 'http://server/jf/' })
    tick()
    const before = sent.length

    signedIn.token = null
    tick()

    assert.equal(sent.length, before)
    assert.equal(store.list('s').length, 1)
})
