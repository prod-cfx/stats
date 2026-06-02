import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { describe, it } from 'node:test'

const [commands, rootPackage] = await Promise.all([
  readJson(new URL('./commands.json', import.meta.url)),
  readJson(new URL('../../package.json', import.meta.url)),
])
const localEcosystem = await import('../../ecosystem.config.cjs')

const EXPECTED_UNIT_ALL_TARGETS = [
  'backend',
  'quantify',
  'front',
  'admin',
  'shared',
  'config',
  'scripts',
]

async function readJson(url) {
  return JSON.parse(await readFile(url, 'utf8'))
}

function extractDxTestUnitTargets(command) {
  return [...command.matchAll(/\bdx test unit ([a-z-]+)/g)].map(match => match[1])
}

describe('dx command config', () => {
  it('routes root quality scripts through dx', () => {
    assert.equal(rootPackage.scripts.dev, 'dx start all')
    assert.equal(rootPackage.scripts.lint, 'dx lint')
    assert.equal(rootPackage.scripts.test, 'dx test unit all')
    assert.equal(rootPackage.scripts.build, 'dx build all --prod')

    for (const target of ['front', 'admin', 'backend', 'quantify', 'shared', 'config']) {
      assert.equal(rootPackage.scripts[`test:unit:${target}`], `dx test unit ${target}`)
    }

    assert.equal(rootPackage.scripts['test:e2e:backend'], 'dx test e2e backend')
    assert.equal(rootPackage.scripts['test:e2e:quantify'], 'dx test e2e quantify')
  })

  it('defines unit-test targets behind dx', () => {
    for (const target of [
      'all',
      'front',
      'admin',
      'backend',
      'quantify',
      'shared',
      'scripts',
      'config',
    ]) {
      assert.ok(commands.test.unit[target], `missing dx test unit ${target}`)
    }

    assert.match(commands.test.unit.shared.command, /nx test shared/)
    assert.match(commands.test.unit.scripts.command, /test:scripts:contracts/)
    assert.match(commands.test.unit.config.command, /commands\.test\.mjs/)

    const unitAllCommand = commands.test.unit.all.command
    assert.deepEqual(extractDxTestUnitTargets(unitAllCommand), EXPECTED_UNIT_ALL_TARGETS)
    assert.doesNotMatch(unitAllCommand, /\bdx test e2e\b/)
  })

  it('blocks pathless e2e runs and preserves file-path forwarding', () => {
    assert.equal(commands.test.e2e.backend.requiresPath, true)
    assert.match(commands.test.e2e.backend.command, /E2E 必须指定文件或目录/)
    assert.doesNotMatch(commands.test.e2e.backend.command, /nx test:e2e backend/)
    assert.match(commands.test.e2e.backend.fileCommand, /\{TEST_PATH\}/)
    assert.match(
      commands.test.e2e.backend.fileCommand,
      /pnpm --dir apps\/backend run test:e2e:file/,
    )
    assert.match(commands.test.e2e.backend.fileCommand, /test:e2e:file/)

    assert.equal(commands.test.e2e.quantify.requiresPath, true)
    assert.match(commands.test.e2e.quantify.command, /E2E 必须指定文件或目录/)
    assert.match(commands.test.e2e.quantify.fileCommand, /\{TEST_PATH\}/)
    assert.match(commands.test.e2e.quantify.fileCommand, /quantify-launcher/)
    assert.match(
      commands.test.e2e.quantify.fileCommand,
      /pnpm --dir apps\/quantify run test:e2e:file/,
    )
    assert.match(commands.test.e2e.quantify.fileCommand, /test:e2e:file/)

    assert.match(commands.test.e2e.all.command, /E2E 必须指定 target 和文件\/目录/)
    assert.equal(commands.test.e2e.all.skipEnvValidation, true)
    assert.doesNotMatch(commands.test.e2e.all.command, /\bnx test:e2e\b/)
  })

  it('compound bash wrappers that sequence multiple commands carry set -euo pipefail', () => {
    // These commands chain multiple pnpm/nx calls and must not silently swallow
    // failures from intermediate steps. If pipefail is ever dropped, a failed
    // first command (e.g. tsc error) would not propagate an exit-code.
    const knownPipefailEntries = [
      { path: 'db.generate.command', cmd: commands.db.generate.command },
      { path: 'db.generate.quantify.command', cmd: commands.db.generate?.quantify?.command },
      { path: 'test.unit.all.command', cmd: commands.test.unit.all.command },
    ]
    for (const { path, cmd } of knownPipefailEntries) {
      assert.ok(
        typeof cmd === 'string',
        `Expected string at commands.${path}, got ${typeof cmd} — commands.json structure may have changed`,
      )
      assert.ok(
        cmd.includes('set -euo pipefail'),
        `Command at commands.${path} is missing 'set -euo pipefail' and may silently swallow errors:\n  ${cmd}`,
      )
    }
  })

  it('quantify unit test routes through quantify-launcher for env passthrough', () => {
    assert.match(
      commands.test.unit.quantify.command,
      /quantify-launcher/,
      'dx test unit quantify must route through quantify-launcher.cjs so env mapping is applied',
    )
    assert.match(commands.test.unit.quantify.command, /npx nx test quantify/)
  })

  it('starts the backtest worker with the local pm2 stack', () => {
    assert.ok(
      commands.start.stack.stack.services.includes('quantify-backtest-worker'),
      'dx start stack must include the backtest worker so queued backtest jobs are consumed locally',
    )

    const appNames = localEcosystem.default.apps.map(app => app.name)
    assert.ok(appNames.includes('quantify'), 'local PM2 ecosystem must include quantify API')
    assert.ok(
      appNames.includes('quantify-backtest-worker'),
      'local PM2 ecosystem must include quantify-backtest-worker',
    )
  })

  it('documents dx test usage in help output config', () => {
    assert.equal(commands.help.commands.test.summary.includes('运行测试'), true)
    assert.equal(commands.help.commands.test.summary.includes('unit 允许 all'), true)
    assert.equal(commands.help.commands.test.summary.includes('E2E 禁止全量聚合'), true)
    assert.ok(
      commands.help.commands.test.notes.some(note =>
        note.includes('unit 测试可以执行 dx test unit all'),
      ),
    )
    assert.ok(
      commands.help.commands.test.notes.some(note => note.includes('E2E 测试不允许 all 全量跑')),
    )
    assert.ok(
      commands.help.commands.test.examples.some(example =>
        example.command.startsWith('dx test unit'),
      ),
    )
    assert.ok(
      commands.help.commands.test.examples.some(example =>
        example.command.startsWith('dx test e2e'),
      ),
    )
  })
})
