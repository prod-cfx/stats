const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const repoRoot = path.resolve(__dirname, '../..')

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8')
}

test('acceptance common script defines required env keys', () => {
  const source = read('scripts/acceptance/quantify-acceptance-common.sh')

  assert.match(source, /ACCEPT_SYMBOL_BINANCE/)
  assert.match(source, /ACCEPT_SYMBOL_OKX/)
  assert.match(source, /ACCEPT_SYMBOL_HYPERLIQUID/)
  assert.match(source, /ACCEPT_STRATEGY_INSTANCE_ID/)
})

test('multi-exchange gate script checks three exchanges explicitly', () => {
  const source = read('scripts/acceptance/quantify-multi-exchange-gate-check.sh')

  assert.match(source, /binance/)
  assert.match(source, /okx/)
  assert.match(source, /hyperliquid/)
  assert.match(source, /api\/v1\/market\/quote/)
  assert.match(source, /api\/v1\/market\/bars/)
})

test('signal gate script uses ops generate-signal endpoint', () => {
  const source = read('scripts/acceptance/quantify-strategy-signal-gate-check.sh')

  assert.match(source, /ops\/strategy-instances\/.+\/generate-signal/)
  assert.match(source, /trading_signal/i)
  assert.match(source, /ACCEPT_STRATEGY_INSTANCE_ID/)
})

test('orchestrator runs all gates in order and writes acceptance-summary.json', () => {
  const source = read('scripts/acceptance/quantify-min-acceptance.sh')

  assert.match(source, /quantify-market-data-preflight\.sh/)
  assert.match(source, /quantify-market-data-runtime\.sh start/)
  assert.match(source, /quantify-multi-exchange-gate-check\.sh/)
  assert.match(source, /quantify-strategy-signal-gate-check\.sh/)
  assert.match(source, /acceptance-summary\.json/)
})
