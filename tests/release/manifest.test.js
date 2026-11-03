// The release tool's manifest from GitHub Releases, against a local stand-in for
// the GitHub API: only published releases reach the plugin repository. Needs
// the .NET 10 SDK.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createServer } = require('node:http')
const { execFile } = require('node:child_process')
const { mkdtempSync, readFileSync, writeFileSync, rmSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { join } = require('node:path')
const { URL } = require('node:url')

const repo = join(__dirname, '..', '..')

// A GitHub with one published release, one pre-release and one draft, each
// carrying its manifest entry.
function fakeGitHub() {
    const releases = [
        { tag: 'v1.0.0.0', version: '1.0.0.0', draft: false, prerelease: false },
        { tag: 'v1.1.0.0', version: '1.1.0.0', draft: false, prerelease: true },
        { tag: 'v1.2.0.0', version: '1.2.0.0', draft: true, prerelease: false },
    ]
    const server = createServer((request, response) => {
        const url = new URL(request.url, 'http://localhost')
        const base = `http://127.0.0.1:${server.address().port}`
        let body = null
        if (url.pathname === '/repos/example/quick-switch/releases') {
            body = url.searchParams.get('page') === '1' ? releases.map((r) => ({
                tag_name: r.tag,
                draft: r.draft,
                prerelease: r.prerelease,
                assets: [{ name: `quick-switch_${r.version}.json`, browser_download_url: `${base}/assets/${r.version}.json` }],
            })) : []
        } else if (url.pathname.startsWith('/assets/')) {
            const version = url.pathname.slice('/assets/'.length, -'.json'.length)
            body = { version, targetAbi: '12.0.0.0', sourceUrl: `${base}/quick-switch_${version}.zip`, checksum: '0'.repeat(32), timestamp: '2026-11-01T00:00:00Z', changelog: '' }
        }
        response.writeHead(body ? 200 : 404, { 'Content-Type': 'application/json' })
        response.end(body ? JSON.stringify(body) : '')
    })
    return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)))
}

function run(args, env) {
    return new Promise((resolve, reject) => {
        execFile('dotnet', ['run', join(repo, 'scripts', 'release-tool.cs'), '--', ...args], { cwd: repo, env: { ...process.env, ...env } },
            (error, stdout, stderr) => (error ? reject(new Error(`${error.message}\n${stderr}`)) : resolve(stdout)))
    })
}

test('the manifest lists published releases only, never a draft or a GitHub pre-release', async () => {
    const github = await fakeGitHub()
    const work = mkdtempSync(join(tmpdir(), 'quickswitch-manifest-'))
    try {
        const meta = join(work, 'meta.json')
        writeFileSync(meta, JSON.stringify({ guid: 'b4f7a8de-0000-0000-0000-000000000000', name: 'Quick Switch', description: 'd', overview: 'o', owner: 'example', category: 'General' }))
        const out = join(work, 'manifest.json')

        await run(['manifest', '--meta', meta, '--out', out, '--github'], {
            GITHUB_API_URL: `http://127.0.0.1:${github.address().port}`,
            GITHUB_REPOSITORY: 'example/quick-switch',
            GITHUB_TOKEN: '',
        })

        const manifest = JSON.parse(readFileSync(out, 'utf8'))
        assert.deepEqual(manifest[0].versions.map((v) => v.version), ['1.0.0.0'])
    } finally {
        github.close()
        rmSync(work, { recursive: true, force: true })
    }
})
