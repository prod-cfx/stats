const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const repoRoot = path.resolve(__dirname, '../..')

test('quantify PM2 ecosystem forwards APP_ENV to runtime', () => {
  const ecosystem = require(path.join(repoRoot, 'dx/deploy/ecosystem.quantify.config.cjs'))
  const quantifyApp = ecosystem.apps.find(app => app.name === 'quantify')

  assert.ok(quantifyApp, 'missing quantify pm2 app config')
  assert.ok(quantifyApp.env, 'missing quantify pm2 env block')
  assert.ok(
    Object.prototype.hasOwnProperty.call(quantifyApp.env, 'APP_ENV'),
    'quantify pm2 env must set APP_ENV explicitly',
  )
})

test('deploy-quantify workflow audits remote quantify env keys before declaring success', () => {
  const workflow = fs.readFileSync(path.join(repoRoot, '.github/workflows/ci.yml'), 'utf8')

  assert.match(workflow, /name:\s*校验 quantify 远端运行时环境/)
  assert.match(workflow, /missing required quantify env key:/)
})

test('deploy-quantify workflow performs remote quantify health check', () => {
  const workflow = fs.readFileSync(path.join(repoRoot, '.github/workflows/ci.yml'), 'utf8')

  assert.match(workflow, /name:\s*校验 quantify 健康检查/)
  assert.match(workflow, /curl -fsS --max-time 5 http:\/\/127\.0\.0\.1:3010\/api\/v1\/health/)
})
