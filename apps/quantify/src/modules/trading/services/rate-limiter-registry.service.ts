import { setTimeout as sleep } from 'node:timers/promises'
import { Inject, Injectable, Optional } from '@nestjs/common'
import { MessageBusMetricsService } from '@/modules/message-bus/metrics/message-bus-metrics.service'

export interface RateLimiterAcquireOptions {
  capacity: number
  refillIntervalMs: number
  weight?: number
}

interface BucketState {
  tokens: number
  resetAt: number
  chain: Promise<void>
  queueDepth: number
}

type SleepFn = (ms: number) => Promise<void>
type QueueDepthMetrics = Pick<MessageBusMetricsService, 'setOkxTokenBucketQueueDepth'>

@Injectable()
export class RateLimiterRegistry {
  private readonly buckets = new Map<string, BucketState>()

  constructor(
    @Optional()
    @Inject('RATE_LIMITER_SLEEP_FN')
    private readonly sleepFn: SleepFn = sleep,
    @Optional()
    @Inject(MessageBusMetricsService)
    private readonly metrics?: QueueDepthMetrics,
  ) {}

  acquire(bucketKey: string, options: RateLimiterAcquireOptions): Promise<void> {
    this.assertValidAcquireOptions(bucketKey, options)
    const bucket = this.getBucket(bucketKey, options)
    bucket.queueDepth += 1
    this.publishQueueDepth(bucketKey, bucket)
    const task = bucket.chain.then(async () => {
      try {
        await this.acquireFromBucket(bucket, options)
      } finally {
        bucket.queueDepth = Math.max(0, bucket.queueDepth - 1)
        this.publishQueueDepth(bucketKey, bucket)
      }
    })
    bucket.chain = task.catch(() => undefined)
    return task
  }

  getQueueDepth(bucketKey: string): number {
    return this.buckets.get(bucketKey)?.queueDepth ?? 0
  }

  private publishQueueDepth(bucketKey: string, bucket: BucketState): void {
    this.metrics?.setOkxTokenBucketQueueDepth(bucketKey, bucket.queueDepth)
  }

  private getBucket(bucketKey: string, options: RateLimiterAcquireOptions): BucketState {
    const existing = this.buckets.get(bucketKey)
    if (existing) return existing

    const bucket: BucketState = {
      tokens: options.capacity,
      resetAt: Date.now() + options.refillIntervalMs,
      chain: Promise.resolve(),
      queueDepth: 0,
    }
    this.buckets.set(bucketKey, bucket)
    return bucket
  }

  private async acquireFromBucket(
    bucket: BucketState,
    options: RateLimiterAcquireOptions,
  ): Promise<void> {
    const weight = options.weight ?? 1
    while (true) {
      this.refillBucket(bucket, options)
      if (bucket.tokens >= weight) {
        bucket.tokens -= weight
        return
      }

      await this.sleepFn(Math.max(0, bucket.resetAt - Date.now()))
    }
  }

  private assertValidAcquireOptions(bucketKey: string, options: RateLimiterAcquireOptions): void {
    const weight = options.weight ?? 1
    if (weight > options.capacity) {
      throw new Error(`Token bucket weight (${weight}) exceeds capacity (${options.capacity}) for ${bucketKey}`)
    }
  }

  private refillBucket(bucket: BucketState, options: RateLimiterAcquireOptions): void {
    const now = Date.now()
    if (now < bucket.resetAt) return

    bucket.tokens = options.capacity
    bucket.resetAt = now + options.refillIntervalMs
  }
}
