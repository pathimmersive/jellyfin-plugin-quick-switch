// Coverage of the switcher script from the browser tests. With QS_COVERAGE set
// to a folder, every test page records Chromium's JavaScript coverage and
// writes the switcher's entry there when it closes; run this file with that
// folder to print the combined line and function coverage. It reports only.
//
// Usage: node tests/browser/coverage.js <folder>
const { mkdirSync, readdirSync, readFileSync, writeFileSync } = require('node:fs')
const { join } = require('node:path')

const SCRIPT = /\/QuickSwitch\/quick-switch\.js(\?|$)/

async function start(page) {
    if (!process.env.QS_COVERAGE) { return }
    await page.coverage.startJSCoverage({ resetOnNavigation: false })
}

async function save(page) {
    if (!process.env.QS_COVERAGE) { return }
    const entries = (await page.coverage.stopJSCoverage().catch(() => [])).filter((e) => SCRIPT.test(e.url))
    if (!entries.length) { return }
    mkdirSync(process.env.QS_COVERAGE, { recursive: true })
    writeFileSync(join(process.env.QS_COVERAGE, `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.json`), JSON.stringify(entries))
}

// V8 block coverage: the innermost range that holds an offset says whether it ran.
function ranOffsets(source, functions) {
    const ran = new Uint8Array(source.length)
    const ranges = functions.flatMap((f) => f.ranges).sort((a, b) => (a.startOffset - b.startOffset) || (b.endOffset - a.endOffset))
    for (const r of ranges) { ran.fill(r.count > 0 ? 1 : 0, r.startOffset, r.endOffset) }
    return ran
}

function summarize(folder) {
    let source = null
    let ran = null
    const functions = new Map()
    for (const file of readdirSync(folder)) {
        for (const entry of JSON.parse(readFileSync(join(folder, file), 'utf8'))) {
            if (source === null) { source = entry.source; ran = new Uint8Array(source.length) }
            if (entry.source !== source) { continue }
            const here = ranOffsets(source, entry.functions)
            for (let i = 0; i < here.length; i++) { ran[i] |= here[i] }
            for (const f of entry.functions) {
                const at = f.ranges[0].startOffset
                if (at === 0 && f.ranges[0].endOffset === source.length) { continue }
                functions.set(at, (functions.get(at) || false) || f.ranges[0].count > 0)
            }
        }
    }
    if (source === null) { throw new Error(`no switcher coverage in ${folder}`) }
    let lines = 0
    let covered = 0
    let offset = 0
    for (const line of source.split('\n')) {
        const code = line.trim()
        if (code && !code.startsWith('//') && !code.startsWith('*') && !code.startsWith('/*')) {
            lines++
            if (ran[offset + line.indexOf(code[0])]) { covered++ }
        }
        offset += line.length + 1
    }
    const percent = (n, d) => `${(100 * n / d).toFixed(1)}%`
    const ranFunctions = [...functions.values()].filter(Boolean).length
    return { lines: percent(covered, lines), functions: percent(ranFunctions, functions.size) }
}

if (require.main === module) {
    const result = summarize(process.argv[2])
    console.log(`  switcher (browser) lines ${result.lines}, functions ${result.functions}`)
}

module.exports = { start, save, summarize }
