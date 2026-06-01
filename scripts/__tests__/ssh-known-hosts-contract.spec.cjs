const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const repoRoot = path.resolve(__dirname, '../..')

test('ci backend and quantify deploys preheat ssh known_hosts through retry script', () => {
  const workflow = fs.readFileSync(path.join(repoRoot, '.github/workflows/ci.yml'), 'utf8')

  assert.ok(
    fs.existsSync(path.join(repoRoot, 'scripts/ci/preheat-ssh-known-hosts.sh')),
    'missing retryable ssh known_hosts preheat script',
  )
  assert.equal(
    workflow.match(/bash scripts\/ci\/preheat-ssh-known-hosts\.sh/g)?.length,
    2,
    'backend and quantify deploy jobs must both use the retryable preheat script',
  )
  assert.doesNotMatch(workflow, /ssh-keyscan -p "\$\{AWS_SSH_PORT\}" -H "\$\{AWS_SSH_HOST\}"/)
})
