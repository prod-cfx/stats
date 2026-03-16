import type { PrismaService } from '@/prisma/prisma.service'
import type { Prisma} from '@/prisma/prisma.types';
import { Injectable, Logger } from '@nestjs/common'
import { OutboxStatus } from '@/prisma/prisma.types'

@Injectable()
export class OutboxRepository {
  private readonly logger = new Logger(OutboxRepository.name)

  constructor(private readonly prisma: PrismaService) {}

  getClient(tx?: Prisma.TransactionClient) {
    return (tx as any) || this.prisma.getClient()
  }

  async create(
    data: {
      topic: string
      type: string
      payload: unknown
      dedupeKey?: string | null
      correlationId?: string | null
      partitionKey?: string | null
      priority?: number | null
      deliverAt?: Date | null
    },
    tx?: Prisma.TransactionClient,
  ) {
    const client = this.getClient(tx)
    return (client as any).outboxMessage.create({
      data: {
        topic: data.topic,
        type: data.type,
        payload: data.payload as any,
        status: OutboxStatus.PENDING,
        nextVisibleAt: data.deliverAt ?? new Date(),
        dedupeKey: data.dedupeKey ?? null,
        correlationId: data.correlationId ?? null,
        partitionKey: data.partitionKey ?? null,
        priority: data.priority ?? null,
      },
    })
  }

  /**
   * 原子领取一批可见消息（并发安全，KISS 实现）
   * 策略：
   * 1) 按 nextVisibleAt 升序查询候选 ID 限制 batch
   * 2) 对每条记录进行条件更新：
   *    - status in (PENDING, RETRY)
   *    - (lockedAt 为空 或 锁已超时)
   *    - nextVisibleAt <= now
   *    若更新成功则视为领取成功，设置 CLAIMED/lockedBy/lockedAt
   */
  async claimBatch(
    instanceId: string,
    batchSize: number,
    lockTimeoutSec: number,
    candidateFactor = 3,
  ): Promise<
    Array<{
      id: bigint
      topic: string
      type: string
      payload: any
      correlationId: string | null
      dedupeKey: string | null
      priority: number | null
    }>
  > {
    const now = new Date()
    const lockExpiredBefore = new Date(now.getTime() - lockTimeoutSec * 1000)
    const client = this.getClient()

    const candidates: Array<{ id: bigint }> = await (client as any).outboxMessage.findMany({
      select: { id: true },
      where: {
        nextVisibleAt: { lte: now },
        OR: [
          { status: { in: [OutboxStatus.PENDING, OutboxStatus.RETRY] } },
          { AND: [{ status: OutboxStatus.CLAIMED }, { lockedAt: { lte: lockExpiredBefore } }] },
        ],
      },
      orderBy: [{ nextVisibleAt: 'asc' }],
      take: Math.max(batchSize, Math.min(5000, batchSize * Math.max(1, candidateFactor))),
    })

    const claimed: Array<{
      id: bigint
      topic: string
      type: string
      payload: any
      correlationId: string | null
      dedupeKey: string | null
      priority: number | null
    }> = []

    for (const row of candidates) {
      if (claimed.length >= batchSize) break

      const updated = await (client as any).outboxMessage.updateMany({
        where: {
          id: row.id,
          nextVisibleAt: { lte: now },
          OR: [
            { status: { in: [OutboxStatus.PENDING, OutboxStatus.RETRY] } },
            { AND: [{ status: OutboxStatus.CLAIMED }, { lockedAt: { lte: lockExpiredBefore } }] },
          ],
        },
        data: {
          status: OutboxStatus.CLAIMED,
          lockedBy: instanceId,
          lockedAt: now,
        },
      })

      if (updated.count === 1) {
        const full = await (client as any).outboxMessage.findUnique({
          where: { id: row.id },
          select: {
            id: true,
            topic: true,
            type: true,
            payload: true,
            correlationId: true,
            dedupeKey: true,
            priority: true,
          },
        })
        if (full) claimed.push(full)
      }
    }

    return claimed
  }

  async markSent(id: bigint) {
    const client = this.getClient()
    await (client as any).outboxMessage.update({
      where: { id },
      data: { status: OutboxStatus.SENT, lockedBy: null, lockedAt: null },
    })
  }

  async markRetry(id: bigint, attempts: number, backoffMs: number, error?: string) {
    const client = this.getClient()
    const nextVisibleAt = new Date(Date.now() + backoffMs)
    await (client as any).outboxMessage.update({
      where: { id },
      data: {
        status: OutboxStatus.RETRY,
        attempts,
        nextVisibleAt,
        lastError: error?.slice(0, 2000) || null,
        lockedBy: null,
        lockedAt: null,
      },
    })
  }

  async markDead(id: bigint, error?: string) {
    const client = this.getClient()
    await (client as any).outboxMessage.update({
      where: { id },
      data: {
        status: OutboxStatus.DEAD,
        lastError: error?.slice(0, 2000) || null,
        lockedBy: null,
        lockedAt: null,
      },
    })
  }

  async incrementAttemptsAndGet(id: bigint): Promise<number> {
    const client: any = this.getClient()
    const row = await client.outboxMessage.update({
      where: { id },
      data: { attempts: { increment: 1 } },
      select: { attempts: true },
    })
    return row.attempts
  }

  async purgeSentOlderThan(cutoff: Date, batchSize = 500): Promise<number> {
    const client: any = this.getClient()
    let total = 0
    for (;;) {
      const rows: Array<{ id: bigint }> = await client.outboxMessage.findMany({
        select: { id: true },
        where: { status: OutboxStatus.SENT, createdAt: { lt: cutoff } },
        orderBy: { id: 'asc' },
        take: batchSize,
      })
      if (rows.length === 0) break
      await client.outboxMessage.deleteMany({ where: { id: { in: rows.map(r => r.id) } } })
      total += rows.length
      if (rows.length < batchSize) break
    }
    return total
  }
}
