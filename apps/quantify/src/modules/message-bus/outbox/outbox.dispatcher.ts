import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Cron } from '@nestjs/schedule'
import { EnvService } from '@/common/services/env.service'
import { MessageBusMetricsService } from '../metrics/message-bus.metrics.service'
import { isMessageBusRuntimeEnabled } from '../message-bus.runtime'
import { MessageBusService } from '../message-bus.service'
import { OutboxRepository } from './outbox.repository'

@Injectable()
export class OutboxDispatcher {
  private readonly logger = new Logger(OutboxDispatcher.name)
  private readonly instanceId: string
  private readonly pollIntervalMs: number
  private readonly batchSize: number
  private readonly maxAttempts: number
  private readonly lockTimeoutSec: number
  private readonly baseBackoffMs: number
  private readonly publishAttempts: number
  private lastRunAt = 0

  constructor(
    private readonly config: ConfigService,
    private readonly repo: OutboxRepository,
    private readonly bus: MessageBusService,
    private readonly env: EnvService,
    private readonly metrics: MessageBusMetricsService,
  ) {
    const hostname = this.env.getString('HOSTNAME', 'app') || 'app'
    this.instanceId = `${hostname}:${process.pid}`
    const cfg = this.config.get('messageBus.outbox') as any
    this.pollIntervalMs = cfg?.pollIntervalMs ?? 500
    this.batchSize = cfg?.batchSize ?? 20
    this.maxAttempts = cfg?.maxAttempts ?? 6
    this.lockTimeoutSec = cfg?.lockTimeoutSec ?? 30
    this.baseBackoffMs = cfg?.baseBackoffMs ?? 1000
    this.publishAttempts = cfg?.publishAttempts ?? 3
  }

  @Cron('* * * * * *', { name: 'outbox-dispatcher' })
  async tick() {
    if (!isMessageBusRuntimeEnabled()) return
    // 以较细粒度的 Cron 触发，内部自调度控制节流
    const now = Date.now()
    if (now - this.lastRunAt < this.pollIntervalMs) return
    this.lastRunAt = now
    await this.dispatchOnce().catch(err => {
      this.logger.error(`Outbox dispatch error: ${err?.message || err}`)
    })
  }

  private async dispatchOnce() {
    const batch = await this.repo.claimBatch(
      this.instanceId,
      this.batchSize,
      this.lockTimeoutSec,
      (this.config.get('messageBus.outbox.candidateFactor') as any) ?? 3,
    )
    const claimed = batch.length
    if (claimed > 0) this.metrics.incOutboxClaimed(claimed)
    if (claimed === 0) return
    let sent = 0
    let retried = 0
    let deaded = 0

    for (const msg of batch) {
      const id = msg.id
      try {
        const started = Date.now()
        // 下游 Bull 发布（沿用现有队列与去重策略）
        await this.bus.publish<any>(msg.topic, msg.type, msg.payload, {
          correlationId: msg.correlationId || undefined,
          dedupeKey: msg.dedupeKey || undefined,
          priority: msg.priority || undefined,
          attempts: this.publishAttempts,
        })
        await this.repo.markSent(id)
        const elapsed = Date.now() - started
        this.metrics.incOutboxSent(1)
        this.metrics.recordOutboxDispatchLatency(elapsed)
        sent += 1
      } catch (e: any) {
        const error = e?.message || String(e)
        const attempts = await this.repo.incrementAttemptsAndGet(id)
        if (attempts >= this.maxAttempts) {
          await this.repo.markDead(id, error)
          this.logger.warn(
            `Outbox DEAD id='${id}' topic='${msg.topic}' type='${msg.type}' cid='${msg.correlationId || ''}' dedupe='${msg.dedupeKey || ''}' after ${attempts} attempts: ${error}`,
          )
          this.metrics.incOutboxDead(1)
          deaded += 1
        } else {
          const backoffMs = this.computeBackoff(attempts)
          await this.repo.markRetry(id, attempts, backoffMs, error)
          this.logger.debug(
            `Outbox RETRY id='${id}' topic='${msg.topic}' type='${msg.type}' cid='${msg.correlationId || ''}' dedupe='${msg.dedupeKey || ''}' attempts=${attempts} nextInMs=${backoffMs}`,
          )
          this.metrics.incOutboxRetry(1)
          retried += 1
        }
      }
    }
    this.logger.debug(
      `Outbox dispatch summary instance='${this.instanceId}' claimed=${claimed} sent=${sent} retry=${retried} dead=${deaded}`,
    )
  }

  // 每日清理过期的 SENT 记录
  @Cron('30 0 * * *', { name: 'outbox-cleanup', timeZone: 'UTC' })
  async cleanup() {
    if (!isMessageBusRuntimeEnabled()) return
    const days: number = (this.config.get('messageBus.outbox.retainDays') as any) ?? 7
    const cutoff = new Date(Date.now() - Math.max(1, days) * 24 * 60 * 60 * 1000)
    try {
      const removed = await this.repo.purgeSentOlderThan(cutoff, 1000)
      if (removed > 0)
        this.logger.log(`Outbox cleanup removed ${removed} SENT rows older than ${days}d`)
    } catch (e: any) {
      this.logger.warn(`Outbox cleanup failed: ${e?.message || e}`)
    }
  }

  private computeBackoff(attempts: number): number {
    // 指数回退：base * 2^(attempts-1)，但上限 60s
    const ms = this.baseBackoffMs * 2 ** Math.max(0, attempts - 1)
    return Math.min(ms, 60_000)
  }
}
