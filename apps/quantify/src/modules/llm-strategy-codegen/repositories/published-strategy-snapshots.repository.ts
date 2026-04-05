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
  irSnapshot?: Record<string, unknown> | null
  astSnapshot?: Record<string, unknown> | null
  compiledManifest?: Record<string, unknown> | null
  consistencyReport: Record<string, unknown>
  paramsSnapshot?: Record<string, unknown> | null
  executionEnvelope?: Record<string, unknown> | null
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

function readManifestDigest(
  manifest: Record<string, unknown> | null | undefined,
  key: 'irHash' | 'astDigest' | 'structuralDigest',
  fallback?: string,
): string | null {
  const value = manifest?.[key]
  if (typeof value === 'string' && value.trim().length > 0) return value
  return fallback ?? null
}

@Injectable()
export class PublishedStrategySnapshotsRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaClient>>) {}

  async create(input: CreatePublishedStrategySnapshotInput): Promise<PublishedStrategySnapshot> {
    const normalizedScript = input.scriptSnapshot.trim()
    const normalizedSpec = stableJsonStringify(input.specSnapshot)
    const normalizedIr = input.irSnapshot ? stableJsonStringify(input.irSnapshot) : null
    const normalizedAst = input.astSnapshot ? stableJsonStringify(input.astSnapshot) : null
    const normalizedManifest = input.compiledManifest ? stableJsonStringify(input.compiledManifest) : null
    const normalizedConsistency = stableJsonStringify(input.consistencyReport)
    const normalizedParams = input.paramsSnapshot ? stableJsonStringify(input.paramsSnapshot) : null
    const normalizedExecutionEnvelope = input.executionEnvelope ? stableJsonStringify(input.executionEnvelope) : null
    const normalizedExecutionPolicy = input.executionPolicy ? stableJsonStringify(input.executionPolicy) : null
    const normalizedDataRequirements = input.dataRequirements ? stableJsonStringify(input.dataRequirements) : null

    const scriptHash = sha256(normalizedScript)
    const specHash = sha256(normalizedSpec)
    const irHash = readManifestDigest(input.compiledManifest, 'irHash', normalizedIr ? sha256(normalizedIr) : undefined)
    const astDigest = readManifestDigest(input.compiledManifest, 'astDigest', normalizedAst ? sha256(normalizedAst) : undefined)
    const structuralDigest = readManifestDigest(input.compiledManifest, 'structuralDigest', normalizedManifest ? sha256(normalizedManifest) : undefined)
    const compiledManifestHash = normalizedManifest ? sha256(normalizedManifest) : ''
    const executionEnvelopeHash = normalizedExecutionEnvelope ? sha256(normalizedExecutionEnvelope) : ''
    const snapshotHash = sha256([
      scriptHash,
      specHash,
      irHash ?? '',
      astDigest ?? '',
      structuralDigest ?? '',
      compiledManifestHash,
      executionEnvelopeHash,
    ].join(':'))

    return this.txHost.tx.publishedStrategySnapshot.create({
      data: {
        session: { connect: { id: input.sessionId } },
        strategyTemplateId: input.strategyTemplateId ?? null,
        strategyInstanceId: input.strategyInstanceId ?? null,
        snapshotHash,
        scriptHash,
        specHash,
        irHash,
        astDigest,
        structuralDigest,
        scriptSnapshot: normalizedScript,
        specSnapshot: input.specSnapshot as Prisma.InputJsonValue,
        irSnapshot: input.irSnapshot as Prisma.InputJsonValue | null | undefined,
        astSnapshot: input.astSnapshot as Prisma.InputJsonValue | null | undefined,
        compiledManifest: input.compiledManifest as Prisma.InputJsonValue | null | undefined,
        consistencyReport: input.consistencyReport as Prisma.InputJsonValue,
        paramsSnapshot: input.paramsSnapshot as Prisma.InputJsonValue | null | undefined,
        executionEnvelope: input.executionEnvelope as Prisma.InputJsonValue | null | undefined,
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
  readManifestDigest,
  stableJsonStringify,
  sha256,
}
