const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const repoRoot = path.resolve(__dirname, '../..')

test('shared package exports quantify runtime subpaths', () => {
  assert.doesNotThrow(() => {
    require.resolve('@ai/shared/constants/error-codes', {
      paths: [path.join(repoRoot, 'apps/quantify')],
    })
  })
})

test('quantify package start script points at built entry file', () => {
  const pkg = JSON.parse(
    fs.readFileSync(path.join(repoRoot, 'apps/quantify/package.json'), 'utf8'),
  )
  assert.equal(
    pkg.scripts.start,
    'TS_NODE_BASEURL=./dist node -r tsconfig-paths/register dist/apps/quantify/src/main.js',
  )
})

test('backend package start script points at built entry file', () => {
  const pkg = JSON.parse(
    fs.readFileSync(path.join(repoRoot, 'apps/backend/package.json'), 'utf8'),
  )
  assert.equal(
    pkg.scripts.start,
    'TS_NODE_BASEURL=./dist node -r tsconfig-paths/register dist/apps/backend/src/main.js',
  )
})

test('quantify runtime locates workspace root dynamically', () => {
  const mainSource = fs.readFileSync(
    path.join(repoRoot, 'apps/quantify/src/main.ts'),
    'utf8',
  )

  assert.match(mainSource, /pnpm-workspace\.yaml/)
})

test('backend runtime locates workspace root dynamically', () => {
  const mainSource = fs.readFileSync(
    path.join(repoRoot, 'apps/backend/src/main.ts'),
    'utf8',
  )

  assert.match(mainSource, /pnpm-workspace\.yaml/)
})

test('quantify declares runtime deps needed by bundled workspace config code', () => {
  const pkg = JSON.parse(
    fs.readFileSync(path.join(repoRoot, 'apps/quantify/package.json'), 'utf8'),
  )

  assert.equal(pkg.dependencies.zod, '^3.24.2')
})

test('quantify pm2 ecosystem runs API and backtest worker as separate processes', () => {
  const ecosystem = require(path.join(repoRoot, 'dx/deploy/ecosystem.quantify.config.cjs'))
  const commands = JSON.parse(
    fs.readFileSync(path.join(repoRoot, 'dx/config/commands.json'), 'utf8'),
  )

  assert.deepEqual(
    ecosystem.apps.map(app => app.name),
    ['quantify-api', 'quantify-backtest-worker'],
  )
  assert.equal(
    commands.deploy.quantify.backendDeploy.startup.serviceName,
    'quantify-api',
  )

  const api = ecosystem.apps.find(app => app.name === 'quantify-api')
  const worker = ecosystem.apps.find(app => app.name === 'quantify-backtest-worker')

  assert.equal(api.args, 'apps/quantify/src/main.js')
  assert.equal(worker.args, 'apps/quantify/src/worker.backtest.js')
  assert.equal(api.cwd, path.join(repoRoot, 'dx/deploy'))
  assert.equal(worker.cwd, path.join(repoRoot, 'dx/deploy'))
  assert.equal(api.env.PORT, 3010)
  assert.equal(worker.env.PORT, undefined)
})

test('quantify ci deploy starts backtest worker after dx api deploy', () => {
  const workflow = fs.readFileSync(path.join(repoRoot, '.github/workflows/ci.yml'), 'utf8')

  assert.match(workflow, /npx -y @ranger1\/dx@\$\{\{ env\.DX_VERSION \}\} --config-dir \.\/\.tmp\/dx-config deploy quantify/)
  assert.match(workflow, /pm2 delete quantify-backtest-worker/)
  assert.match(workflow, /pm2 startOrReload \.\/ecosystem\.quantify\.config\.cjs --only quantify-backtest-worker --update-env/)
  assert.match(workflow, /quantify-backtest-worker pm2 process missing/)
  assert.match(workflow, /quantify-backtest-worker status mismatch/)
  assert.match(workflow, /quantify-backtest-worker pid mismatch/)
  assert.match(workflow, /quantify-backtest-worker pid not alive/)
  assert.match(workflow, /quantify-backtest-worker cwd mismatch/)
  assert.match(workflow, /readyDeadline = Date\.now\(\) \+ 60_000/)
  assert.match(workflow, /Quantify backtest worker ready/)
  assert.match(workflow, /quantify-backtest-worker ready log missing/)
})
