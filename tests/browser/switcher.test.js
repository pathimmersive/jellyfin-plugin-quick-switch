// The switcher inside jellyfin-web, in Chromium, against a throwaway Jellyfin
// running the plugin built from this tree. Needs Docker, the .NET 10 SDK and a
// Chromium-based browser; see CONTRIBUTING.md.
const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const { startServer } = require('./server')
const { launch, waitFor, newPage, signIn, withTwoAccounts, close, overlay, pageState, mark, open, closeSwitcher } = require('./page')

let server
let browser

before(async () => {
    server = await startServer()
    browser = await launch()
})

after(async () => {
    if (browser) { await browser.close() }
    if (server) { server.stop() }
})

// Runs a test body with sam and alex saved, alex signed in, and always cleans up.
async function withAccounts(layout, body) {
    const run = await withTwoAccounts(browser, server, layout)
    try { await body(run.page) } finally { await close(server, run) }
}

for (const layout of ['desktop', 'tv']) {
    test(`tiles: Who's watching? lists the saved accounts (${layout})`, async () => {
        const { alex, sam } = server.accounts
        await withAccounts(layout, async (page) => {
            const marker = await mark(page)
            const o = await open(page)
            assert.ok(o.shown, 'window.QuickSwitch.open() shows the switcher')
            assert.deepEqual([o.heading, o.sub], ['Who’s watching?', 'Select or add an account'])
            assert.deepEqual(o.tiles.map((t) => t.id), [sam.id, alex.id], 'one tile per account, in the order they were saved')
            const a = o.tiles[1]
            const s = o.tiles[0]
            assert.equal(a.tag, 'Watching now', 'the account signed in now is marked Watching now')
            assert.equal(s.tag, '', 'the other account is not marked')
            assert.deepEqual([a.name, s.name, a.initial, s.initial, a.image, s.image], ['alex', 'sam', 'A', 'S', false, false],
                'tiles show the name, and the initial when there is no profile picture')
            assert.deepEqual([o.add, o.manage], ['Add Account', 'Manage Accounts'])
            if (layout === 'tv') {
                assert.ok(o.hints && !o.close, 'the TV layout shows the remote key hints and no close button')
            } else {
                assert.ok(o.close && !o.hints, 'the desktop layout shows a close button and no key hints')
            }

            const closed = await closeSwitcher(page)
            const after = await pageState(page, server.library)
            assert.ok(closed.ok && after.homeVisible && after.userId === alex.id, 'Escape closes the switcher and leaves the home screen as it was')
            const again = await open(page)
            assert.equal(again.tiles.map((t) => t.color).join(' '), o.tiles.map((t) => t.color).join(' '), 'each account keeps its colour')

            await page.locator('#quickswitch [data-qs-action="manage"]').click()
            const m = await overlay(page)
            assert.deepEqual([m.heading, m.sub], ['Manage Accounts', 'Move or remove accounts'])
            await page.keyboard.press('Escape')
            await closeSwitcher(page)

            const kept = await page.evaluate((id) => {
                const raw = window.localStorage.getItem('quickswitch')
                const store = JSON.parse(raw)
                const key = window.ApiClient.serverId()
                store.servers[key] = store.servers[key].filter((x) => x.UserId !== id)
                window.localStorage.setItem('quickswitch', JSON.stringify(store))
                return raw
            }, sam.id)
            const one = await open(page)
            assert.deepEqual([one.tiles.length, one.heading, one.sub], [1, 'Who’s watching?', 'Select or add an account'], 'with one account it reads the same')
            await closeSwitcher(page)
            await page.evaluate((raw) => window.localStorage.setItem('quickswitch', raw), kept)
            assert.equal((await pageState(page, server.library)).marker, marker, 'no page reload')
        })
    })
}

async function switchTo(page, account, marker) {
    await open(page)
    await page.locator(`#quickswitch [data-qs-user="${account.id}"]`).click()
    const splash = await waitFor(() => overlay(page), (o) => o.splash && o.splash.indexOf(`Hi, ${account.name}`) !== -1, 3000)
    assert.ok(splash.ok, `shows Hi, ${account.name} while switching (saw ${JSON.stringify(splash.value.splash)})`)
    const expected = (s) => s.homeVisible && s.userId === account.id && s.showsLibrary === account.library && s.nothingHere === !account.library
        && s.toast === `Now watching as ${account.name}`
    const done = await waitFor(() => pageState(page, server.library), expected, 10000)
    assert.ok(done.ok, `home shows ${account.name}'s libraries, ApiClient reports ${account.name} and a toast says so: ${JSON.stringify(done.value)}`)
    assert.equal(done.value.marker, marker, 'no page reload')
    assert.ok(!(await overlay(page)).shown, 'the switcher closed')
}

test('switch: selecting a tile switches in place, without a password or a reload', async () => {
    const { alex, sam } = server.accounts
    await withAccounts('desktop', async (page) => {
        const marker = await mark(page)
        await switchTo(page, sam, marker)
        await switchTo(page, alex, marker)

        await open(page)
        await page.locator(`#quickswitch [data-qs-user="${alex.id}"]`).click()
        const same = await waitFor(() => pageState(page, server.library), (s) => s.toast === 'Already watching as alex', 3000)
        assert.ok(same.ok && same.value.userId === alex.id, 'selecting the account signed in now does not switch and says so')
        await closeSwitcher(page)

        await page.route('**/Users/Me*', (route) => route.abort('connectionrefused'))
        await open(page)
        await page.locator(`#quickswitch [data-qs-user="${sam.id}"]`).click()
        const down = await waitFor(() => pageState(page, server.library),
            (s) => s.toast === 'Can’t reach the server right now. You’re still watching as alex.', 8000)
        assert.ok(down.ok && down.value.userId === alex.id && down.value.marker === marker, 'with the server unreachable, nothing switches and the switcher says so')
        await page.unroute('**/Users/Me*')
    })
})

// Nothing of the switcher in the header or on the home screen.
const untouched = (page) => page.evaluate(() => {
    const header = document.querySelector('header.MuiAppBar-root, .skinHeader')
    const home = document.getElementById('indexPage')
    const own = (root) => (root ? root.querySelectorAll('[data-qs-entry], [id^="quickswitch"], [class*="qs-"]').length : 0)
    return { headerButtons: header ? header.querySelectorAll('button, a').length : -1, ownInHeader: own(header), ownOnHome: own(home) }
})

// The header's buttons with no switcher script at all, to compare against.
async function headerWithoutSwitcher(layout) {
    const run = await newPage(browser, server, layout)
    await run.context.route('**/QuickSwitch/quick-switch.js*', (route) => route.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body: '' }))
    await run.page.reload()
    await signIn(run.page, server.accounts.alex)
    await run.page.waitForTimeout(1500)
    const count = (await untouched(run.page)).headerButtons
    await close(server, run)
    return count
}

const menuState = (page) => page.evaluate(() => {
    const root = document.getElementById('app-user-menu')
    const menu = root && root.className.indexOf('MuiModal-hidden') === -1 ? root.querySelector('[role="menu"]') : null
    if (!menu) { return null }
    const items = Array.prototype.slice.call(menu.querySelectorAll('[role="menuitem"]'))
    const entry = menu.querySelector('[data-qs-entry="menu"]')
    const signOut = items.find((i) => i.querySelector('[data-testid="LogoutIcon"]'))
    const label = entry && entry.querySelector('.MuiListItemText-primary')
    return {
        names: items.map((i) => (i.querySelector('.MuiListItemText-primary') || i).textContent.trim()),
        entries: menu.querySelectorAll('[data-qs-entry]').length,
        sameClass: !!entry && !!signOut && entry.className === signOut.className,
        oneLine: !!entry && !!signOut && !!label && Math.abs(entry.getBoundingClientRect().height - signOut.getBoundingClientRect().height) < 2 && label.getClientRects().length === 1,
        stack: entry ? entry.getAttribute('data-qs-stack') || '' : '',
        dots: entry ? entry.querySelectorAll('.qs-dot').length : 0,
        focused: !!entry && document.activeElement === entry,
    }
})

async function openUserMenu(page) {
    await page.locator('button[aria-label="User Menu"]').click()
    return (await waitFor(() => menuState(page), (m) => m && m.names.indexOf('Sign Out') !== -1, 3000)).value
}

const focusInSwitcher = (page) => page.evaluate(() => { const root = document.getElementById('quickswitch'); return !!root && root.contains(document.activeElement) })

const pressRed = (page) => page.evaluate(() => {
    const target = document.activeElement || document.body
    target.dispatchEvent(new KeyboardEvent('keydown', { keyCode: 403, which: 403, bubbles: true, cancelable: true }))
})

async function goHome(page) {
    await page.evaluate(() => { location.hash = '#/home' })
    await page.waitForFunction(() => document.querySelector('#indexPage:not(.hide)'), null, { timeout: 10000 })
}

test('entry: Switch Account in the User Menu opens the switcher, and nothing is added to the header (desktop)', async () => {
    const { alex, sam } = server.accounts
    const baseline = await headerWithoutSwitcher('desktop')
    await withAccounts('desktop', async (page) => {
        const marker = await mark(page)
        const before = await untouched(page)
        assert.deepEqual([before.ownInHeader, before.ownOnHome], [0, 0], 'nothing of the switcher in the header or on the home screen')
        assert.equal(before.headerButtons, baseline, 'the header has as many buttons as without the switcher')

        const m = await openUserMenu(page)
        assert.ok(m, 'the User Menu opens')
        const at = m.names.indexOf('Switch Account')
        assert.ok(at !== -1 && m.names[at - 1] === 'Quick Connect' && m.names[at + 1] === 'Sign Out', `Switch Account sits between Quick Connect and Sign Out: ${JSON.stringify(m.names)}`)
        assert.ok(m.sameClass && m.oneLine, 'Switch Account is styled like Sign Out and fits on one line')
        assert.ok(m.dots === 1 && m.stack.indexOf(sam.id) !== -1 && m.stack.indexOf(alex.id) === -1, 'Switch Account shows a circle for sam and none for alex, who is signed in')

        await page.locator('#app-user-menu [data-qs-entry="menu"]').click()
        const opened = await waitFor(() => overlay(page), (o) => o.shown, 3000)
        await page.waitForTimeout(700)
        assert.ok(opened.ok && !(await menuState(page)) && opened.value.tiles.length === 2, 'clicking Switch Account closes the menu and opens Who’s watching?')
        assert.ok(await focusInSwitcher(page), 'focus stays in the switcher after the menu has closed')
        await closeSwitcher(page)

        await page.evaluate(() => { location.hash = '#/mypreferencesmenu' })
        await page.waitForFunction(() => document.querySelector('#myPreferencesMenuPage:not(.hide) .userSection'), null, { timeout: 10000 })
        assert.equal(await page.evaluate(() => document.querySelectorAll('#myPreferencesMenuPage [data-qs-entry]').length), 0,
            'the settings page gets no Switch Account row outside the TV layout')
        await goHome(page)

        const again = await openUserMenu(page)
        assert.equal(again && again.entries, 1, 'after reopening the menu and visiting another page, there is still exactly one Switch Account')
        await page.keyboard.press('ArrowUp')
        await page.keyboard.press('ArrowUp')
        assert.ok((await menuState(page)).focused, 'the arrow keys reach Switch Account')
        await page.keyboard.press('Enter')
        assert.ok((await waitFor(() => overlay(page), (o) => o.shown, 3000)).ok, 'Enter on Switch Account opens the switcher')
        await closeSwitcher(page)
        assert.equal((await pageState(page, server.library)).marker, marker, 'no page reload')
    })
})

test('entry: the Switch Account row in the TV settings and the red button open the switcher (tv)', async () => {
    const baseline = await headerWithoutSwitcher('tv')
    await withAccounts('tv', async (page) => {
        const marker = await mark(page)
        const before = await untouched(page)
        assert.deepEqual([before.ownInHeader, before.ownOnHome], [0, 0], 'nothing of the switcher in the header or on the home screen')
        assert.equal(before.headerButtons, baseline, 'the header has as many buttons as without the switcher')

        const section = () => page.evaluate(() => {
            const root = document.querySelector('#myPreferencesMenuPage:not(.hide) .userSection')
            if (!root) { return null }
            const rows = Array.prototype.filter.call(root.children, (c) => c.tagName === 'A')
            const glyph = root.querySelector('[data-qs-entry] .material-icons')
            return {
                names: rows.map((r) => (r.querySelector('.listItemBodyText') || r).textContent.trim()),
                entries: root.querySelectorAll('[data-qs-entry]').length,
                first: rows[0] ? rows[0].getAttribute('data-qs-entry') : null,
                dots: root.querySelectorAll('[data-qs-entry] .qs-dot').length,
                glyph: glyph ? getComputedStyle(glyph, '::before').content.length > 2 : false,
            }
        })
        const visit = async () => {
            await page.evaluate(() => { location.hash = '#/mypreferencesmenu' })
            await waitFor(section, (x) => x && x.entries > 0, 5000)
            await page.waitForTimeout(300)
            return section()
        }
        const first = await visit()
        assert.ok(first, 'the settings page shows its User section')
        assert.ok(first.first === 'settings' && first.names[0] === 'Switch Account' && first.names[1] === 'Sign Out', `the User section starts with Switch Account, above Sign Out: ${JSON.stringify(first.names)}`)
        assert.ok(first.glyph && first.dots === 1, 'the row has the page’s own icon and a circle for sam')
        await page.locator('#myPreferencesMenuPage [data-qs-entry="settings"]').click()
        const opened = await waitFor(() => overlay(page), (o) => o.shown, 3000)
        assert.ok(opened.ok && opened.value.tiles.length === 2, 'selecting Switch Account opens Who’s watching?')
        await closeSwitcher(page)
        await goHome(page)
        const second = await visit()
        assert.equal(second && second.entries, 1, 'after visiting home, the settings page still has exactly one Switch Account row')
        await goHome(page)

        await pressRed(page)
        const red = await waitFor(() => overlay(page), (o) => o.shown, 3000)
        assert.ok(red.ok && red.value.tiles.length === 2, 'the red button (keyCode 403) opens the switcher on the home screen')
        await pressRed(page)
        await page.waitForTimeout(300)
        assert.ok((await page.evaluate(() => document.querySelectorAll('#quickswitch').length)) === 1 && (await overlay(page)).shown,
            'the red button while the switcher is open does nothing more')
        await closeSwitcher(page)
        assert.equal((await pageState(page, server.library)).marker, marker, 'no page reload')
    })
})
