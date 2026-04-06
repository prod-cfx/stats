import type { PublishedStrategySnapshot } from '@/prisma/prisma.types'
import type { StrategyAstV1 } from '@/modules/llm-strategy-codegen/types/canonical-strategy-ast'
import type { CompiledScriptProjection, CompiledStrategyManifest } from '@/modules/llm-strategy-codegen/types/compiled-script-projection'
import { canonicalSerialize } from '@ai/shared/script-engine/compiled-runtime'
import { ErrorCode } from '@ai/shared'
import { HttpStatus, Injectable } from '@nestjs/common'
import { createHash } from 'node:crypto'
import { DomainException } from '@/common/exceptions/domain.exception'
import { CompiledScriptParserService } from '@/modules/llm-strategy-codegen/services/compiled-script-parser.service'

type BacktestCompiledSnapshot = Pick<
  PublishedStrategySnapshot,
  | 'id'
  | 'specHash'
  | 'irHash'
  | 'astDigest'
  | 'structuralDigest'
  | 'scriptSnapshot'
  | 'irSnapshot'
  | 'astSnapshot'
  | 'compiledManifest'
>

@Injectable()
export class BacktestCompiledSnapshotPreflightService {
  private readonly scriptParser = new CompiledScriptParserService()

  validate(snapshot: BacktestCompiledSnapshot): void {
    try {
      const projection = this.scriptParser.parse(snapshot.scriptSnapshot)

      this.assertManifestMatchesSnapshot(snapshot, projection.compiledManifest)
      this.assertIrHash(snapshot.irSnapshot, projection.compiledManifest.irHash)
      this.assertAstDigest(snapshot.astSnapshot, projection.compiledManifest.astDigest)
      this.assertStructuralDigest(projection, projection.compiledManifest.structuralDigest)
    }
    catch (error) {
      if (error instanceof DomainException && error.message === 'backtest.compiled_snapshot_invalid') {
        throw error
      }

      throw new DomainException('backtest.compiled_snapshot_invalid', {
        code: ErrorCode.BAD_REQUEST,
        status: HttpStatus.BAD_REQUEST,
        args: {
          snapshotId: snapshot.id,
          reason: error instanceof Error ? error.message : 'unknown',
        },
      })
    }
  }

  private assertManifestMatchesSnapshot(
    snapshot: BacktestCompiledSnapshot,
    manifest: CompiledStrategyManifest,
  ): void {
    const snapshotManifest = this.readJsonRecord(snapshot.compiledManifest)
    if (!snapshotManifest) {
      this.raiseInvalid('manifest_missing')
    }

    if (
      snapshot.specHash !== manifest.specHash
      || snapshot.irHash !== manifest.irHash
      || snapshot.astDigest !== manifest.astDigest
      || snapshot.structuralDigest !== manifest.structuralDigest
      || snapshotManifest.specHash !== manifest.specHash
      || snapshotManifest.irHash !== manifest.irHash
      || snapshotManifest.astDigest !== manifest.astDigest
      || snapshotManifest.structuralDigest !== manifest.structuralDigest
    ) {
      this.raiseInvalid('manifest_mismatch')
    }
  }

  private assertIrHash(rawIrSnapshot: unknown, expectedIrHash: string): void {
    const irSnapshot = this.readJsonRecord(rawIrSnapshot)
    if (!irSnapshot) {
      this.raiseInvalid('ir_snapshot_missing')
    }

    if (hashStableJson(irSnapshot) !== expectedIrHash) {
      this.raiseInvalid('ir_hash_mismatch')
    }
  }

  private assertAstDigest(rawAstSnapshot: unknown, expectedAstDigest: string): void {
    const astSnapshot = this.readAstSnapshot(rawAstSnapshot)
    if (!astSnapshot) {
      this.raiseInvalid('ast_snapshot_missing')
    }

    const astProjection = {
      astVersion: astSnapshot.astVersion,
      executionModel: astSnapshot.executionModel,
      dataRequirements: astSnapshot.dataRequirements,
      exprPool: this.projectByOrder(astSnapshot.exprPool, astSnapshot.topology.exprOrder),
      guards: this.projectByOrder(astSnapshot.guards, astSnapshot.topology.guardOrder),
      decisionPrograms: this.projectByOrder(astSnapshot.decisionPrograms, astSnapshot.topology.decisionOrder),
      orderPrograms: this.projectByOrder(astSnapshot.orderPrograms, astSnapshot.topology.orderProgramOrder),
      topology: astSnapshot.topology,
    }

    if (hashCanonicalJson(astProjection) !== expectedAstDigest) {
      this.raiseInvalid('ast_digest_mismatch')
    }
  }

  private assertStructuralDigest(
    projection: CompiledScriptProjection,
    expectedStructuralDigest: string,
  ): void {
    const structuralProjection = {
      executionModel: projection.executionModel,
      dataRequirements: projection.dataRequirements,
      exprPool: projection.exprPool,
      guards: projection.guards,
      decisionPrograms: projection.decisionPrograms,
      orderPrograms: projection.orderPrograms,
      topology: projection.topology,
    }

    if (hashCanonicalJson(structuralProjection) !== expectedStructuralDigest) {
      this.raiseInvalid('structural_digest_mismatch')
    }
  }

  private readAstSnapshot(raw: unknown): StrategyAstV1 | null {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
    return raw as StrategyAstV1
  }

  private readJsonRecord(raw: unknown): Record<string, unknown> | null {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
    return raw as Record<string, unknown>
  }

  private projectByOrder<T extends { id: string }>(items: T[], order: string[]): T[] {
    const itemIndex = new Map(items.map(item => [item.id, item]))

    return order
      .map(id => itemIndex.get(id))
      .filter((item): item is T => item !== undefined)
  }

  private raiseInvalid(reason: string): never {
    throw new DomainException('backtest.compiled_snapshot_invalid', {
      code: ErrorCode.BAD_REQUEST,
      status: HttpStatus.BAD_REQUEST,
      args: { reason },
    })
  }
}

function hashCanonicalJson(value: unknown): `sha256:${string}` {
  const digest = createHash('sha256').update(canonicalSerialize(value)).digest('hex')
  return `sha256:${digest}`
}

function stableJsonStringify(value: unknown): string {
  if (value === null || value === undefined) return 'null'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number') return Number.isFinite(value) ? JSON.stringify(value) : 'null'
  if (typeof value === 'string') return JSON.stringify(value)
  if (Array.isArray(value)) {
    return `[${value.map(item => stableJsonStringify(item)).join(',')}]`
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))

  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableJsonStringify(item)}`).join(',')}}`
}

function hashStableJson(value: unknown): `sha256:${string}` {
  const digest = createHash('sha256').update(stableJsonStringify(value)).digest('hex')
  return `sha256:${digest}`
}
