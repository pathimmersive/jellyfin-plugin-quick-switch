// What the switcher keeps when someone signs in: Remember me, the question
// before an administrator is saved, an account made an administrator after it
// was saved, and removing an account at an address it never signed in
// through. In Chromium against a throwaway Jellyfin running the plugin built
// from this tree. Needs Docker, the .NET 10 SDK and a Chromium-based browser;
// see CONTRIBUTING.md.
const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const { startServer, api, signInByApi, tokenStatus, signOutToken } = require('./server')
const { launch, waitFor, newPage, signIn, savedIds, waitSaved, withTwoAccounts, close, open } = require('./page')

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

// The question asked before an administrator is saved, if it is showing.
const question = (page) => page.evaluate(() => {
    const dialog = document.querySelector('#quickswitch .qs-confirm')
    const skip = document.querySelector('#quickswitch [data-qs-action="admin-skip"]')
    if (!dialog || !skip) { return null }
    return {
        heading: (dialog.querySelector('h2') || {}).textContent,
        focused: document.activeElement ? document.activeElement.getAttribute('data-qs-action') : null,
    }
})

const savedToken = (page, id) => page.evaluate((userId) => {
    const store = JSON.parse(window.localStorage.getItem('quickswitch') || '{}')
    const accounts = (store.servers || {})[window.ApiClient.serverId()] || []
    const account = accounts.filter((a) => a.UserId === userId)[0]
    return account ? account.AccessToken : null
}, id)

// Clears jellyfin-web's sign-in on this device, keeping what the switcher saved, and reloads.
async function signedOutHere(page) {
    await page.evaluate(() => {
        const credentials = JSON.parse(window.localStorage.getItem('jellyfin_credentials'))
        credentials.Servers.forEach((s) => { delete s.AccessToken; delete s.UserId })
        window.localStorage.setItem('jellyfin_credentials', JSON.stringify(credentials))
    })
    await page.reload()
}

test('a sign-in with Remember me unticked is not saved, and a copy saved before is forgotten', async () => {
    const { alex, sam } = server.accounts
    const run = await newPage(browser, server, 'desktop')
    const { page } = run
    try {
        await signIn(page, sam)
        assert.ok(await waitSaved(page, sam), 'with Remember me ticked, sam is saved')

        await signedOutHere(page)
        await signIn(page, sam, { remember: false })
        const forgotten = await waitFor(() => savedIds(page), (ids) => !ids.includes(sam.id), 6000)
        assert.ok(forgotten.ok, `signing in again with Remember me unticked forgets sam here (saved: ${forgotten.value})`)

        await signedOutHere(page)
        await signIn(page, alex, { remember: false })
        await page.waitForTimeout(4000)
        assert.equal(await question(page), null, 'an administrator signing in with Remember me unticked is not asked about')
        assert.ok(!(await savedIds(page)).includes(alex.id), 'and is not saved')
    } finally {
        await close(server, run)
    }
})

test('the question before an administrator is saved starts on Don’t save, so OK alone saves nothing', async () => {
    const { alex } = server.accounts
    const run = await newPage(browser, server, 'tv')
    const { page } = run
    try {
        await signIn(page, alex)
        const asked = await waitFor(() => question(page), (q) => !!q, 10000)
        assert.ok(asked.ok, 'signing in as alex asks before saving it')
        assert.equal(asked.value.focused, 'admin-skip', 'Don’t save has focus')

        await page.keyboard.press('Enter')
        await waitFor(() => question(page), (q) => !q, 3000)
        await page.waitForTimeout(1500)
        assert.ok(!(await savedIds(page)).includes(alex.id), 'OK alone does not save alex')
    } finally {
        await close(server, run)
    }
})

test('a saved account made an administrator since is asked about when it is switched to, and Don’t save forgets it', async () => {
    const { alex, sam } = server.accounts
    const admin = (await signInByApi(server, alex)).AccessToken
    const policy = (await api(server, `/Users/${sam.id}`, { token: admin })).data.Policy
    const run = await withTwoAccounts(browser, server, 'desktop')
    const { page } = run
    try {
        await api(server, `/Users/${sam.id}/Policy`, { method: 'POST', token: admin, body: { ...policy, IsAdministrator: true } })

        await open(page)
        await page.locator(`#quickswitch [data-qs-user="${sam.id}"]`).click()
        const asked = await waitFor(() => question(page), (q) => !!q, 15000)
        assert.ok(asked.ok, 'switching to sam, now an administrator, asks before keeping it saved')
        assert.match(asked.value.heading, /^Save sam on /)
        assert.equal(asked.value.focused, 'admin-skip', 'Don’t save has focus')

        await page.locator('#quickswitch [data-qs-action="admin-skip"]').click()
        const gone = await waitFor(() => savedIds(page), (ids) => !ids.includes(sam.id), 5000)
        assert.ok(gone.ok, `Don’t save forgets sam on this device (saved: ${gone.value})`)
        assert.equal(await page.evaluate(() => window.ApiClient.getCurrentUserId()), sam.id, 'sam stays signed in')
    } finally {
        await api(server, `/Users/${sam.id}/Policy`, { method: 'POST', token: admin, body: { ...policy, IsAdministrator: false } })
        await signOutToken(server, admin)
        await close(server, run)
    }
})

test('removing an account at an address it never signed in through says its sign-in keeps working, and sends its token nowhere', async () => {
    const { alex, sam } = server.accounts
    const run = await withTwoAccounts(browser, server, 'desktop')
    const { page } = run
    const other = server.base.replace('//127.0.0.1', '//localhost')
    const samToken = await savedToken(page, sam.id)
    const leaks = []
    try {
        const carried = await page.evaluate(() => window.localStorage.getItem('quickswitch'))
        page.on('request', (request) => {
            const auth = request.headers().authorization || ''
            if (request.url().startsWith(other) && auth.indexOf(samToken) !== -1) { leaks.push(`${request.method()} ${request.url()}`) }
        })
        await page.goto(`${other}/web/`)
        await page.evaluate((raw) => window.localStorage.setItem('quickswitch', raw), carried)
        await page.reload()
        await signIn(page, alex)
        assert.ok(await waitSaved(page, alex), 'alex signing in at the second address is saved there')

        await open(page)
        await page.locator('#quickswitch [data-qs-action="manage"]').click()
        await page.locator(`#quickswitch [data-qs-user="${sam.id}"]`).hover()
        await page.waitForTimeout(250)
        await page.locator(`#quickswitch [data-qs-bin="${sam.id}"]`).click()
        const confirm = await waitFor(() => page.evaluate(() => {
            const dialog = document.querySelector('#quickswitch .qs-confirm')
            const remove = document.querySelector('#quickswitch [data-qs-action="confirm-remove"]')
            return dialog && remove ? { text: dialog.textContent, remove: remove.textContent.trim(), focused: document.activeElement.getAttribute('data-qs-action') } : null
        }), (c) => !!c, 3000)
        assert.ok(confirm.ok, 'Remove asks first')
        assert.match(confirm.value.text, /sign-in keeps working on the server/)
        assert.match(confirm.value.text, /Dashboard → Devices/)
        assert.equal(confirm.value.remove, 'Remove from this device')
        assert.equal(confirm.value.focused, 'confirm-keep', 'Keep has focus')

        await page.locator('#quickswitch [data-qs-action="confirm-remove"]').click()
        const gone = await waitFor(() => savedIds(page), (ids) => !ids.includes(sam.id), 5000)
        assert.ok(gone.ok, 'Remove from this device forgets sam here')
        assert.deepEqual(leaks, [], 'sam’s token is sent nowhere at the second address')
        assert.equal(await tokenStatus(server, samToken), 200, 'sam’s sign-in still works on the server')
    } finally {
        await signOutToken(server, samToken)
        await close(server, run)
    }
})
