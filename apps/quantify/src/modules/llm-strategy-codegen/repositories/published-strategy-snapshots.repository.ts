import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma'
import type { PrismaClient, Prisma, PublishedStrategySnapshot } from '@/prisma/prisma.types'
import { createHash } from 'node:crypto'
// eslint-disable-next-line ts/consistent-type-imports -- repository requires runtime class for DI
import { TransactionHost } from '@nestjs-cls/transactional'
import { Injectable } from '@nestjs/common'

export interface CreatePublishedStrategySnapshotInput {
  sessionId: string
  strategyTemplateId?: string | null
  strategyInstanceId?: string | null
  scriptSnapshot: string
  specSnapshot: Record<string, unknown>
  consistencyReport: Record<string, unknown>
  userIntentSummary: Record<string, unknown>
  strategySummary: Record<string, unknown>
  scriptSummary: Record<string, unknown>
  lockedParams: Record<string, unknown>
  snapshotVersion?: number
  paramsSnapshot?: Record<string, unknown> | null
  executionPolicy?: Record<string, unknown> | null
  dataRequirements?: Record<string, unknown> | null
}

function stableJsonStringify(value: unknown): string {
  if (value === null || value === undefined) return 'null'
  if (typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) {
    return `[${value.map(item => stableJsonStringify(item)).join(',')}]`
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))

  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableJsonStringify(item)}`).join(',')}}`
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

@Injectable()
export class PublishedStrategySnapshotsRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaClient>>) {}

  async create(input: CreatePublishedStrategySnapshotInput): Promise<PublishedStrategySnapshot> {
    const snapshotVersion = input.snapshotVersion ?? 2
    const normalizedScript = input.scriptSnapshot.trim()
    const normalizedSpec = stableJsonStringify(input.specSnapshot)
    const normalizedConsistency = stableJsonStringify(input.consistencyReport)
    const normalizedUserIntentSummary = stableJsonStringify(input.userIntentSummary)
    const normalizedStrategySummary = stableJsonStringify(input.strategySummary)
    const normalizedScriptSummary = stableJsonStringify(input.scriptSummary)
    const normalizedLockedParams = stableJsonStringify(input.lockedParams)
    const normalizedParams = input.paramsSnapshot ? stableJsonStringify(input.paramsSnapshot) : null
    const normalizedExecutionPolicy = input.executionPolicy ? stableJsonStringify(input.executionPolicy) : null
    const normalizedDataRequirements = input.dataRequirements ? stableJsonStringify(input.dataRequirements) : null

    const scriptHash = sha256(normalizedScript)
    const specHash = sha256(normalizedSpec)
    const snapshotHash = sha256([
      scriptHash,
      specHash,
      sha256(normalizedConsistency),
      sha256(normalizedUserIntentSummary),
      sha256(normalizedStrategySummary),
      sha256(normalizedScriptSummary),
      sha256(normalizedLockedParams),
      sha256(String(snapshotVersion)),
      normalizedParams ? sha256(normalizedParams) : '',
      normalizedExecutionPolicy ? sha256(normalizedExecutionPolicy) : '',
      normalizedDataRequirements ? sha256(normalizedDataRequirements) : '',
    ].join(':'))

    return this.txHost.tx.publishedStrategySnapshot.create({
      data: {
        session: { connect: { id: input.sessionId } },
        strategyTemplateId: input.strategyTemplateId ?? null,
        strategyInstanceId: input.strategyInstanceId ?? null,
        snapshotHash,
        scriptHash,
        specHash,
        scriptSnapshot: normalizedScript,
        specSnapshot: input.specSnapshot as Prisma.InputJsonValue,
        consistencyReport: input.consistencyReport as Prisma.InputJsonValue,
        userIntentSummary: input.userIntentSummary as Prisma.InputJsonValue,
        strategySummary: input.strategySummary as Prisma.InputJsonValue,
        scriptSummary: input.scriptSummary as Prisma.InputJsonValue,
        lockedParams: input.lockedParams as Prisma.InputJsonValue,
        snapshotVersion,
        paramsSnapshot: input.paramsSnapshot as Prisma.InputJsonValue | null | undefined,
        executionPolicy: input.executionPolicy as Prisma.InputJsonValue | null | undefined,
        dataRequirements: input.dataRequirements as Prisma.InputJsonValue | null | undefined,
      },
    })
  }

  async findLatestBySessionId(sessionId: string): Promise<PublishedStrategySnapshot | null> {
    return this.txHost.tx.publishedStrategySnapshot.findFirst({
      where: { sessionId },
      orderBy: [{ createdAt: 'desc' }],
    })
  }

  async findById(id: string): Promise<PublishedStrategySnapshot | null> {
    return this.txHost.tx.publishedStrategySnapshot.findUnique({
      where: { id },
    })
  }
}

export const __test__ = {
  stableJsonStringify,
  sha256,
}
