import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isPublicDataTaskKey,
  shouldEnablePublicDataTaskByDefault,
} from './data-pull-task-policy'

test('recognizes managed public data task keys', () => {
  assert.equal(isPublicDataTaskKey('bbx-crypto-stock-quotes'), true)
  assert.equal(isPublicDataTaskKey('coinglass-hyperliquid-whale-position'), true)
  assert.equal(isPublicDataTaskKey('polymarket-markets-crypto'), false)
})

test('enables managed public data tasks by default in staging and production only', () => {
  assert.equal(
    shouldEnablePublicDataTaskByDefault('staging', 'bbx-crypto-stock-scraper'),
    true,
  )
  assert.equal(
    shouldEnablePublicDataTaskByDefault('production', 'coinglass-hyperliquid-whale-alert'),
    true,
  )
  assert.equal(
    shouldEnablePublicDataTaskByDefault('development', 'bbx-crypto-stock-quotes'),
    false,
  )
  assert.equal(
    shouldEnablePublicDataTaskByDefault(undefined, 'bbx-crypto-stock-quotes'),
    false,
  )
})
