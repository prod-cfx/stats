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
  semanticGraph?: Record<string, unknown> | null
  compiledIr?: Record<string, unknown> | null
  irSnapshot?: Record<string, unknown> | null
  astSnapshot?: Record<string, unknown> | null
  compiledManifest?: Record<string, unknown> | null
  consistencyReport: Record<string, unknown>
  userIntentSummary: Record<string, unknown>
  strategySummary: Record<string, unknown>
  scriptSummary: Record<string, unknown>
  lockedParams: Record<string, unknown>
  snapshotVersion?: number
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

function sha256HashString(value: string): `sha256:${string}` {
  return `sha256:${sha256(value)}`
}

function readManifestDigest(
  manifest: Record<string, unknown> | null | undefined,
  key: 'specHash' | 'irHash' | 'astDigest' | 'structuralDigest',
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
    const snapshotVersion = input.snapshotVersion ?? 2
    const normalizedScript = input.scriptSnapshot
    const normalizedSpec = stableJsonStringify(input.specSnapshot)
    const normalizedSemanticGraph = input.semanticGraph ? stableJsonStringify(input.semanticGraph) : null
    const normalizedCompiledIr = input.compiledIr ? stableJsonStringify(input.compiledIr) : null
    const normalizedIr = input.irSnapshot ? stableJsonStringify(input.irSnapshot) : null
    const normalizedAst = input.astSnapshot ? stableJsonStringify(input.astSnapshot) : null
    const normalizedManifest = input.compiledManifest ? stableJsonStringify(input.compiledManifest) : null
    const normalizedConsistency = stableJsonStringify(input.consistencyReport)
    const normalizedUserIntentSummary = stableJsonStringify(input.userIntentSummary)
    const normalizedStrategySummary = stableJsonStringify(input.strategySummary)
    const normalizedScriptSummary = stableJsonStringify(input.scriptSummary)
    const normalizedLockedParams = stableJsonStringify(input.lockedParams)
    const normalizedParams = input.paramsSnapshot ? stableJsonStringify(input.paramsSnapshot) : null
    const normalizedExecutionEnvelope = input.executionEnvelope ? stableJsonStringify(input.executionEnvelope) : null
    const normalizedExecutionPolicy = input.executionPolicy ? stableJsonStringify(input.executionPolicy) : null
    const normalizedDataRequirements = input.dataRequirements ? stableJsonStringify(input.dataRequirements) : null

    const scriptHash = sha256(normalizedScript)
    const specHash = readManifestDigest(input.compiledManifest, 'specHash', sha256HashString(normalizedSpec))
      ?? sha256HashString(normalizedSpec)
    const irHash = readManifestDigest(input.compiledManifest, 'irHash', normalizedIr ? sha256(normalizedIr) : undefined)
    const astDigest = readManifestDigest(input.compiledManifest, 'astDigest', normalizedAst ? sha256(normalizedAst) : undefined)
    const structuralDigest = readManifestDigest(input.compiledManifest, 'structuralDigest', normalizedManifest ? sha256(normalizedManifest) : undefined)
    const compiledManifestHash = normalizedManifest ? sha256(normalizedManifest) : ''
    const executionEnvelopeHash = normalizedExecutionEnvelope ? sha256(normalizedExecutionEnvelope) : ''
    const snapshotHash = sha256([
      scriptHash,
      specHash,
      normalizedSemanticGraph ? sha256(normalizedSemanticGraph) : '',
      normalizedCompiledIr ? sha256(normalizedCompiledIr) : '',
      irHash ?? '',
      astDigest ?? '',
      structuralDigest ?? '',
      compiledManifestHash,
      executionEnvelopeHash,
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
        semanticGraph: input.semanticGraph as Prisma.InputJsonValue | null | undefined,
        compiledIr: input.compiledIr as Prisma.InputJsonValue | null | undefined,
        irSnapshot: input.irSnapshot as Prisma.InputJsonValue | null | undefined,
        astSnapshot: input.astSnapshot as Prisma.InputJsonValue | null | undefined,
        compiledManifest: input.compiledManifest as Prisma.InputJsonValue | null | undefined,
        consistencyReport: input.consistencyReport as Prisma.InputJsonValue,
        userIntentSummary: input.userIntentSummary as Prisma.InputJsonValue,
        strategySummary: input.strategySummary as Prisma.InputJsonValue,
        scriptSummary: input.scriptSummary as Prisma.InputJsonValue,
        lockedParams: input.lockedParams as Prisma.InputJsonValue,
        snapshotVersion,
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

  async findByIdForUser(id: string, userId: string): Promise<PublishedStrategySnapshot | null> {
    return this.txHost.tx.publishedStrategySnapshot.findFirst({
      where: {
        id,
        session: {
          userId,
        },
      },
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
