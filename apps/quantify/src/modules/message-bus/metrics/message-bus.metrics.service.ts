import { Injectable, Logger, OnModuleInit } from '@nestjs/common'

export interface MessageBusMetricsSnapshot {
  outbox: {
    claimed: number
    sent: number
    retry: number
    dead: number
    dispatchLatencyAvgMs: number
    dispatchCount: number
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

  reset() {
    this.outboxClaimed = 0
    this.outboxSent = 0
    this.outboxRetry = 0
    this.outboxDead = 0
    this.outboxDispatchCount = 0
    this.outboxDispatchLatencySumMs = 0
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
      timestamp: new Date().toISOString(),
    }
  }
}
