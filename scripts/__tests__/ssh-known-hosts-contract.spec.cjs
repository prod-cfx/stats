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

test('known_hosts preheat accepts pinned host keys and falls back to IPv4 keyscan', () => {
  const workflow = fs.readFileSync(path.join(repoRoot, '.github/workflows/ci.yml'), 'utf8')
  const script = fs.readFileSync(path.join(repoRoot, 'scripts/ci/preheat-ssh-known-hosts.sh'), 'utf8')

  assert.equal(
    workflow.match(/AWS_SSH_KNOWN_HOSTS: \$\{\{ secrets\.AWS_SSH_KNOWN_HOSTS \}\}/g)?.length,
    2,
    'backend and quantify deploy jobs must pass pinned SSH known_hosts when configured',
  )
  assert.match(script, /known_hosts_value="\$\{AWS_SSH_KNOWN_HOSTS:-\$\{SSH_KNOWN_HOSTS:-\}\}"/)
  assert.match(script, /ssh-keyscan -4 -T 10 -p "\$port" -H "\$host"/)
})
