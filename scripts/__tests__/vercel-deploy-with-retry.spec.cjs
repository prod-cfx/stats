const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
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

test('front staging deploy builds staging config then publishes to fixed domain alias', () => {
  const output = runDryRun(['front', '--staging'])

  assert.match(output, /vercel pull --yes --environment preview --token test-token/)
  assert.match(output, /vercel build --token test-token --prod --local-config vercel\.front\.json/)
  assert.match(output, /vercel deploy --prebuilt --yes --token test-token --prod --local-config vercel\.front\.json/)
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

test('retries Vercel file upload invalid-json Internal Server Error failures', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vercel-retry-'))
  const attemptFile = path.join(tempDir, 'attempts')

  const result = spawnSync('bash', [scriptPath, 'admin', '--staging'], {
    cwd: repoRoot,
    env: {
      ...process.env,
      DX_VERSION: '0.1.97',
      VERCEL_TOKEN: 'test-token',
      VERCEL_ORG_ID: 'test-org',
      VERCEL_PROJECT_ID: 'test-project',
      VERCEL_DEPLOY_MAX_ATTEMPTS: '2',
      VERCEL_DEPLOY_RETRY_BACKOFF_SECONDS: '0',
      ATTEMPT_FILE: attemptFile,
      VERCEL_DEPLOY_TEST_COMMAND: [
        'count=$(($(cat "$ATTEMPT_FILE" 2>/dev/null || echo 0) + 1))',
        'printf "%s" "$count" > "$ATTEMPT_FILE"',
        'if [ "$count" -eq 1 ]; then echo "retryable fixture" >/dev/null',
        `echo "Error: FetchError: invalid json response body at https://api.vercel.com/v2/files?teamId=team_lIoyIkNTVAyJtNQC0YU8qFGW reason: Unexpected token 'I', \\\"Internal S\\\"... is not valid JSON"`,
        'echo "Error: AbortError: The user aborted a request."',
        'exit 1',
        'fi',
      ].join('; '),
    },
    encoding: 'utf8',
  })

  assert.equal(result.status, 0)
  assert.match(result.stdout, /attempt=1\/2/)
  assert.match(result.stdout, /attempt=2\/2/)
  assert.match(result.stdout, /hit a retryable Vercel platform error/)
})
