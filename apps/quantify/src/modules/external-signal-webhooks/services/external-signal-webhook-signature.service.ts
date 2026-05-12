import { createHmac, timingSafeEqual } from 'node:crypto'
import { Injectable } from '@nestjs/common'

export interface VerifyExternalSignalSignatureInput {
  secret: string
  timestamp: string | undefined
  signature: string | undefined
  rawBody: Buffer
  nowMs?: number
}

export interface VerifyExternalSignalSignatureResult {
  ok: boolean
  reason?: 'missing_timestamp' | 'invalid_timestamp' | 'timestamp_out_of_window' | 'missing_signature' | 'invalid_signature'
}

@Injectable()
export class ExternalSignalWebhookSignatureService {
  static readonly REPLAY_WINDOW_MS = 5 * 60 * 1000

  verify(input: VerifyExternalSignalSignatureInput): VerifyExternalSignalSignatureResult {
    const timestamp = input.timestamp?.trim()
    if (!timestamp) {
      return { ok: false, reason: 'missing_timestamp' }
    }

    const timestampMs = this.parseTimestampMs(timestamp)
    if (timestampMs === null) {
      return { ok: false, reason: 'invalid_timestamp' }
    }

    const nowMs = input.nowMs ?? Date.now()
    if (Math.abs(nowMs - timestampMs) > ExternalSignalWebhookSignatureService.REPLAY_WINDOW_MS) {
      return { ok: false, reason: 'timestamp_out_of_window' }
    }

    const signature = this.normalizeSignature(input.signature)
    if (!signature) {
      return { ok: false, reason: 'missing_signature' }
    }

    const expected = createHmac('sha256', input.secret)
      .update(`${timestamp}.`)
      .update(input.rawBody)
      .digest('hex')

    if (!this.timingSafeHexEqual(signature, expected)) {
      return { ok: false, reason: 'invalid_signature' }
    }

    return { ok: true }
  }

  sign(secret: string, timestamp: string, rawBody: Buffer): string {
    return createHmac('sha256', secret)
      .update(`${timestamp}.`)
      .update(rawBody)
      .digest('hex')
  }

  private normalizeSignature(signature: string | undefined): string | null {
    const value = signature?.trim()
    if (!value) {
      return null
    }
    const normalized = value.startsWith('sha256=') ? value.slice('sha256='.length) : value
    return /^[0-9a-f]{64}$/i.test(normalized) ? normalized.toLowerCase() : null
  }

  private parseTimestampMs(timestamp: string): number | null {
    if (/^\d+$/.test(timestamp)) {
      const numeric = Number(timestamp)
      if (!Number.isSafeInteger(numeric)) {
        return null
      }
      return timestamp.length <= 10 ? numeric * 1000 : numeric
    }

    const parsed = Date.parse(timestamp)
    return Number.isNaN(parsed) ? null : parsed
  }

  private timingSafeHexEqual(actualHex: string, expectedHex: string): boolean {
    const actual = Buffer.from(actualHex, 'hex')
    const expected = Buffer.from(expectedHex, 'hex')
    if (actual.length !== expected.length) {
      return false
    }
    return timingSafeEqual(actual, expected)
  }
}
