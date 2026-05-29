const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const { execFileSync, spawnSync } = require('node:child_process')

const repoRoot = path.resolve(__dirname, '../..')
const scriptPath = path.join(repoRoot, 'scripts/ci/vercel-deploy-with-retry.sh')

function runDryRun(args) {
  return execFileSync('bash', [scriptPath, ...args], {
    cwd: repoRoot,
    env: {
      ...process.env,
      DX_VERSION: '0.1.97',
      VERCEL_TOKEN: 'test-token',
      VERCEL_DEPLOY_DRY_RUN: '1',
      VERCEL_DEPLOY_MAX_ATTEMPTS: '1',
    },
    encoding: 'utf8',
  })
}

test('front staging deploy builds on runner then deploys prebuilt output', () => {
  const output = runDryRun(['front', '--staging'])

  assert.match(output, /vercel pull --yes --environment preview --token test-token/)
  assert.match(output, /vercel build --token test-token --local-config vercel\.front\.json/)
  assert.match(output, /vercel deploy --prebuilt --yes --token test-token --local-config vercel\.front\.json/)
  assert.doesNotMatch(output, /deploy front --staging/)
})

test('admin production deploy builds prod output on runner then deploys prebuilt output', () => {
  const output = runDryRun(['admin', '--prod'])

  assert.match(output, /vercel pull --yes --environment production --token test-token/)
  assert.match(output, /vercel build --token test-token --prod --local-config vercel\.admin\.json/)
  assert.match(output, /vercel deploy --prebuilt --yes --token test-token --prod --local-config vercel\.admin\.json/)
  assert.doesNotMatch(output, /deploy admin --prod/)
})

test('script rejects missing Vercel token before invoking Vercel', () => {
  const env = { ...process.env }
  delete env.VERCEL_TOKEN
  const result = spawnSync('bash', [scriptPath, 'front', '--staging'], {
    cwd: repoRoot,
    env: {
      ...env,
      DX_VERSION: '0.1.97',
      VERCEL_DEPLOY_DRY_RUN: '1',
    },
    encoding: 'utf8',
  })

  assert.equal(result.status, 64)
  assert.match(result.stderr, /VERCEL_TOKEN is required/)
})

test('script rejects unsupported deploy target before invoking Vercel', () => {
  const result = spawnSync('bash', [scriptPath, 'unknown', '--staging'], {
    cwd: repoRoot,
    env: {
      ...process.env,
      DX_VERSION: '0.1.97',
      VERCEL_DEPLOY_DRY_RUN: '1',
    },
    encoding: 'utf8',
  })

  assert.equal(result.status, 64)
  assert.match(result.stderr, /unsupported Vercel deploy target: unknown/)
})

test('script rejects unsupported deploy environment flag before invoking Vercel', () => {
  const result = spawnSync('bash', [scriptPath, 'front', '--preview'], {
    cwd: repoRoot,
    env: {
      ...process.env,
      DX_VERSION: '0.1.97',
      VERCEL_DEPLOY_DRY_RUN: '1',
    },
    encoding: 'utf8',
  })

  assert.equal(result.status, 64)
  assert.match(result.stderr, /unsupported Vercel deploy flag: --preview/)
})
