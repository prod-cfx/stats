import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { describe, it } from 'node:test'

const [commands, rootPackage] = await Promise.all([
  readJson(new URL('./commands.json', import.meta.url)),
  readJson(new URL('../../package.json', import.meta.url)),
])

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
