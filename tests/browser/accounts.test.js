// Adding, removing, reordering and the remote in the switcher, and a saved
// sign-in that stopped working, in Chromium against a throwaway Jellyfin
// running the plugin built from this tree. Needs Docker, the .NET 10 SDK and a
// Chromium-based browser; see CONTRIBUTING.md.
const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const { startServer, request: serverRequest } = require('./server')
const { launch, waitFor, newPage, signIn, savedIds, waitSaved, withTwoAccounts, close, overlay, pageState, open } = require('./page')

let server
let browser
// alex administers the server and sees its library; sam has no password and no library.
let A
let B

before(async () => {
    server = await startServer()
    browser = await launch()
    A = server.accounts.alex
    B = server.accounts.sam
})

after(async () => {
    if (browser) { await browser.close() }
    if (server) { server.stop() }
})

// Each test runs every check, as a person would read down the list, then fails
// listing the checks that did not hold.
let failures = []
const fail = (message) => { failures.push(message) }
const check = (ok, message, detail) => { if (!ok) { fail(detail ? `${message}: ${detail}` : message) } }
const shot = (page, name) => (process.env.QS_SHOTS ? page.screenshot({ path: `${process.env.QS_SHOTS}/${name}.png` }) : null)

async function checked(run) {
    failures = []
    await run()
    assert.deepEqual(failures, [], `${failures.length} check(s) failed`)
}

// A request to the test server, as the test client.
const request = (path, options) => serverRequest(server, path, options)

async function accountsSaved(layout) {
    try {
        return await withTwoAccounts(browser, server, layout)
    } catch (e) {
        return { error: e.message }
    }
}

async function finish(run) {
    if (run && run.context) { await close(server, run) }
}

const savedTokens = (page) => page.evaluate(() => {
    try {
        const store = JSON.parse(window.localStorage.getItem('quickswitch') || '{}')
        const out = {}
        for (const a of (store.servers || {})[window.ApiClient.serverId()] || []) { out[a.UserId] = a.AccessToken }
        return out
    } catch { return {} }
})

const meStatus = async (token) => (await request('/Users/Me', { token })).status

const loginState = (page) => page.evaluate(() => {
    const pages = Array.prototype.filter.call(document.querySelectorAll('#loginPage'), (p) => p.className.indexOf('hide') === -1)
    const login = pages[0] || null
    const visible = (e) => !!e && e.getBoundingClientRect().width > 0
    const notices = Array.prototype.filter.call(document.querySelectorAll('[data-qs-notice]'), visible).map((n) => (n.querySelector('.qs-notice > span:last-child') || n).textContent.trim())
    const code = document.querySelector('#quickConnectAlert .text')
    return {
        login: !!login,
        manual: !!login && visible(login.querySelector('#txtManualName')),
        notices,
        code: code ? code.textContent.trim() : null,
        userId: window.ApiClient && window.ApiClient.getCurrentUserId(),
        token: window.ApiClient && window.ApiClient.accessToken(),
        marker: window.__qsMarker || null,
    }
})

const dialogState = (page) => page.evaluate(() => {
    const root = document.querySelector('#quickswitch [aria-label="Add Account"]')
    if (!root) { return null }
    const titles = Array.prototype.map.call(root.querySelectorAll('.qs-card-title'), (t) => t.textContent)
    return {
        heading: (root.querySelector('h2') || {}).textContent,
        line: (root.querySelector('p') || {}).textContent,
        cards: titles,
        cancel: !!root.querySelector('[data-qs-action="add-cancel"]'),
        focused: document.activeElement && document.activeElement.getAttribute('data-qs-action'),
    }
})

// From a card click until the target has been ready for 600 ms, counts the
// frames in which the switcher was gone but the target wasn't ready, and the
// frames in which the sign-in page's buttons moved with the switcher gone.
// The target is the sign-in form with the notice (password), or the Quick
// Connect code with its opening animation finished (quick).
const watchFrames = (page, target) => page.evaluate((quick) => {
    const w = { frames: 0, uncovered: 0, moved: 0, done: false }
    window.__qsFrames = w
    const start = performance.now()
    let readySince = 0
    let lastTop = null
    const ready = (login) => {
        if (quick) {
            const alert = document.getElementById('quickConnectAlert')
            const running = alert && alert.getAnimations ? alert.getAnimations().some((a) => a.playState === 'running') : false
            return !!alert && !running && getComputedStyle(alert).opacity === '1'
        }
        const form = login && login.querySelector('.manualLoginForm')
        return !!form && form.className.indexOf('hide') === -1 && !!form.querySelector('[data-qs-notice]')
    }
    const step = () => {
        const login = Array.prototype.find.call(document.querySelectorAll('#loginPage'), (p) => p.className.indexOf('hide') === -1)
        const covered = !!document.getElementById('quickswitch')
        const now = performance.now()
        w.frames++
        if (ready(login)) { readySince = readySince || now } else { readySince = 0 }
        if (!covered && !readySince) { w.uncovered++ }
        const buttons = login && login.querySelector('.readOnlyContent')
        const top = buttons ? buttons.getBoundingClientRect().top : null
        if (!covered && !quick && lastTop !== null && top !== null && top !== lastTop) { w.moved++ }
        lastTop = covered ? null : top
        if ((readySince && now - readySince > 600) || now - start > 15000) { w.done = true; w.ready = !!readySince; return }
        requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
}, target === 'quick')
const framesSeen = async (page) => (await waitFor(() => page.evaluate(() => window.__qsFrames), (w) => w && w.done, 16000)).value
// Presses Back, the remote's or the browser's, and from then on counts for
// three seconds the frames in which the switcher wasn't on screen. The
// remote's key is sent in the same task, before the first frame is counted.
async function pressBack(page, how) {
    await page.evaluate((remote) => {
        Array.prototype.forEach.call(document.querySelectorAll('.qs-toast'), (t) => t.parentNode.removeChild(t))
        if (remote) {
            const target = document.activeElement || document.body
            target.dispatchEvent(new KeyboardEvent('keydown', { keyCode: 461, which: 461, bubbles: true, cancelable: true }))
        }
        const w = { frames: 0, uncovered: 0 }
        window.__qsBack = w
        const start = performance.now()
        const step = () => {
            w.frames++
            if (!document.getElementById('quickswitch')) { w.uncovered++ }
            if (performance.now() - start < 3000) { requestAnimationFrame(step) } else { w.done = true }
        }
        requestAnimationFrame(step)
    }, how !== 'browser')
    if (how === 'browser') { await page.goBack() }
}

async function returnState(page) {
    const o = await overlay(page)
    const p = await pageState(page, server.library)
    const extra = await page.evaluate(() => ({
        focus: document.activeElement && document.activeElement.getAttribute('data-qs-action'),
        back: window.__qsBack || null,
        code: !!document.getElementById('quickConnectAlert'),
    }))
    return {
        shown: o.shown, heading: o.heading, watching: (o.tiles.find((t) => t.tag === 'Watching now') || {}).id || null,
        focus: extra.focus, userId: p.userId, home: p.homeVisible, toast: p.toast, code: extra.code,
        frames: extra.back && extra.back.frames, uncovered: extra.back && extra.back.uncovered, done: !!(extra.back && extra.back.done),
    }
}

// After Back: Who's watching? open over alex's home, alex marked
// Watching now and signed in, focus on Add Account, no toast. Read again once
// the three seconds of frames are counted, so a late toast or focus change
// shows.
async function backToSwitcher(page) {
    const ok = (s) => s.shown && s.heading === 'Who’s watching?' && s.watching === A.id && s.focus === 'add' && s.userId === A.id && s.home && !s.toast && !s.code
    const first = await waitFor(() => returnState(page), ok, 15000)
    const last = (await waitFor(() => returnState(page), (s) => s.done, 5000)).value
    return { ok: first.ok && ok(last), state: last }
}

// A second Back closes the switcher onto alex's home, with focus on it.
async function backClosesOntoHome(page) {
    await page.evaluate(() => {
        const target = document.activeElement || document.body
        target.dispatchEvent(new KeyboardEvent('keydown', { keyCode: 461, which: 461, bubbles: true, cancelable: true }))
    })
    return waitFor(() => page.evaluate(() => ({
        shown: !!document.getElementById('quickswitch'),
        home: !!document.querySelector('#indexPage:not(.hide)'),
        focused: !!document.activeElement && document.activeElement !== document.body,
    })), (x) => !x.shown && x.home && x.focused, 5000)
}

const switcherShown = (page) => page.evaluate(() => !!document.getElementById('quickswitch'))

// Holds jellyfin-web's navigation, so the sign-in page never shows.
const holdNavigation = (page) => page.evaluate(() => {
    if (!window.Dashboard || typeof window.Dashboard.navigate !== 'function') { return false }
    window.__qsNavigate = window.Dashboard.navigate
    window.Dashboard.navigate = () => Promise.resolve()
    return true
})
const releaseNavigation = (page) => page.evaluate(() => { if (window.__qsNavigate) { window.Dashboard.navigate = window.__qsNavigate } })

async function openAdd(page, device) {
    await open(page)
    await page.locator('#quickswitch [data-qs-action="add"]').click()
    const d = (await waitFor(() => dialogState(page), (x) => !!x, 3000)).value
    return d && d.heading === 'Add Account' && d.line === `Everyone saved on ${device} stays saved.` ? d : (d || {})
}

async function signInOnly(layout, account) {
    const run = await newPage(browser, server, layout)
    await signIn(run.page, account)
    if (!(await waitSaved(run.page, account))) { return { ...run, error: `the switcher did not save ${account.name}` } }
    await run.page.waitForTimeout(1000)
    return run
}

async function checkAdd() {
    const run = await signInOnly('desktop', A)
    try {
        if (run.error) { fail(`desktop: ${run.error}`); return }
        const { page } = run
        const logouts = []
        page.on('request', (r) => { if (/\/Sessions\/Logout/i.test(r.url())) { logouts.push(r.url()) } })
        const marker = String(Date.now())
        await page.evaluate((value) => { window.__qsMarker = value }, marker)
        const before = await savedTokens(page)

        const d = await openAdd(page, 'this device')
        if (process.env.QS_SHOTS) { await page.waitForTimeout(400); await shot(page, 'add-dialog') }
        check(d.heading === 'Add Account' && JSON.stringify(d.cards) === JSON.stringify(['Sign in with a password', 'Use Quick Connect']) && d.cancel,
            'desktop: Add Account opens its dialog: the line, Sign in with a password, Use Quick Connect and Cancel', JSON.stringify(d))
        if (!d.cancel) { return }
        await page.locator('#quickswitch [data-qs-action="add-cancel"]').click()
        const back = await overlay(page)
        check(back.shown && back.tiles.length === 1 && !(await dialogState(page)) && (await pageState(page, server.library)).userId === A.id,
            'desktop: Cancel returns to the switcher with nothing changed', JSON.stringify({ shown: back.shown, tiles: back.tiles.length }))
        await page.keyboard.press('Escape')

        await openAdd(page, 'this device')
        await watchFrames(page, "password")
        await page.locator('#quickswitch [data-qs-action="add-password"]').click()
        const login = (await waitFor(() => loginState(page), (x) => x.login && x.manual && x.notices.length > 0, 10000)).value
        await shot(page, 'add-signin')
        const frames = await framesSeen(page)
        check(frames && frames.frames > 0 && frames.ready && frames.uncovered === 0 && frames.moved === 0 && !(await switcherShown(page)), 'desktop: the password card goes straight to the sign-in form: the switcher stays until the form and notice show, nothing moves after it closes, and it closes', JSON.stringify(frames))
        const line = 'Adding an account. Back returns to alex.'
        check(login.login && login.manual && login.notices[0] === line && !login.userId, 'desktop: the password card opens jellyfin-web’s sign-in form with the notice line, nobody signed in',
            JSON.stringify(login))
        check(login.marker === marker && logouts.length === 0, 'desktop: no reload and no POST /Sessions/Logout on the way', `marker ${login.marker === marker}, logouts ${logouts.length}`)
        await page.locator('#loginPage:not(.hide) #txtManualName').fill(B.name)
        await page.locator('#loginPage:not(.hide) #txtManualPassword').fill(B.password)
        await page.locator('#loginPage:not(.hide) .manualLoginForm button[type="submit"]').click()
        const asB = await waitFor(() => pageState(page, server.library), (s) => s.homeVisible && s.userId === B.id && s.toast === 'sam is saved on this device', 15000)
        const afterB = await savedTokens(page)
        check(asB.ok && Object.keys(afterB).join() === [A.id, B.id].join(), 'desktop: signing in as sam lands on its home, saves it after alex and says sam is saved',
            `user ${asB.value.userId}, toast ${JSON.stringify(asB.value.toast)}, saved ${Object.keys(afterB)}`)
        check(afterB[A.id] === before[A.id] && (await meStatus(afterB[A.id])) === 200 && (await meStatus(afterB[B.id])) === 200,
            'desktop: alex’s saved token is unchanged and still answers, and so does sam’s')
        check((await pageState(page, server.library)).marker === marker && logouts.length === 0 && !(await loginState(page)).notices.length, 'desktop: still no reload, no sign-out request, and the notice is gone')

        await openAdd(page, 'this device')
        await watchFrames(page, "quick")
        await page.locator('#quickswitch [data-qs-action="add-quick-connect"]').click()
        const qc = (await waitFor(() => loginState(page), (x) => x.code && x.notices.length > 0, 10000)).value
        const qcFrames = await framesSeen(page)
        check(qcFrames && qcFrames.frames > 0 && qcFrames.ready && qcFrames.uncovered === 0 && !(await switcherShown(page)), 'desktop: the Quick Connect card goes straight to its code: the switcher stays until the code has opened, so the sign-in form is never seen', JSON.stringify(qcFrames))
        if (process.env.QS_SHOTS) { await page.waitForTimeout(400); await shot(page, 'add-quick-connect') }
        const qcLine = 'Adding an account. Back returns to sam.'
        const code = qc.code && (qc.code.match(/\d{6}/) || [])[0]
        check(!!code && qc.notices.indexOf(qcLine) !== -1, 'desktop: the Quick Connect card shows its code with the notice line', JSON.stringify(qc))
        if (code) {
            await page.locator('#quickConnectAlert [data-id="ok"]').click().catch(() => {})
            await page.waitForTimeout(1500)
            const waiting = await loginState(page)
            check(waiting.login && !waiting.userId && waiting.notices.indexOf(qcLine) !== -1, 'desktop: Got It closes the code and keeps adding, still on the sign-in page', JSON.stringify(waiting))
            const auth = await request('/Users/AuthenticateByName', { method: 'POST', body: { Username: A.name, Pw: A.password } })
            const approve = await request(`/QuickConnect/Authorize?code=${code}`, { method: 'POST', token: auth.data.AccessToken })
            await request('/Sessions/Logout', { method: 'POST', token: auth.data.AccessToken })
            const asA = await waitFor(() => pageState(page, server.library), (s) => s.homeVisible && s.userId === A.id && s.toast === 'alex is saved on this device', 20000)
            const afterQc = await savedTokens(page)
            const live = (await loginState(page)).token
            check(approve.status < 300 && asA.ok && afterQc[A.id] === live && afterQc[A.id] !== afterB[A.id] && afterQc[B.id] === afterB[B.id],
                'desktop: approving the code as alex signs it in and replaces only its saved token', `approve ${approve.status}, user ${asA.value.userId}, toast ${JSON.stringify(asA.value.toast)}`)
            check((await meStatus(afterQc[A.id])) === 200 && (await meStatus(afterQc[B.id])) === 200, 'desktop: both saved tokens answer after Quick Connect')
        }

        const kept = await savedTokens(page)
        await openAdd(page, 'this device')
        await page.locator('#quickswitch [data-qs-action="add-password"]').click()
        await waitFor(() => loginState(page), (x) => x.login && x.notices.length > 0, 10000)
        await pressBack(page, 'browser')
        const restored = await backToSwitcher(page)
        check(restored.ok && JSON.stringify(await savedTokens(page)) === JSON.stringify(kept) && (await pageState(page, server.library)).marker === marker,
            'desktop: the browser’s Back on the sign-in page signs alex in again in place and opens Who’s watching? on Add Account, no toast, saved accounts unchanged',
            JSON.stringify(restored.state))
        await page.keyboard.press('Escape')
        check(logouts.length === 0, 'desktop: no POST /Sessions/Logout at any point', `${logouts.length} sent`)
    } finally {
        await finish(run)
    }

    const tv = await accountsSaved('tv')
    try {
        if (tv.error) { fail(`tv: ${tv.error}`); return }
        const { page } = tv
        const marker = String(Date.now())
        await page.evaluate((value) => { window.__qsMarker = value }, marker)
        const kept = await savedTokens(page)
        const d = await openAdd(page, 'this TV')
        check(d.heading === 'Add Account' && d.focused === 'add-password', 'tv: the dialog says this TV and starts on Sign in with a password', JSON.stringify(d))
        if (!d.heading) { return }
        await watchFrames(page, "password")
        await page.locator('#quickswitch [data-qs-action="add-password"]').click()
        const login = (await waitFor(() => loginState(page), (x) => x.login && x.notices.length > 0, 10000)).value
        const frames = await framesSeen(page)
        const focusOnLogin = await page.evaluate(() => { const p = Array.prototype.find.call(document.querySelectorAll('#loginPage'), (x) => x.className.indexOf('hide') === -1); return !!p && p.contains(document.activeElement) })
        check(frames && frames.frames > 0 && frames.ready && frames.uncovered === 0 && frames.moved === 0 && !(await switcherShown(page)) && focusOnLogin, 'tv: the password card goes straight to the sign-in form, nothing moves after the switcher closes, and focus is on the sign-in page', JSON.stringify({ frames, focusOnLogin }))
        check(login.notices[0] === 'Adding an account. Back returns to alex.', 'tv: the sign-in page shows the notice line', JSON.stringify(login.notices))
        await pressBack(page, 'remote')
        const restored = await backToSwitcher(page)
        check(restored.ok && restored.state.uncovered === 0 && JSON.stringify(await savedTokens(page)) === JSON.stringify(kept) && (await pageState(page, server.library)).marker === marker,
            'tv: the remote’s Back on the sign-in page covers it at once and ends on Who’s watching?: alex signed in again and Watching now, focus on Add Account, no toast, saved accounts unchanged',
            JSON.stringify(restored.state))
        const closed = await backClosesOntoHome(page)
        check(closed.ok, 'tv: a second Back closes Who’s watching? onto alex’s home, with focus on it', JSON.stringify(closed.value))

        // Quick Connect on the TV: straight to the code, the sign-in form never seen.
        await page.waitForTimeout(1000)
        await openAdd(page, 'this TV')
        await watchFrames(page, 'quick')
        await page.locator('#quickswitch [data-qs-action="add-quick-connect"]').click()
        await waitFor(() => loginState(page), (x) => x.code && x.notices.length > 0, 10000)
        const qcFrames = await framesSeen(page)
        check(qcFrames && qcFrames.ready && qcFrames.uncovered === 0 && !(await switcherShown(page)), 'tv: the Quick Connect card goes straight to its code, the sign-in form never seen', JSON.stringify(qcFrames))
        await pressBack(page, 'remote')
        const fromQc = await backToSwitcher(page)
        check(fromQc.ok && fromQc.state.uncovered === 0 && JSON.stringify(await savedTokens(page)) === JSON.stringify(kept),
            'tv: Back on the Quick Connect code covers it at once and ends on Who’s watching? as above, the code closed', JSON.stringify(fromQc.state))
        await page.keyboard.press('Escape')

        // The sign-in page held back: Back while the dialog waits returns to alex.
        await page.waitForTimeout(1000)
        await openAdd(page, 'this TV')
        const held = await holdNavigation(page)
        await page.locator('#quickswitch [data-qs-action="add-password"]').click()
        await page.waitForTimeout(1500)
        const waiting = await switcherShown(page)
        await releaseNavigation(page)
        await pressBack(page, 'remote')
        const backWaiting = await backToSwitcher(page)
        check(held && waiting && backWaiting.ok && backWaiting.state.uncovered === 0 && JSON.stringify(await savedTokens(page)) === JSON.stringify(kept),
            'tv: Back while the dialog waits for the sign-in page signs alex in again with Who’s watching? staying open on Add Account, saved accounts unchanged',
            JSON.stringify({ held, waiting, state: backWaiting.state }))
        await page.keyboard.press('Escape')

        // The sign-in page never shows: the dialog closes after 10 seconds.
        await page.waitForTimeout(1000)
        await openAdd(page, 'this TV')
        await holdNavigation(page)
        await page.locator('#quickswitch [data-qs-action="add-password"]').click()
        const clicked = Date.now()
        await page.waitForTimeout(8000)
        const at8 = await switcherShown(page)
        const gone = await waitFor(() => switcherShown(page), (shown) => !shown, 5000)
        const after = Date.now() - clicked
        await releaseNavigation(page)
        check(at8 && gone.ok && after < 12000, 'tv: if the sign-in page never shows, the dialog closes after 10 seconds', JSON.stringify({ at8, closed: gone.ok, ms: after }))

        // alex's saved token rejected: Back leaves the sign-in page with the reason. Last, as it spends the token.
        // The held add above is still open; a reload brings alex back, as an app restart would.
        await page.reload()
        await waitFor(() => pageState(page, server.library), (s) => s.homeVisible && s.userId === A.id, 15000)
        const token = (await savedTokens(page))[A.id]
        await openAdd(page, 'this TV')
        await page.locator('#quickswitch [data-qs-action="add-password"]').click()
        await waitFor(() => loginState(page), (x) => x.login && x.manual && x.notices.length > 0, 10000)
        await request('/Sessions/Logout', { method: 'POST', token })
        await pressBack(page, 'remote')
        const rejected = await waitFor(() => page.evaluate(() => ({
            shown: !!document.getElementById('quickswitch'),
            login: Array.prototype.some.call(document.querySelectorAll('#loginPage'), (p) => p.className.indexOf('hide') === -1),
            toast: (document.querySelector('.qs-toast') || { textContent: '' }).textContent.trim(),
        })), (x) => !x.shown && x.login && /stopped working/.test(x.toast), 15000)
        check(rejected.ok && (await staleState(page))[A.id] === true && (await meStatus(token)) === 401,
            'tv: with alex’s token rejected, Back closes the switcher on the sign-in page with the reason and marks alex Sign in again', JSON.stringify(rejected.value))
    } finally {
        await finish(tv)
    }
}

const manageState = (page) => page.evaluate(() => {
    const root = document.getElementById('quickswitch')
    if (!root) { return null }
    const tiles = Array.prototype.map.call(root.querySelectorAll('[data-qs-user]'), (t) => ({
        id: t.getAttribute('data-qs-user'),
        remove: !!root.querySelector(`.qs-bin[data-qs-bin="${t.getAttribute('data-qs-user')}"]:not(.qs-off)`),
        tag: (t.querySelector('.qs-tag') || { textContent: '' }).textContent,
    }))
    const confirm = root.querySelector('.qs-confirm')
    const manage = root.querySelector('[data-qs-action="manage"]')
    return {
        heading: (root.querySelector('h1') || {}).textContent,
        tiles,
        add: !!root.querySelector('[data-qs-action="add"]'),
        button: manage ? manage.textContent.trim() : null,
        hints: (root.querySelector('.qs-hints') || { textContent: '' }).textContent,
        confirm: confirm ? {
            title: (confirm.querySelector('h2') || {}).textContent,
            line: (confirm.querySelector('p') || {}).textContent,
            focused: document.activeElement && document.activeElement.getAttribute('data-qs-action'),
        } : null,
    }
})

// A remove button shows for the hovered or focused tile; hover the tile, then click.
async function clickBin(page, id) {
    await page.locator(`#quickswitch [data-qs-user="${id}"]`).hover()
    // It pops in on hover; click it once it has settled.
    await page.waitForTimeout(250)
    await page.locator(`#quickswitch [data-qs-bin="${id}"]`).click()
}

async function checkRemove(layout) {
    const device = layout === 'tv' ? 'this TV' : 'this device'
    const run = await accountsSaved(layout)
    try {
        if (run.error) { fail(`${layout}: ${run.error}`); return }
        const { page } = run
        const logouts = []
        page.on('request', (r) => { if (/\/Sessions\/Logout/i.test(r.url())) { logouts.push(r.headers().authorization || '') } })
        const marker = String(Date.now())
        await page.evaluate((value) => { window.__qsMarker = value }, marker)
        const before = await savedTokens(page)
        const live = await page.evaluate(() => window.ApiClient.accessToken())

        await open(page)
        const manageButton = page.locator('#quickswitch [data-qs-action="manage"]')
        await manageButton.click()
        const m = await manageState(page)
        const a = (m.tiles.find((t) => t.id === A.id)) || {}
        const b = (m.tiles.find((t) => t.id === B.id)) || {}
        await shot(page, `remove-manage-${layout}`)
        check(m.heading === 'Manage Accounts' && m.button === 'Done' && !m.add, `${layout}: Manage Accounts retitles the switcher, hides Add Account and reads Done`, JSON.stringify(m))
        check(b.remove && !a.remove && a.tag === 'Signed in now', `${layout}: sam has a remove button; alex, signed in now, has only a dimmed one`, JSON.stringify(m.tiles))
        if (layout === 'tv') { check(m.hints.indexOf('Done') !== -1, 'tv: the Back hint reads Done', m.hints) }
        if (!b.remove) { return }

        await clickBin(page, A.id)
        await page.waitForTimeout(400)
        const stays = await manageState(page)
        check(!stays.confirm && stays.tiles.length === 2 && logouts.length === 0, `${layout}: alex's dimmed remove button removes nothing`, JSON.stringify(stays))

        await clickBin(page, B.id)
        const c = (await waitFor(() => manageState(page), (x) => x && x.confirm, 3000)).value
        if (process.env.QS_SHOTS) { await page.waitForTimeout(300); await shot(page, `remove-confirm-${layout}`) }
        check(!!c.confirm && c.confirm.title === `Remove sam from ${device}?`
            && c.confirm.line === 'sam is signed out here. Their account and watch history stay on the server, and signing in again adds them back.'
            && c.confirm.focused === 'confirm-keep', `${layout}: the confirm asks Remove sam from ${device}?, explains, and starts on Keep`, JSON.stringify(c.confirm))
        await page.locator('#quickswitch [data-qs-action="confirm-keep"]').click()
        const kept = await manageState(page)
        const binBack = await page.evaluate(() => document.activeElement && document.activeElement.getAttribute('data-qs-bin'))
        check(!kept.confirm && kept.heading === 'Manage Accounts' && JSON.stringify(await savedTokens(page)) === JSON.stringify(before) && logouts.length === 0,
            `${layout}: Keep returns to Manage Accounts with sam still saved and nothing sent`)
        check(binBack === B.id, `${layout}: after Keep, focus is on sam's remove button`, String(binBack))
        await clickBin(page, B.id)
        await waitFor(() => manageState(page), (x) => x && x.confirm, 3000)
        await page.keyboard.press('Escape')
        const backed = await manageState(page)
        check(!backed.confirm && backed.heading === 'Manage Accounts' && logouts.length === 0, `${layout}: Back on the confirm keeps sam too`)

        await clickBin(page, B.id)
        await waitFor(() => manageState(page), (x) => x && x.confirm, 3000)
        await page.locator('#quickswitch [data-qs-action="confirm-remove"]').click()
        const gone = await waitFor(() => pageState(page, server.library), (s) => s.toast === `sam removed from ${device}`, 8000)
        const afterIds = Object.keys(await savedTokens(page))
        const after = await manageState(page)
        check(gone.ok && afterIds.join() === A.id && after.tiles.length === 1 && after.heading === 'Manage Accounts',
            `${layout}: Remove takes sam off the switcher and this device and says so`, `toast ${JSON.stringify(gone.value.toast)}, saved ${afterIds}`)
        check(logouts.length === 1 && logouts[0].indexOf(before[B.id]) !== -1 && logouts[0].indexOf(live) === -1,
            `${layout}: exactly one POST /Sessions/Logout, sent with sam's own token`, `${logouts.length} sent`)
        check((await meStatus(before[B.id])) === 401 && (await meStatus(before[A.id])) === 200, `${layout}: sam's old token answers 401, alex's still 200`)
        const s = await pageState(page, server.library)
        check(s.userId === A.id && s.marker === marker && (await page.evaluate(() => window.ApiClient.accessToken())) === live,
            `${layout}: alex stays signed in with the same token and no reload`)

        await page.keyboard.press('Escape')
        const done = await manageState(page)
        check(done && done.heading !== 'Manage Accounts' && (await overlay(page)).shown, `${layout}: Back leaves Manage Accounts for the switcher`, JSON.stringify(done && done.heading))
        await page.keyboard.press('Escape')
        check(!(await overlay(page)).shown, `${layout}: Back again closes the switcher`)

        // A removal the server never confirmed: sam is saved again with a fresh token each time.
        const serverId = await page.evaluate(() => window.ApiClient.serverId())
        const resave = async ({ revoked = false } = {}) => {
            const auth = await request('/Users/AuthenticateByName', { method: 'POST', body: { Username: B.name, Pw: B.password } })
            if (revoked) { await request('/Sessions/Logout', { method: 'POST', token: auth.data.AccessToken }) }
            await page.evaluate(({ sid, id, token }) => {
                const store = JSON.parse(window.localStorage.getItem('quickswitch'))
                store.servers[sid] = store.servers[sid].filter((a) => a.UserId !== id)
                // As the switcher saves it: with the address it signed in through.
                store.servers[sid].push({ UserId: id, Name: 'sam', AccessToken: token, Addresses: [window.ApiClient.serverAddress().toLowerCase().replace(/\/+$/, '')] })
                window.localStorage.setItem('quickswitch', JSON.stringify(store))
            }, { sid: serverId, id: B.id, token: auth.data.AccessToken })
            return auth.data.AccessToken
        }
        const askRemove = async () => {
            await open(page)
            await page.locator('#quickswitch [data-qs-action="manage"]').click()
            await clickBin(page, B.id)
            await waitFor(() => manageState(page), (x) => x && x.confirm, 3000)
            await page.locator('#quickswitch [data-qs-action="confirm-remove"]').click()
        }
        const failed = () => page.evaluate(() => {
            const dialog = document.querySelector('#quickswitch .qs-confirm')
            const hints = document.querySelector('#quickswitch .qs-hints')
            return dialog ? {
                heading: dialog.querySelector('h2').textContent,
                buttons: Array.prototype.map.call(dialog.querySelectorAll('button'), (b) => b.getAttribute('data-qs-action')),
                focus: document.activeElement && document.activeElement.getAttribute('data-qs-action'),
                hints: hints ? hints.textContent : null,
            } : null
        })
        const closeAll = async () => { for (let i = 0; i < 3 && (await overlay(page)).shown; i++) { await page.keyboard.press('Escape') } }
        const heading = 'Couldn’t sign sam out on the server'
        const choices = JSON.stringify(['remove-retry', 'remove-local', 'confirm-keep'])

        // Unreachable: nothing is forgotten; the dialog offers the three choices on Try again; Back keeps sam.
        let token = await resave()
        await page.route('**/Sessions/Logout*', (route) => route.abort('connectionrefused'))
        await askRemove()
        const down = await waitFor(failed, (x) => x && x.heading === heading, 15000)
        await shot(page, `remove-failed-${layout}`)
        check(down.ok && JSON.stringify(down.value.buttons) === choices && down.value.focus === 'remove-retry' && (await savedTokens(page))[B.id] === token && !(await pageState(page, server.library)).toast,
            `${layout}: with the server unreachable, Remove forgets nothing and asks, with Try again focused, then Remove from ${device} only and Keep, and no earlier toast is left showing`, JSON.stringify(down.value))
        if (layout === 'tv') {
            const order = []
            for (const key of ['ArrowDown', 'ArrowDown', 'ArrowUp', 'ArrowUp']) { await page.keyboard.press(key); order.push((await failed()).focus); }
            const now = await failed()
            check(JSON.stringify(order) === JSON.stringify(['remove-local', 'confirm-keep', 'remove-local', 'remove-retry']) && /OK\s*Select/.test(now.hints) && /BACK\s*Cancel/.test(now.hints),
                'tv: the remote moves between the three choices, and the hints read OK Select and BACK Cancel', JSON.stringify([order, now.hints]))
        }
        await page.keyboard.press('Escape')
        const keptB = await manageState(page)
        check(!(await failed()) && keptB && keptB.heading === 'Manage Accounts' && (await savedTokens(page))[B.id] === token && (await meStatus(token)) === 200,
            `${layout}: Back keeps sam saved, with its token still working`)
        await closeAll()

        // An error from the server: Try again while it still fails keeps asking; once it answers, sam is removed and revoked.
        await page.unroute('**/Sessions/Logout*')
        await page.route('**/Sessions/Logout*', (route) => route.fulfill({ status: 500, body: '' }))
        await askRemove()
        const erroring = await waitFor(failed, (x) => x && x.heading === heading, 15000)
        await page.locator('#quickswitch [data-qs-action="remove-retry"]').click()
        await page.waitForTimeout(800)
        const still = await failed()
        check(erroring.ok && still && still.heading === heading && (await savedTokens(page))[B.id] === token,
            `${layout}: with the server answering an error, Remove asks too, and Try again while it still fails asks again`, JSON.stringify(still))
        await page.unroute('**/Sessions/Logout*')
        await page.locator('#quickswitch [data-qs-action="remove-retry"]').click()
        // An earlier toast can still be on the page, so wait for sam to leave the store first.
        const retried = await waitFor(() => savedTokens(page), (t) => !t[B.id], 8000)
        const retriedToast = (await pageState(page, server.library)).toast
        check(retried.ok && retriedToast === `sam removed from ${device}` && (await meStatus(token)) === 401,
            `${layout}: Try again once the server answers removes sam and its token answers 401`, `saved ${!retried.ok}, toast ${JSON.stringify(retriedToast)}, token ${await meStatus(token)}`)
        await closeAll()

        // Remove from this device only: forgotten here, still valid on the server.
        token = await resave()
        await page.route('**/Sessions/Logout*', (route) => route.abort('connectionrefused'))
        await askRemove()
        await waitFor(failed, (x) => x && x.heading === heading, 15000)
        await page.locator('#quickswitch [data-qs-action="remove-local"]').click()
        const local = await waitFor(() => savedTokens(page), (t) => !t[B.id], 5000)
        check(local.ok && (await pageState(page, server.library)).toast === `sam removed from ${device}` && (await meStatus(token)) === 200,
            `${layout}: Remove from ${device} only forgets sam here while its token still works on the server`)
        await page.unroute('**/Sessions/Logout*')
        await request('/Sessions/Logout', { method: 'POST', token })
        await closeAll()

        // A slow server: Remove shows that it is working, a second press sends nothing, and leaving drops a late failure.
        const busyState = () => page.evaluate(() => {
            const remove = document.querySelector('#quickswitch [data-qs-action="confirm-remove"]')
            const keep = document.querySelector('#quickswitch [data-qs-action="confirm-keep"]')
            const live = document.querySelector('#quickswitch .qs-live')
            return remove ? { text: remove.textContent.trim(), spinner: !!remove.querySelector('.qs-spinner'), disabled: remove.disabled && !!keep && keep.disabled, live: live ? live.textContent : '' } : null
        })
        const hold = async (answer) => {
            let release
            const held = new Promise((resolve) => { release = resolve })
            const seen = { count: 0 }
            await page.route('**/Sessions/Logout*', async (route) => { seen.count++; await held; await answer(route) })
            return { seen, release: () => release() }
        }
        token = await resave()
        let late = await hold((route) => route.fulfill({ status: 500, body: '' }))
        await askRemove()
        const busy = await waitFor(busyState, (x) => x && x.spinner, 3000)
        await page.evaluate(() => { document.querySelector('#quickswitch [data-qs-action="confirm-remove"]').click() })
        await page.keyboard.press('Enter')
        await page.waitForTimeout(400)
        // The announcement lands a moment after the button changes, as every announcement does.
        const stillBusy = await busyState()
        await shot(page, `remove-busy-${layout}`)
        check(busy.ok && stillBusy && stillBusy.text === 'Removing...' && stillBusy.spinner && stillBusy.disabled && /Removing sam/.test(stillBusy.live) && late.seen.count === 1,
            `${layout}: while the server takes its time, Remove shows a spinner and Removing..., both buttons are disabled, screen readers hear it, and a second press sends nothing`, JSON.stringify({ state: stillBusy, requests: late.seen.count }))
        await page.keyboard.press('Escape')
        const left = await manageState(page)
        late.release()
        await page.waitForTimeout(1500)
        check(left && left.heading === 'Manage Accounts' && !(await failed()) && (await savedTokens(page))[B.id] === token,
            `${layout}: Back while it waits leaves for Manage Accounts, and the late failure shows no dialog and keeps sam`, JSON.stringify(await failed()))
        await page.unroute('**/Sessions/Logout*')
        await closeAll()

        late = await hold((route) => route.continue())
        await askRemove()
        await waitFor(busyState, (x) => x && x.spinner, 3000)
        await page.keyboard.press('Escape')
        late.release()
        const quietly = await waitFor(() => savedTokens(page), (t) => !t[B.id], 8000)
        check(quietly.ok && !(await failed()) && (await meStatus(token)) === 401,
            `${layout}: a late success after Back still removes sam, quietly, and its token answers 401`)
        await page.unroute('**/Sessions/Logout*')
        await closeAll()

        // A token that already no longer works (401) counts as signed out.
        await resave({ revoked: true })
        await askRemove()
        const stale = await waitFor(() => savedTokens(page), (t) => !t[B.id], 8000)
        check(stale.ok && !(await failed()) && (await pageState(page, server.library)).toast === `sam removed from ${device}`, `${layout}: a Logout answered 401 removes sam without asking`, JSON.stringify(await failed()))
        await closeAll()
    } finally {
        await finish(run)
    }
}

const staleState = (page) => page.evaluate(() => {
    const out = {}
    try {
        const store = JSON.parse(window.localStorage.getItem('quickswitch') || '{}')
        for (const a of (store.servers || {})[window.ApiClient.serverId()] || []) { out[a.UserId] = !!a.Stale }
    } catch { /* an unreadable store marks nobody */ }
    return out
})

const tileLook = (page, id) => page.evaluate((userId) => {
    const t = document.querySelector(`#quickswitch [data-qs-user="${userId}"]`)
    if (!t) { return null }
    return {
        tag: (t.querySelector('.qs-tag') || { textContent: '' }).textContent,
        lock: !!t.querySelector('.qs-lock'),
        color: getComputedStyle(t.querySelector('.qs-avatar')).backgroundColor,
    }
}, id)

const nameField = (page) => page.evaluate(() => {
    const field = document.querySelector('#loginPage:not(.hide) #txtManualName')
    return field ? field.value : null
})

async function checkStale(layout) {
    const device = layout === 'tv' ? 'this TV' : 'this device'
    const line = `sam’s saved sign-in stopped working. Sign in again to keep sam on ${device}.`
    const run = await accountsSaved(layout)
    try {
        if (run.error) { fail(`${layout}: ${run.error}`); return }
        const { page } = run
        const logouts = []
        page.on('request', (r) => { if (/\/Sessions\/Logout/i.test(r.url())) { logouts.push(r.url()) } })
        const marker = String(Date.now())
        await page.evaluate((value) => { window.__qsMarker = value }, marker)
        const before = await savedTokens(page)
        await request('/Sessions/Logout', { method: 'POST', token: before[B.id] })
        check((await meStatus(before[B.id])) === 401, `${layout}: sam's saved token is revoked on the server, as a password change or a deleted device does`)

        await open(page)
        await page.locator(`#quickswitch [data-qs-user="${B.id}"]`).click()
        const login = (await waitFor(() => loginState(page), (x) => x.login && x.manual && x.notices.length > 0, 10000)).value
        await waitFor(() => nameField(page), (v) => v === 'sam', 3000)
        if (process.env.QS_SHOTS) { await shot(page, `stale-signin-${layout}`) }
        check(login.login && login.manual && login.notices[0] === line && (await nameField(page)) === 'sam' && !login.userId,
            `${layout}: selecting sam opens jellyfin-web's sign-in with sam filled in and the notice`, JSON.stringify({ notices: login.notices, name: await nameField(page) }))
        check(login.marker === marker && logouts.length === 0, `${layout}: no reload and no POST /Sessions/Logout on the way`)
        if (!login.notices.length) { return }

        await pressBack(page, layout === 'tv' ? 'remote' : 'browser')
        const restored = await backToSwitcher(page)
        check(restored.ok, `${layout}: Back signs alex in again in place and opens Who’s watching?`, JSON.stringify(restored.state))
        const grey = await tileLook(page, B.id)
        if (process.env.QS_SHOTS) { await page.waitForTimeout(300); await shot(page, `stale-tile-${layout}`) }
        check(!!grey && grey.lock && grey.tag === 'Sign in again' && grey.color === 'rgb(51, 51, 51)' && (await staleState(page))[B.id] === true,
            `${layout}: sam's tile is now grey with the lock badge and Sign in again, and sam is still saved`, JSON.stringify(grey))
        if (layout === 'tv') { await page.keyboard.press('Escape'); return }

        await page.locator(`#quickswitch [data-qs-user="${B.id}"]`).click()
        await waitFor(() => loginState(page), (x) => x.login && x.manual && x.notices.length > 0, 10000)
        const named = await waitFor(() => nameField(page), (v) => v === 'sam', 3000)
        check(named.ok, 'desktop: the grey tile opens the sign-in again, sam filled in', JSON.stringify(named.value))
        await page.locator('#loginPage:not(.hide) #txtManualPassword').fill(B.password)
        await page.locator('#loginPage:not(.hide) .manualLoginForm button[type="submit"]').click()
        const asB = await waitFor(() => pageState(page, server.library), (s) => s.homeVisible && s.userId === B.id && s.toast === 'Now watching as sam', 15000)
        const after = await savedTokens(page)
        check(asB.ok && after[B.id] && after[B.id] !== before[B.id] && (await meStatus(after[B.id])) === 200 && (await meStatus(after[A.id])) === 200,
            'desktop: signing in as sam lands on its home with a new saved token that answers, and alex’s still answers', `user ${asB.value.userId}, toast ${JSON.stringify(asB.value.toast)}`)
        await open(page)
        const fresh = await tileLook(page, B.id)
        check(!!fresh && !fresh.lock && fresh.tag === 'Watching now' && (await staleState(page))[B.id] === false, 'desktop: sam’s tile is no longer grey', JSON.stringify(fresh))
        await page.keyboard.press('Escape')

        await page.route('**/Users/Me*', (route) => route.abort('connectionrefused'))
        await open(page)
        await page.locator(`#quickswitch [data-qs-user="${A.id}"]`).click()
        const down = await waitFor(() => pageState(page, server.library), (s) => s.toast === 'Can’t reach the server right now. You’re still watching as sam.', 8000)
        check(down.ok && (await staleState(page))[A.id] === false, 'desktop: with the server unreachable, alex is not marked as stopped working', JSON.stringify(down.value.toast))
        await page.unroute('**/Users/Me*')
        check((await pageState(page, server.library)).marker === marker && logouts.length === 0, 'desktop: no reload and no sign-out request at any point')
    } finally {
        await finish(run)
    }
}

// What has focus, and whether it shows the switcher's focus treatment.
const focusState = (page) => page.evaluate(() => {
    const e = document.activeElement
    const root = document.getElementById('quickswitch')
    if (!e) { return { inside: false } }
    const accent = 'rgb(0, 164, 220)'
    let ring = false
    if (e.classList.contains('qs-tile')) {
        ring = getComputedStyle(e.querySelector('.qs-avatar')).boxShadow.indexOf(accent) !== -1
    } else if (e.classList.contains('qs-card')) {
        ring = getComputedStyle(e).boxShadow.indexOf(accent) !== -1
    } else if (e.classList.contains('qs-bin')) {
        ring = getComputedStyle(e).boxShadow.indexOf(accent) !== -1
    } else if (e.classList.contains('qs-button')) {
        ring = getComputedStyle(e).backgroundColor === accent
    } else if (e.classList.contains('qs-cancel') || e.classList.contains('qs-close')) {
        ring = getComputedStyle(e).backgroundColor !== 'rgba(0, 0, 0, 0)'
    }
    return {
        inside: !!root && root.contains(e),
        user: e.getAttribute('data-qs-user'),
        action: e.getAttribute('data-qs-action'),
        entry: e.getAttribute('data-qs-entry'),
        ring,
    }
})

const label = (f) => f.user ? (f.user === A.id ? 'alex' : f.user === B.id ? 'sam' : f.user) : f.action || f.entry || (f.inside ? 'inside' : 'outside')

async function key(page, name) {
    await page.keyboard.press(name)
    await page.waitForTimeout(260)
    return focusState(page)
}

async function expectKeys(page, layout, steps) {
    for (const [name, want] of steps) {
        const f = await key(page, name)
        if (label(f) !== want || !f.ring) {
            fail(`${layout}: ${name} should focus ${want} with the focus ring, focused ${label(f)} (ring ${f.ring})`)
            return false
        }
    }
    return true
}

async function checkRemote() {
    const run = await accountsSaved('tv')
    try {
        if (run.error) { fail(`tv: ${run.error}`); return }
        const { page } = run
        const marker = String(Date.now())
        await page.evaluate((value) => { window.__qsMarker = value }, marker)
        await page.evaluate(() => { location.hash = '#/mypreferencesmenu' })
        await page.waitForFunction(() => document.querySelector('#myPreferencesMenuPage:not(.hide) [data-qs-entry="settings"]'), null, { timeout: 10000 })
        await page.waitForTimeout(500)
        let reached = false
        for (let i = 0; i < 25 && !reached; i++) {
            reached = (await key(page, 'ArrowDown')).entry === 'settings'
        }
        check(reached, 'tv: the arrow keys reach Switch Account on the settings page')
        if (!reached) { return }
        await page.evaluate(() => {
            window.__qsLeaked = 0
            window.__qsHashes = 0
            window.addEventListener('keydown', () => { if (document.getElementById('quickswitch')) { window.__qsLeaked++ } })
            window.addEventListener('hashchange', () => { if (document.getElementById('quickswitch')) { window.__qsHashes++ } })
        })
        const opened = await key(page, 'Enter')
        check((await overlay(page)).shown && label(opened) === 'alex' && opened.ring, 'tv: Enter on Switch Account opens the switcher with focus on alex', label(opened))

        const tiles = await expectKeys(page, 'tv', [['ArrowLeft', 'sam'], ['ArrowLeft', 'sam'], ['ArrowRight', 'alex'], ['ArrowRight', 'add'], ['ArrowRight', 'add'], ['ArrowDown', 'manage']])
        const up = await key(page, 'ArrowUp')
        check(tiles && up.inside && !!up.user && up.ring, 'tv: Left and Right move along the tiles and stop at the ends, Down reaches Manage Accounts, Up returns to a tile', label(up))

        let onAdd = label(up) === 'add'
        for (let i = 0; i < 3 && !onAdd; i++) { onAdd = label(await key(page, 'ArrowRight')) === 'add'; }
        const dialog = await key(page, 'Enter')
        const inDialog = label(dialog) === 'add-password' && dialog.ring
            && await expectKeys(page, 'tv', [['ArrowDown', 'add-quick-connect'], ['ArrowDown', 'add-cancel'], ['ArrowDown', 'add-cancel'], ['ArrowUp', 'add-quick-connect'], ['ArrowUp', 'add-password'], ['ArrowDown', 'add-quick-connect'], ['ArrowDown', 'add-cancel']])
        const cancelled = await key(page, 'Enter')
        check(onAdd && inDialog && label(cancelled) === 'add' && !(await dialogState(page)), 'tv: in the Add Account dialog Up and Down move between the cards and Cancel, and Enter on Cancel returns to Add Account',
            `dialog ${label(dialog)}, after ${label(cancelled)}`)

        const manageFocus = await key(page, 'ArrowDown')
        const managing = await key(page, 'Enter')
        const m = await manageState(page)
        check(label(manageFocus) === 'manage' && m.heading === 'Manage Accounts' && label(managing) === 'manage', 'tv: Enter on Manage Accounts opens it, focus on Done', label(managing))
        let onB = label(await key(page, 'ArrowUp')) === 'sam'
        for (let i = 0; i < 2 && !onB; i++) { onB = label(await key(page, 'ArrowLeft')) === 'sam'; }
        const binFocus = await key(page, 'ArrowUp')
        onB = onB && label(binFocus) === 'remove' && binFocus.ring
        const confirmFocus = await key(page, 'Enter')
        const confirmKeys = onB && label(confirmFocus) === 'confirm-keep' && confirmFocus.ring
            && await expectKeys(page, 'tv', [['ArrowDown', 'confirm-remove'], ['ArrowUp', 'confirm-keep']])
        const kept = await key(page, 'Enter')
        check(confirmKeys && label(kept) === 'remove' && Object.keys(await savedTokens(page)).length === 2,
            'tv: Up from sam reaches its remove button, Enter opens the confirm on Keep, Down reaches Remove, and Enter on Keep returns to the remove button with nothing removed', `confirm ${label(confirmFocus)}, after ${label(kept)}`)

        await key(page, 'Enter')
        const s1 = (await manageState(page)) || {}
        await key(page, 'Escape')
        const s2 = (await manageState(page)) || {}
        await key(page, 'Escape')
        const s3 = (await manageState(page)) || {}
        const back = await key(page, 'Escape')
        check(!!s1.confirm && !s2.confirm && s2.heading === 'Manage Accounts' && s3.heading !== 'Manage Accounts' && !(await overlay(page)).shown,
            'tv: Back walks the confirm, Manage Accounts, Who’s watching? and closes', JSON.stringify([!!s1.confirm, s2.heading, s3.heading]))
        check(back.entry === 'settings', 'tv: after closing, focus is back on the Switch Account row', label(back))
        const leaked = await page.evaluate(() => ({ keys: window.__qsLeaked, hashes: window.__qsHashes }))
        check(leaked.keys === 0 && leaked.hashes === 0 && (await pageState(page, server.library)).marker === marker,
            'tv: while the switcher was open no key reached jellyfin-web and no page changed', JSON.stringify(leaked))
    } finally {
        await finish(run)
    }

    const web = await accountsSaved('desktop')
    try {
        if (web.error) { fail(`desktop: ${web.error}`); return }
        const { page } = web
        await open(page)
        const keys = await expectKeys(page, 'desktop', [['ArrowLeft', 'sam'], ['ArrowRight', 'alex'], ['ArrowRight', 'add'], ['ArrowDown', 'manage']])
        let close = false
        for (let i = 0; i < 8 && !close; i++) { close = label(await key(page, 'Tab')) === 'close'; }
        check(keys && close, 'desktop: the arrows work the same, and Tab reaches the close button')
        const closed = await key(page, 'Enter')
        check(!(await overlay(page)).shown, 'desktop: Enter on the close button closes the switcher', label(closed))
    } finally {
        await finish(web)
    }
}

const reorderState = (page) => page.evaluate(() => {
    const root = document.getElementById('quickswitch')
    if (!root) { return { closed: true, order: [], bins: [], hints: '', sub: '' } }
    const shown = (e) => !!e && e.getBoundingClientRect().width > 0 && getComputedStyle(e).display !== 'none'
    const focused = document.activeElement
    const lifted = root.querySelector('.qs-lifted')
    const shownLabel = Array.prototype.find.call(root.querySelectorAll('.qs-bin-label'), shown)
    const live = root.querySelector('.qs-live')
    return {
        heading: (root.querySelector('h1') || {}).textContent,
        sub: (root.querySelector('.qs-sub') || {}).textContent,
        order: Array.prototype.map.call(root.querySelectorAll('[data-qs-user]'), (t) => t.getAttribute('data-qs-user')),
        badges: root.querySelectorAll('.qs-move').length,
        bins: Array.prototype.filter.call(root.querySelectorAll('.qs-bin'), shown).map((b) => b.getAttribute('data-qs-bin')),
        focusUser: focused && focused.getAttribute('data-qs-user'),
        focusBin: focused && focused.getAttribute('data-qs-bin'),
        binLabel: shownLabel ? shownLabel.textContent : null,
        labelClear: shownLabel ? shownLabel.getBoundingClientRect().top >= root.querySelector('.qs-sub').getBoundingClientRect().bottom : null,
        labelInside: shownLabel ? (shownLabel.getBoundingClientRect().left >= 0 && shownLabel.getBoundingClientRect().right <= window.innerWidth) : null,
        scrolled: (root.querySelector('.qs-panel') || {}).scrollLeft || 0,
        binRed: focused && focused.classList.contains('qs-bin') ? getComputedStyle(focused).color : null,
        cover: !!focused && !!focused.querySelector && shown(focused.querySelector('.qs-cover')),
        lifted: lifted ? lifted.getAttribute('data-qs-slot') : null,
        liftTransform: lifted ? getComputedStyle(lifted.querySelector('.qs-avatar')).transform : null,
        steps: Array.prototype.filter.call(root.querySelectorAll('.qs-step'), shown).length,
        done: root.querySelector('[data-qs-action="manage"]') ? getComputedStyle(root.querySelector('[data-qs-action="manage"]')).opacity : null,
        hints: (root.querySelector('.qs-hints') || { textContent: '' }).textContent,
        live: live ? live.textContent : null,
        confirm: !!root.querySelector('.qs-confirm'),
        toast: !!document.querySelector('.qs-toast'),
    }
})

const savedOrder = (page) => savedIds(page)

async function checkReorder(layout) {
    const run = await accountsSaved(layout)
    try {
        if (run.error) { fail(`${layout}: ${run.error}`); return }
        const { page } = run
        const marker = String(Date.now())
        await page.evaluate((value) => {
            window.__qsMarker = value
            window.__qsLeaked = 0
            window.addEventListener('keydown', () => { if (document.getElementById('quickswitch')) { window.__qsLeaked++ } })
        }, marker)
        const start = await savedOrder(page)
        check(start.join() === [B.id, A.id].join(), `${layout}: sam and alex are saved in that order`, start.join())
        await open(page)
        await page.locator('#quickswitch [data-qs-action="manage"]').click()
        await page.waitForTimeout(300)
        const m = await reorderState(page)
        check(m.heading === 'Manage Accounts' && m.sub === 'Move or remove accounts' && m.badges === 2 && m.bins.length === (layout === 'tv' ? 0 : m.bins.length),
            `${layout}: Manage Accounts reads Move or remove accounts, with a move badge on each tile`, JSON.stringify(m))

        if (layout === 'tv') {
            const onTile = async (id) => { let f = await reorderState(page); for (let i = 0; i < 4 && f.focusUser !== id; i++) { await key(page, f.focusUser || f.focusBin ? 'ArrowLeft' : 'ArrowUp'); f = await reorderState(page) } return f }
            const b1 = await onTile(B.id)
            await page.waitForTimeout(300); await shot(page, "reorder-tv-tile")
            check(b1.focusUser === B.id && b1.bins.join() === B.id && b1.cover && b1.hints.indexOf('Move') !== -1 && b1.hints.indexOf('Remove') !== -1 && b1.hints.indexOf('Done') !== -1,
                'tv: focus on sam shows its move overlay and only its remove button; the hints read OK Move, ▲ Remove, BACK Done', JSON.stringify(b1))
            await key(page, 'ArrowUp')
            const b2 = await reorderState(page)
            await shot(page, "reorder-tv-bin")
            check(b2.focusBin === B.id && b2.binLabel === 'Remove sam' && b2.binRed === 'rgb(211, 47, 47)' && b2.hints.indexOf('Back to the account') !== -1,
                'tv: Up focuses sam’s remove button, red, labelled Remove sam', JSON.stringify(b2))
            await key(page, 'ArrowRight')
            const a2 = await reorderState(page)
            await shot(page, "reorder-tv-current-bin")
            check(a2.focusBin === A.id && a2.binLabel === 'Switch accounts to remove alex' && a2.hints.indexOf('OK') === -1 && a2.labelInside && a2.labelClear && a2.scrolled === 0,
                'tv: Right reaches alex’s dimmed button, labelled Switch accounts to remove alex, with the label whole and nothing shifted', JSON.stringify(a2))
            await key(page, 'Enter')
            const a3 = await reorderState(page)
            check(!a3.confirm && (await savedOrder(page)).length === 2, 'tv: OK on it removes nothing', JSON.stringify(a3))
            await key(page, 'ArrowLeft')
            await key(page, 'Enter')
            const c = await reorderState(page)
            const keepFocus = await page.evaluate(() => document.activeElement.getAttribute('data-qs-action'))
            const covered = await page.evaluate((id) => { const bin = document.querySelector('[data-qs-bin="' + id + '"]'); const r = bin.getBoundingClientRect(); const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); const label = document.querySelector('[data-qs-slot="' + id + '"] .qs-bin-label'); const l = label.getBoundingClientRect(); const overLabel = l.width ? document.elementFromPoint(l.left + l.width / 2, l.top + l.height / 2) : null; return !!top && !!top.closest('.qs-scrim') && (!overLabel || !!overLabel.closest('.qs-scrim')) }, B.id)
            check(covered, 'tv: the confirm covers the remove button and its label')
            await key(page, 'Enter')
            const k = await reorderState(page)
            check(c.confirm && keepFocus === 'confirm-keep' && !k.confirm && k.focusBin === B.id, 'tv: OK on sam’s button opens the confirm on Keep; Keep returns to the button', JSON.stringify({ keepFocus, k }))
            await key(page, 'ArrowDown')
            await key(page, 'Enter')
            const l = await reorderState(page)
            await page.waitForTimeout(300); await shot(page, "reorder-tv-lifted")
            check(l.lifted === B.id && l.liftTransform !== 'none' && l.done === '0.35' && l.sub.indexOf('Moving sam') === 0 && l.hints.indexOf('Put here') !== -1 && l.bins.length === 0,
                'tv: OK on sam picks it up, raised, with the moving hints and Done dimmed', JSON.stringify(l))
            await key(page, 'ArrowRight')
            const moved = await reorderState(page)
            await key(page, 'Escape')
            const cancelled = await reorderState(page)
            check(moved.order.join() === [A.id, B.id].join() && cancelled.order.join() === [B.id, A.id].join() && !cancelled.lifted && cancelled.focusUser === B.id
                && (await savedOrder(page)).join() === [B.id, A.id].join(),
            'tv: Right moves it; Back puts it back where it was and saves nothing', JSON.stringify({ moved: moved.order, cancelled }))
            await key(page, 'Enter')
            await key(page, 'ArrowRight')
            await key(page, 'ArrowRight')
            await key(page, 'Enter')
            await page.waitForTimeout(300)
            const d = await reorderState(page)
            check(d.order.join() === [A.id, B.id].join() && !d.lifted && d.focusUser === B.id && (await savedOrder(page)).join() === [A.id, B.id].join()
                && d.live === 'sam moved to place 2 of 2' && !d.toast,
            'tv: OK, Right and OK moves sam to the end and saves it; screen readers hear it, and no toast shows', JSON.stringify(d))
            await key(page, 'Escape')
            const pick = await reorderState(page)
            check(pick.heading === 'Who’s watching?' && pick.order.join() === [A.id, B.id].join(), 'tv: Who’s watching? shows the new order', JSON.stringify(pick.order))
            const leaked = await page.evaluate(() => window.__qsLeaked)
            check(leaked === 0 && (await pageState(page, server.library)).marker === marker, 'tv: no key reached jellyfin-web and no page changed', String(leaked))
        } else {
            const center = async (id) => { const r = await page.locator(`#quickswitch [data-qs-user="${id}"] .qs-avatar`).boundingBox(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } }
            const from = await center(A.id)
            const to = await center(B.id)
            await page.mouse.move(from.x, from.y)
            await page.mouse.down()
            for (let i = 1; i <= 12; i++) { await page.mouse.move(from.x + (to.x - from.x) * i / 12, from.y + (to.y - from.y) * i / 12); await page.waitForTimeout(20); }
            const during = await reorderState(page)
            await shot(page, "reorder-desktop-drag")
            await page.mouse.up()
            await page.waitForTimeout(400)
            const dragged = await reorderState(page)
            check(during.lifted === A.id && during.sub === 'Drag alex to a new place and let go' && dragged.order.join() === [A.id, B.id].join() && !dragged.lifted && !dragged.confirm
                && (await savedOrder(page)).join() === [A.id, B.id].join(),
            'desktop: dragging alex onto sam moves it first and saves the order', JSON.stringify({ during, dragged }))
            await page.locator(`#quickswitch [data-qs-user="${A.id}"]`).click()
            const lifted = await reorderState(page)
            await page.waitForTimeout(300); await shot(page, "reorder-desktop-lifted")
            await page.locator(`#quickswitch [data-qs-slot="${A.id}"] .qs-step-right`).click()
            await page.waitForTimeout(250)
            const stepped = await reorderState(page)
            await page.locator(`#quickswitch [data-qs-user="${A.id}"]`).click()
            await page.waitForTimeout(300)
            const put = await reorderState(page)
            check(lifted.lifted === A.id && lifted.steps === 2 && stepped.order.join() === [B.id, A.id].join() && !put.lifted && (await savedOrder(page)).join() === [B.id, A.id].join(),
                'desktop: clicking alex picks it up with arrow buttons; the right arrow moves it and clicking it puts it down', JSON.stringify({ lifted, stepped: stepped.order, put }))
            await page.locator(`#quickswitch [data-qs-user="${B.id}"]`).hover()
            const hovered = await reorderState(page)
            check(hovered.bins.indexOf(B.id) !== -1, 'desktop: hovering sam shows its remove button', JSON.stringify(hovered.bins))
        }

        await page.reload()
        await page.waitForFunction(() => window.QuickSwitch && document.querySelector('#indexPage:not(.hide)'), null, { timeout: 30000 })
        await open(page)
        const after = await reorderState(page)
        const want = layout === 'tv' ? [A.id, B.id] : [B.id, A.id]
        check(after.order.join() === want.join(), `${layout}: after a reload Who’s watching? keeps the order`, JSON.stringify(after.order))
        await page.keyboard.press('Escape')

        // Six more saved accounts, which only need to be drawn: two rows.
        const extra = ['c', 'd', 'e', 'f', 'g', 'h'].map((x) => ({ UserId: 'extra' + x, Name: 'extra-' + x, AccessToken: 'none' }))
        await page.evaluate((more) => {
            const store = JSON.parse(window.localStorage.getItem('quickswitch'))
            store.servers[window.ApiClient.serverId()] = store.servers[window.ApiClient.serverId()].concat(more)
            window.localStorage.setItem('quickswitch', JSON.stringify(store))
        }, extra)
        await open(page)
        await page.locator('#quickswitch [data-qs-action="manage"]').click()
        await page.waitForTimeout(300)
        if (layout === 'tv') {
            await page.locator(`#quickswitch [data-qs-user="${want[0]}"]`).focus()
            await key(page, 'Enter')
            const many = await reorderState(page)
            await key(page, 'ArrowDown')
            const down = await reorderState(page)
            await shot(page, 'reorder-tv-many')
            await key(page, 'ArrowUp')
            const up = await reorderState(page)
            await key(page, 'Escape')
            check(many.lifted === want[0] && down.order.indexOf(want[0]) === 5 && up.order.indexOf(want[0]) === 0 && many.hints.indexOf('▲ ▼') !== -1,
                'tv: with eight accounts, Down moves a picked-up tile one row and Up moves it back; the hints add ▲ ▼', JSON.stringify({ down: down.order.indexOf(want[0]), up: up.order.indexOf(want[0]), hints: many.hints }))
        } else {
            await page.setViewportSize({ width: 390, height: 844 })
            await page.waitForTimeout(400)
            const phone = Object.assign(await reorderState(page), await page.evaluate(() => { const slots = Array.prototype.slice.call(document.querySelectorAll('#quickswitch .qs-slot')); return { tileWidth: Math.round(document.querySelector('#quickswitch .qs-avatar').getBoundingClientRect().width), perRow: slots.filter((x) => x.offsetTop === slots[0].offsetTop).length } }))
            await shot(page, 'reorder-phone')
            check(phone.bins.length === 8 && phone.tileWidth === 104 && phone.perRow === 2,
                'phone: two columns of 104 px tiles, each showing its remove button without focus', JSON.stringify(phone.bins))
        }
    } finally {
        await finish(run)
    }
}

// Reloads on jellyfin-web's sign-in page, as an app restart would, and waits for the switcher to act.

test('add: Add Account signs another account in without signing anyone out, and Back returns', () => checked(checkAdd))
test('remove: Manage Accounts removes an account and revokes only its own token (desktop)', () => checked(() => checkRemove('desktop')))
test('remove: Manage Accounts removes an account and revokes only its own token (tv)', () => checked(() => checkRemove('tv')))
test('stale: a saved sign-in that stopped working asks to sign in again (desktop)', () => checked(() => checkStale('desktop')))
test('stale: a saved sign-in that stopped working asks to sign in again (tv)', () => checked(() => checkStale('tv')))
test('remote: the arrows, Enter and Back drive the switcher and never reach jellyfin-web', () => checked(checkRemote))
test('reorder: Manage Accounts moves an account with the remote, a drag or the arrow buttons (tv)', () => checked(() => checkReorder('tv')))
test('reorder: Manage Accounts moves an account with the remote, a drag or the arrow buttons (desktop)', () => checked(() => checkReorder('desktop')))
