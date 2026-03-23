import { ErrorCode } from '@ai/shared'
import { HttpStatus } from '@nestjs/common'
import { DomainException } from '@/common/exceptions/domain.exception'

/**
 * Token Bucket 频率限制器
 * 用于控制外部 API 调用频率，避免触发服务商限流
 */
export class TokenBucketRateLimiter {
  private tokens: number
  private lastRefillTime: number
  private readonly refillIntervalMs: number

  /**
   * @param maxTokens - 桶的最大容量（突发请求数）
   * @param refillRate - 每秒补充的令牌数
   */
  constructor(
    private readonly maxTokens: number,
    private readonly refillRate: number,
  ) {
    this.tokens = maxTokens
    this.lastRefillTime = Date.now()
    this.refillIntervalMs = 1000 / refillRate
  }

  /**
   * 获取一个令牌，如果没有可用令牌则等待
   * @param timeoutMs - 最大等待时间（毫秒），超时则抛出错误
   */
  async acquire(timeoutMs = 60_000): Promise<void> {
    const startTime = Date.now()

    while (true) {
      this.refill()

      if (this.tokens >= 1) {
        this.tokens -= 1
        return
      }

      // 计算需要等待的时间
      const waitMs = Math.min(this.refillIntervalMs, 100)

      if (Date.now() - startTime + waitMs > timeoutMs) {
        throw new DomainException('rate_limiter.exceeded', {
          code: ErrorCode.RATE_LIMIT_EXCEEDED,
          status: HttpStatus.TOO_MANY_REQUESTS,
          args: { reason: `Rate limiter timeout after ${timeoutMs}ms` },
        })
      }

      await this.sleep(waitMs)
    }
  }

  /**
   * 尝试获取令牌，如果没有可用令牌则立即返回 false
   */
  tryAcquire(): boolean {
    this.refill()

    if (this.tokens >= 1) {
      this.tokens -= 1
      return true
    }

    return false
  }

  /**
   * 根据时间流逝补充令牌
   */
  private refill(): void {
    const now = Date.now()
    const elapsed = now - this.lastRefillTime

    if (elapsed > 0) {
      const tokensToAdd = (elapsed / 1000) * this.refillRate
      this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd)
      this.lastRefillTime = now
    }
  }

  /**
   * 获取当前可用令牌数
   */
  getAvailableTokens(): number {
    this.refill()
    return Math.floor(this.tokens)
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}
