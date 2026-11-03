// A throwaway Jellyfin for the browser tests: builds the plugin from this
// working tree, runs it in the Jellyfin image the smoke test pins, finishes the
// startup wizard and creates the accounts the tests sign in as. The container
// is always removed.
const { execFileSync } = require('node:child_process')
const { mkdtempSync, readFileSync, rmSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { join } = require('node:path')
const { randomBytes } = require('node:crypto')

const repo = join(__dirname, '..', '..')
const CLIENT = 'MediaBrowser Client="quickswitch-browser-tests", Device="browser-tests", DeviceId="quickswitch-browser-tests", Version="1.0.0"'
const LIBRARY = 'Videos'

// The same Jellyfin as the smoke test, so both test the same server.
function pinnedImage() {
    const smoke = readFileSync(join(repo, 'scripts', 'smoke-test.sh'), 'utf8')
    const match = smoke.match(/^IMAGE="\$\{JELLYFIN_IMAGE:-([^}]+)\}"/m)
    if (!match) { throw new Error('scripts/smoke-test.sh no longer pins a Jellyfin image') }
    return process.env.JELLYFIN_IMAGE || match[1]
}

function pluginVersion() {
    const project = readFileSync(join(repo, 'src', 'Jellyfin.Plugin.QuickSwitch', 'Jellyfin.Plugin.QuickSwitch.csproj'), 'utf8')
    return project.match(/<Version>([^<]+)<\/Version>/)[1]
}

const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function startServer() {
    const work = mkdtempSync(join(tmpdir(), 'quickswitch-browser-'))
    const pluginDir = join(work, `QuickSwitch_${pluginVersion()}`)
    execFileSync('dotnet', ['publish', join(repo, 'src', 'Jellyfin.Plugin.QuickSwitch', 'Jellyfin.Plugin.QuickSwitch.csproj'),
        '-c', 'Release', '-o', pluginDir, '--nologo', '-v', 'quiet'], { stdio: ['ignore', 'ignore', 'inherit'] })

    const name = `quickswitch-browser-${process.pid}-${randomBytes(3).toString('hex')}`
    const server = { name, work, base: null, accounts: {}, library: LIBRARY }
    server.stop = () => {
        try { docker('rm', '-f', name) } catch { /* already gone */ }
        rmSync(work, { recursive: true, force: true })
    }
    process.once('exit', server.stop)
    try {
        docker('run', '-d', '--name', name, '-p', '127.0.0.1::8096',
            '-v', `${pluginDir}:/config/plugins/QuickSwitch_${pluginVersion()}`, pinnedImage())
        const port = docker('port', name, '8096/tcp').split('\n')[0].split(':').pop()
        server.base = `http://127.0.0.1:${port}`
        await waitReady(server)
        await setUp(server)
    } catch (e) {
        try { console.error(docker('logs', '--tail', '40', name)) } catch { /* no log */ }
        server.stop()
        throw e
    }
    return server
}

// While starting, the server answers with an HTML holding page; wait for its JSON.
async function waitReady(server) {
    const until = Date.now() + 120000
    while (Date.now() < until) {
        const info = await fetch(`${server.base}/System/Info/Public`).then((r) => r.json()).catch(() => null)
        if (info && 'StartupWizardCompleted' in info) { return info }
        await sleep(1000)
    }
    throw new Error(`Jellyfin at ${server.base} did not become ready`)
}

// A request to the test server, as the test client; returns the status and body.
async function request(server, path, { method = 'GET', token, body } = {}) {
    const response = await fetch(server.base + path, {
        method,
        headers: { Authorization: token ? `${CLIENT}, Token="${token}"` : CLIENT, ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
    })
    const text = await response.text()
    let data = text
    try { data = JSON.parse(text) } catch { /* not JSON */ }
    return { status: response.status, data }
}

// The same, failing on any refused request.
async function api(server, path, options = {}) {
    const response = await request(server, path, options)
    if (response.status >= 400) { throw new Error(`${options.method || 'GET'} ${path}: HTTP ${response.status} ${String(typeof response.data === 'string' ? response.data : JSON.stringify(response.data)).slice(0, 200)}`) }
    return response
}

// alex administers the server and sees the Videos library; sam has no
// password and sees no library, so a switch shows on the home screen.
async function setUp(server) {
    const alex = { name: 'alex', password: randomBytes(9).toString('base64url'), admin: true, library: true }
    const sam = { name: 'sam', password: '', admin: false, library: false }
    await api(server, '/Startup/Configuration', { method: 'POST', body: { UICulture: 'en-US', MetadataCountryCode: 'US', PreferredMetadataLanguage: 'en' } })
    await api(server, '/Startup/User')
    await api(server, '/Startup/User', { method: 'POST', body: { Name: alex.name, Password: alex.password } })
    await api(server, '/Startup/RemoteAccess', { method: 'POST', body: { EnableRemoteAccess: true } })
    await api(server, '/Startup/Complete', { method: 'POST' })

    const token = (await signInByApi(server, alex)).AccessToken
    docker('exec', server.name, 'mkdir', '-p', '/media/videos')
    await api(server, `/Library/VirtualFolders?name=${LIBRARY}&collectionType=movies&paths=%2Fmedia%2Fvideos&refreshLibrary=false`,
        { method: 'POST', token, body: { LibraryOptions: {} } })

    const created = await api(server, '/Users/New', { method: 'POST', token, body: { Name: sam.name, Password: sam.password } })
    sam.id = created.data.Id
    const policy = (await api(server, `/Users/${sam.id}`, { token })).data.Policy
    await api(server, `/Users/${sam.id}/Policy`, { method: 'POST', token, body: { ...policy, EnableAllFolders: false, EnabledFolders: [] } })
    alex.id = (await api(server, '/Users/Me', { token })).data.Id
    await api(server, '/Sessions/Logout', { method: 'POST', token })
    server.accounts = { alex, sam }
}

async function signInByApi(server, account) {
    return (await api(server, '/Users/AuthenticateByName', { method: 'POST', body: { Username: account.name, Pw: account.password } })).data
}

// Status of a request with a token, without throwing on 401.
async function tokenStatus(server, token) {
    const response = await fetch(`${server.base}/Users/Me`, { headers: { Authorization: `${CLIENT}, Token="${token}"` } })
    return response.status
}

async function signOutToken(server, token) {
    await fetch(`${server.base}/Sessions/Logout`, { method: 'POST', headers: { Authorization: `${CLIENT}, Token="${token}"` } }).catch(() => {})
}

module.exports = { startServer, api, request, signInByApi, tokenStatus, signOutToken }
