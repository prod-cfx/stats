import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config'
import type { Queue, JobOptions } from 'bull'
import type {
  MessageEnvelope,
  PublishOptions} from './message-bus.types';
import type { CacheService } from '@/common/services/cache.service'
import { randomUUID } from 'node:crypto'
import { InjectQueue } from '@nestjs/bull'
import { Injectable, Logger } from '@nestjs/common'
import {
  MESSAGE_HANDSHAKE_DONE_PREFIX,
  MESSAGE_BUS_QUEUE,
} from './message-bus.types'

/**
 * MessageBusService
 * - 极简发布服务：将消息封装为 Envelope 并投递到单一队列 `message-bus`
 * - 通过 Job 名称（即 topic）进行路由，订阅者使用 `@Process('<topic>')`
 * - 符合 KISS/YAGNI：仅发布，不做事务、去重之外的复杂处理
 */
@Injectable()
export class MessageBusService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MessageBusService.name)
  private readonly backoffDelayMs: number
  // 提供给非 DI 场景（如装饰器）的静态访问器
  private static _instance: MessageBusService | undefined

  static getInstance(): MessageBusService | undefined {
    return MessageBusService._instance
  }

  static getDefaultMode(): 'volatile' | 'reliable' | 'handshake' {
    const inst = MessageBusService._instance
    const fallback: any = 'volatile'
    try {
      const cfg = inst?.config.get<'volatile' | 'reliable' | 'handshake'>(
        'messageBus.defaultMode',
        'volatile',
      )
      return (cfg as any) || fallback
    } catch {
      return fallback
    }
  }

  constructor(
    @InjectQueue(MESSAGE_BUS_QUEUE) private readonly queue: Queue,
    private readonly cache: CacheService,
    private readonly config: ConfigService,
  ) {
    this.backoffDelayMs = this.config.get<number>('messageBus.backoffDelayMs', 1000)
    // 构造时先设置一次，确保最早可用
    MessageBusService._instance = this
  }

  onModuleInit() {
    // 模块初始化完成后再次赋值，确保静态引用就绪
    MessageBusService._instance = this
    this.logger.log('MessageBusService initialized and static instance set')
  }

  onModuleDestroy() {
    if (MessageBusService._instance === this) {
      MessageBusService._instance = undefined
    }
  }

  private getBackoffOptions() {
    return { type: 'exponential' as const, delay: this.backoffDelayMs }
  }

  /**
   * 发布消息到指定 topic
   * @param topic 主题（订阅方使用 `@Process(topic)` 监听）
   * @param type 事件类型，如 `user.created`
   * @param data 业务数据负载
   * @param options 发布选项（延时/优先级/重试/去重）
   * @returns 已入队的 jobId（字符串）
   */
  async publish<T>(
    topic: string,
    type: string,
    data: T,
    options?: PublishOptions,
  ): Promise<string> {
    if (options?.mode && options.mode !== 'volatile') {
      this.logger.warn(
        `publish(): options.mode='${options.mode}' 将被忽略；如需可靠或握手，请使用装饰器或专用 API。`,
      )
    }
    const envelope: MessageEnvelope<T> = {
      topic,
      type,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        correlationId: options?.correlationId,
      },
    }

    const jobOptions: JobOptions = {
      delay: options?.delayMs,
      priority: options?.priority,
      attempts: options?.attempts ?? 3,
      removeOnComplete: true,
      removeOnFail: false,
      jobId: this.buildDedupeJobId(topic, options?.dedupeKey),
      backoff: this.getBackoffOptions(),
    }

    const job = await this.queue.add(topic, envelope, jobOptions)

    this.logger.debug(
      `Published message topic='${topic}' type='${type}' jobId='${job.id}' correlationId='${envelope.meta.correlationId ?? ''}'`,
    )

    return String(job.id)
  }

  /**
   * 发布并等待消费者确认（轻量握手）
   * - 通过 correlationId 在缓存中轮询完成标记
   * - 消费者需在处理完成后写入 CacheService.set(`bus:done:${correlationId}`, result)
   */
  async publishAndWait<T, R = unknown>(
    topic: string,
    type: string,
    data: T,
    options?: PublishOptions & { timeoutMs?: number; pollIntervalMs?: number },
  ): Promise<{ jobId: string; correlationId: string; result: R | undefined }> {
    if (options?.mode && options.mode !== 'handshake') {
      this.logger.warn(
        `publishAndWait(): options.mode='${options.mode}' 将被忽略；该方法总是进行握手等待。`,
      )
    }
    const correlationId = options?.correlationId || randomUUID()
    const envelope: MessageEnvelope<T> = {
      topic,
      type,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        correlationId,
      },
    }

    const jobOptions: JobOptions = {
      delay: options?.delayMs,
      priority: options?.priority,
      attempts: options?.attempts ?? 3,
      removeOnComplete: true,
      removeOnFail: false,
      jobId: this.buildDedupeJobId(topic, options?.dedupeKey),
      backoff: this.getBackoffOptions(),
    }

    const job = await this.queue.add(topic, envelope, jobOptions)
    this.logger.debug(
      `Published (wait) topic='${topic}' type='${type}' jobId='${job.id}' correlationId='${correlationId}'`,
    )

    const timeoutMs = Math.max(1000, options?.timeoutMs ?? 15000)
    const pollIntervalMs = Math.max(50, options?.pollIntervalMs ?? 150)
    const key = this.buildHandshakeKey(correlationId)
    const start = Date.now()
    let result: any

    while (Date.now() - start < timeoutMs) {
      const val = await this.cache.get<R | string>(key)
      if (val !== undefined) {
        result = val
        break
      }
      await new Promise(r => setTimeout(r, pollIntervalMs))
    }

    const elapsed = Date.now() - start
    this.logger.debug(
      `Wait completed topic='${topic}' type='${type}' jobId='${job.id}' correlationId='${correlationId}' elapsedMs='${elapsed}' done='${result !== undefined}'`,
    )
    return { jobId: String(job.id), correlationId, result }
  }

  /**
   * 构建握手完成键名
   */
  buildHandshakeKey(correlationId: string): string {
    return `${MESSAGE_HANDSHAKE_DONE_PREFIX}${correlationId}`
  }

  /**
   * 构建基于 topic 的去重 jobId
   */
  buildDedupeJobId(topic: string, dedupeKey?: string): string | undefined {
    return dedupeKey ? `${topic}:${dedupeKey}` : undefined
  }

  /**
   * 由消费者在处理完成后标记握手完成
   */
  async markDone(correlationId: string, value: unknown = 'ok', ttlSec = 60): Promise<void> {
    const key = this.buildHandshakeKey(correlationId)
    await this.cache.set(key, value, ttlSec)
  }
}
