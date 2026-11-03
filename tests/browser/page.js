// Drives jellyfin-web with the switcher in it, and reads what the switcher shows.
const { chromium } = require('playwright-core')
const { signOutToken } = require('./server')
const coverage = require('./coverage')

// QS_BROWSER_CHANNEL=chrome uses an installed Google Chrome (as CI does);
// otherwise Playwright's Chromium (npx playwright-core install chromium).
function launch() {
    const channel = process.env.QS_BROWSER_CHANNEL
    return chromium.launch({ headless: !process.env.QS_HEADED, ...(channel ? { channel } : {}) })
}

const VIEWPORTS = { tv: { width: 1280, height: 720 }, desktop: { width: 1280, height: 800 }, 'desktop-legacy': { width: 1280, height: 800 } }

async function waitFor(fn, test, timeout) {
    const until = Date.now() + timeout
    for (;;) {
        const value = await fn()
        if (test(value)) { return { value, ok: true } }
        if (Date.now() > until) { return { value, ok: false } }
        await new Promise((resolve) => setTimeout(resolve, 150))
    }
}

async function newPage(browser, server, layout) {
    const context = await browser.newContext({ viewport: VIEWPORTS[layout] })
    await context.addInitScript((value) => { try { window.localStorage.setItem('layout', value) } catch { /* storage off */ } }, layout)
    const page = await context.newPage()
    await coverage.start(page)
    await page.goto(`${server.base}/web/`)
    return { context, page }
}

// Signs in with jellyfin-web's manual form; `remember: false` unticks Remember me.
async function signIn(page, account, { remember = true } = {}) {
    const name = page.locator('#txtManualName')
    const until = Date.now() + 30000
    while (!(await name.isVisible())) {
        if (Date.now() > until) { throw new Error('jellyfin-web never showed its manual sign-in form') }
        await page.locator('.btnManual:visible').first().click({ timeout: 1000 }).catch(() => {})
        await page.waitForTimeout(250)
    }
    await name.fill(account.name)
    await page.locator('#txtManualPassword').fill(account.password)
    await page.locator('.manualLoginForm .chkRememberLogin').setChecked(remember, { force: true })
    await page.locator('.manualLoginForm button[type="submit"]').click()
    await page.waitForFunction((id) => window.ApiClient && window.ApiClient.getCurrentUserId() === id && document.querySelector('#indexPage:not(.hide)'), account.id, { timeout: 30000 })
}

const savedIds = (page) => page.evaluate(() => {
    try {
        const store = JSON.parse(window.localStorage.getItem('quickswitch') || '{}')
        return ((store.servers || {})[window.ApiClient.serverId()] || []).map((a) => a.UserId)
    } catch { return [] }
})

// alex administers the server, so signing it in asks before saving it; these tests answer Save.
async function waitSaved(page, account) {
    const until = Date.now() + 10000
    while (Date.now() < until) {
        if ((await savedIds(page)).includes(account.id)) { return true }
        await page.locator('#quickswitch [data-qs-action="admin-save"]').click({ timeout: 200 }).catch(() => {})
        await page.waitForTimeout(250)
    }
    return false
}

// Signs in as sam, then as alex without signing sam out (as Add Account does), so both are saved.
async function withTwoAccounts(browser, server, layout) {
    const { alex, sam } = server.accounts
    const run = await newPage(browser, server, layout)
    const { page } = run
    await signIn(page, sam)
    if (!(await waitSaved(page, sam))) { throw new Error('the switcher did not save sam after it signed in') }
    await page.evaluate(() => {
        const credentials = JSON.parse(window.localStorage.getItem('jellyfin_credentials'))
        credentials.Servers.forEach((s) => { delete s.AccessToken; delete s.UserId })
        window.localStorage.setItem('jellyfin_credentials', JSON.stringify(credentials))
    })
    await page.reload()
    await signIn(page, alex)
    if (!(await waitSaved(page, alex))) { throw new Error('the switcher did not save alex after it signed in') }
    await page.waitForTimeout(1500)
    return run
}

// Signs every token the page holds out on the server, then closes the page.
async function close(server, { context, page }) {
    const tokens = await page.evaluate(() => {
        try {
            const store = JSON.parse(window.localStorage.getItem('quickswitch') || '{}')
            return [].concat(...Object.values(store.servers || {})).map((a) => a.AccessToken)
        } catch { return [] }
    }).catch(() => [])
    const active = await page.evaluate(() => window.ApiClient && window.ApiClient.accessToken()).catch(() => null)
    for (const token of new Set([...tokens, active].filter(Boolean))) { await signOutToken(server, token) }
    await coverage.save(page)
    await context.close()
}

const overlay = (page) => page.evaluate(() => {
    const root = document.getElementById('quickswitch')
    const shown = !!root && root.style.display !== 'none' && root.getBoundingClientRect().width > 0
    const text = (sel) => { const e = root && root.querySelector(sel); return e ? e.textContent.trim() : null }
    const visible = (sel) => { const e = root && root.querySelector(sel); return !!e && e.getBoundingClientRect().width > 0 }
    return {
        shown,
        heading: text('h1'),
        sub: text('.qs-sub'),
        tiles: root ? Array.prototype.map.call(root.querySelectorAll('[data-qs-user]'), (t) => ({
            id: t.getAttribute('data-qs-user'),
            name: (t.querySelector('.qs-name') || {}).textContent,
            tag: (t.querySelector('.qs-tag') || { textContent: '' }).textContent,
            initial: (t.querySelector('.qs-initial') || { textContent: '' }).textContent,
            color: getComputedStyle(t.querySelector('.qs-avatar')).backgroundColor,
            image: !!t.querySelector('.qs-avatar img'),
        })) : [],
        add: text('[data-qs-action="add"] .qs-name'),
        manage: text('[data-qs-action="manage"]'),
        hints: visible('.qs-hints'),
        close: visible('[data-qs-action="close"]'),
        splash: text('.qs-splash'),
    }
})

const pageState = (page, library) => page.evaluate((name) => {
    const home = document.querySelector('#indexPage:not(.hide)')
    const tab = home ? home.querySelector('#homeTab') : null
    const text = tab ? tab.innerText : ''
    const toast = document.querySelector('.qs-toast')
    return {
        homeVisible: !!home,
        showsLibrary: text.indexOf(name) !== -1,
        nothingHere: text.indexOf('Nothing here.') !== -1,
        userId: window.ApiClient && window.ApiClient.getCurrentUserId(),
        marker: window.__qsMarker || null,
        toast: toast && toast.lastChild ? toast.lastChild.textContent.trim() : null,
    }
}, library)

// A value kept on window until the page reloads.
async function mark(page) {
    const marker = String(Date.now())
    await page.evaluate((value) => { window.__qsMarker = value }, marker)
    return marker
}

async function open(page) {
    await page.evaluate(() => window.QuickSwitch && typeof window.QuickSwitch.open === 'function' && window.QuickSwitch.open())
    return (await waitFor(() => overlay(page), (o) => o.shown, 3000)).value
}

async function closeSwitcher(page) {
    await page.keyboard.press('Escape')
    return waitFor(() => overlay(page), (o) => !o.shown, 2000)
}

module.exports = { launch, waitFor, newPage, signIn, savedIds, waitSaved, withTwoAccounts, close, overlay, pageState, mark, open, closeSwitcher }
