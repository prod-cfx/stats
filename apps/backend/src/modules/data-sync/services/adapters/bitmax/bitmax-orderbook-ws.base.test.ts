import assert from 'node:assert/strict'
import test from 'node:test'
import { isBitmaxConnectionActivityMessage } from './bitmax-orderbook-ws.base'

test('treats Bitmax depth updates as connection activity', () => {
  assert.equal(isBitmaxConnectionActivityMessage({ m: 'depth' }), true)
  assert.equal(isBitmaxConnectionActivityMessage({ m: 'depth-snapshot' }), true)
})

test('treats control frames as connection activity', () => {
  assert.equal(isBitmaxConnectionActivityMessage({ m: 'connected' }), true)
  assert.equal(isBitmaxConnectionActivityMessage({ m: 'ping' }), true)
  assert.equal(isBitmaxConnectionActivityMessage({ m: 'pong' }), true)
  assert.equal(isBitmaxConnectionActivityMessage({ m: 'sub' }), true)
  assert.equal(isBitmaxConnectionActivityMessage({ m: 'unsub' }), true)
  assert.equal(isBitmaxConnectionActivityMessage({ m: 'error' }), true)
})

test('ignores invalid frames', () => {
  assert.equal(isBitmaxConnectionActivityMessage(null), false)
  assert.equal(isBitmaxConnectionActivityMessage(undefined), false)
  assert.equal(isBitmaxConnectionActivityMessage({ m: '' as never }), true)
})
