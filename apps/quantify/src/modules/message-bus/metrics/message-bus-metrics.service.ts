import type { OnModuleInit } from '@nestjs/common'
import { Injectable, Logger } from '@nestjs/common'

export interface MessageBusMetricsSnapshot {
  outbox: {
    claimed: number
    sent: number
    retry: number
    dead: number
    dispatchLatencyAvgMs: number
    dispatchCount: number
  }
  okx: {
    rateLimitTotal: Record<string, number>
    tokenBucketQueueDepth: Record<string, number>
  }
  timestamp: string
}

@Injectable()
export class MessageBusMetricsService implements OnModuleInit {
  private readonly logger = new Logger(MessageBusMetricsService.name)

  private outboxClaimed = 0
  private outboxSent = 0
  private outboxRetry = 0
  private outboxDead = 0
  private outboxDispatchCount = 0
  private outboxDispatchLatencySumMs = 0
  private okxRateLimitTotal: Record<string, number> = {}
  private okxTokenBucketQueueDepth: Record<string, number> = {}

  onModuleInit() {
    this.logger.log('MessageBus metrics initialized')
  }

  // Outbox metrics
  incOutboxClaimed(n = 1) {
    this.outboxClaimed += n
  }
  incOutboxSent(n = 1) {
    this.outboxSent += n
  }
  incOutboxRetry(n = 1) {
    this.outboxRetry += n
  }
  incOutboxDead(n = 1) {
    this.outboxDead += n
  }
  recordOutboxDispatchLatency(ms: number) {
    if (ms >= 0 && Number.isFinite(ms)) {
      this.outboxDispatchCount += 1
      this.outboxDispatchLatencySumMs += ms
    }
  }

  // OKX metrics
  incOkxRateLimit(code: string) {
    this.okxRateLimitTotal[code] = (this.okxRateLimitTotal[code] ?? 0) + 1
  }

  setOkxTokenBucketQueueDepth(accountId: string, depth: number) {
    if (depth >= 0 && Number.isFinite(depth)) {
      this.okxTokenBucketQueueDepth[accountId] = depth
    }
  }

  reset() {
    this.outboxClaimed = 0
    this.outboxSent = 0
    this.outboxRetry = 0
    this.outboxDead = 0
    this.outboxDispatchCount = 0
    this.outboxDispatchLatencySumMs = 0
    this.okxRateLimitTotal = {}
    this.okxTokenBucketQueueDepth = {}
  }

  getSnapshot(): MessageBusMetricsSnapshot {
    const avg = this.outboxDispatchCount
      ? this.outboxDispatchLatencySumMs / this.outboxDispatchCount
      : 0
    return {
      outbox: {
        claimed: this.outboxClaimed,
        sent: this.outboxSent,
        retry: this.outboxRetry,
        dead: this.outboxDead,
        dispatchLatencyAvgMs: Math.round(avg),
        dispatchCount: this.outboxDispatchCount,
      },
      okx: {
        rateLimitTotal: { ...this.okxRateLimitTotal },
        tokenBucketQueueDepth: { ...this.okxTokenBucketQueueDepth },
      },
      timestamp: new Date().toISOString(),
    }
  }
}
