import { ExternalSignalWebhookSignatureService } from '../services/external-signal-webhook-signature.service'

describe('ExternalSignalWebhookSignatureService', () => {
  const service = new ExternalSignalWebhookSignatureService()
  const secret = 'test-secret'
  const rawBody = Buffer.from('{"signalId":"sig-1","side":"long"}', 'utf8')
  const nowMs = Date.parse('2026-05-12T12:00:00.000Z')
  const timestamp = String(nowMs)

  it('verifies sha256 hmac over timestamp and raw body', () => {
    const signature = service.sign(secret, timestamp, rawBody)

    expect(service.verify({ secret, timestamp, signature, rawBody, nowMs })).toEqual({ ok: true })
    expect(service.verify({ secret, timestamp, signature: `sha256=${signature}`, rawBody, nowMs })).toEqual({ ok: true })
  })

  it('rejects missing or mismatched signatures', () => {
    expect(service.verify({ secret, timestamp, signature: undefined, rawBody, nowMs })).toEqual({
      ok: false,
      reason: 'missing_signature',
    })
    expect(service.verify({ secret, timestamp, signature: '0'.repeat(64), rawBody, nowMs })).toEqual({
      ok: false,
      reason: 'invalid_signature',
    })
    expect(service.verify({ secret, timestamp, signature: 'sha256=not-hex', rawBody, nowMs })).toEqual({
      ok: false,
      reason: 'invalid_signature',
    })
  })

  it('rejects replay timestamps outside the five minute window', () => {
    const oldTimestamp = String(nowMs - ExternalSignalWebhookSignatureService.REPLAY_WINDOW_MS - 1)
    const signature = service.sign(secret, oldTimestamp, rawBody)

    expect(service.verify({ secret, timestamp: oldTimestamp, signature, rawBody, nowMs })).toEqual({
      ok: false,
      reason: 'timestamp_out_of_window',
    })
  })
})
